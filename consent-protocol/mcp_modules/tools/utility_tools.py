# mcp/tools/utility_tools.py
"""
Utility tool handlers (validate_token, delegate, list_scopes, discover_user_domains).

Only world-model scopes are supported: world_model.read, world_model.write, attr.{domain}.*
"""

import json
import logging
import re

import httpx
from mcp.types import TextContent

from hushh_mcp.consent.scope_helpers import get_scope_description, resolve_scope_to_enum
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import AGENT_PORTS
from mcp_modules.config import FASTAPI_URL
from hushh_mcp.trust.link import create_trust_link, verify_trust_link
from hushh_mcp.types import AgentID, UserID

logger = logging.getLogger("hushh-mcp-server")


async def handle_validate_token(args: dict) -> list[TextContent]:
    """
    Validate a consent token.
    
    Compliance:
    ✅ Signature verification (HMAC-SHA256)
    ✅ Expiration check
    ✅ Revocation check
    ✅ Scope verification (if provided)
    """
    token_str = args.get("token")
    expected_scope_str = args.get("expected_scope")
    
    # Determine expected scope if provided using centralized resolver
    expected_scope = None
    if expected_scope_str:
        expected_scope = resolve_scope_to_enum(expected_scope_str)
    
    # Use existing validation logic
    valid, reason, token_obj = validate_token(token_str, expected_scope)
    
    if not valid:
        logger.warning(f"❌ Token INVALID: {reason}")
        return [TextContent(type="text", text=json.dumps({
            "valid": False,
            "reason": reason,
            "hint": "Call request_consent to obtain a new valid token"
        }))]
    
    logger.info(f"✅ Token VALID for user={token_obj.user_id}")
    
    return [TextContent(type="text", text=json.dumps({
        "valid": True,
        "user_id": token_obj.user_id,
        "agent_id": token_obj.agent_id,
        "scope": str(token_obj.scope),
        "issued_at": token_obj.issued_at,
        "expires_at": token_obj.expires_at,
        "signature_verified": True,
        "checks_passed": [
            "✅ Signature valid (HMAC-SHA256)",
            "✅ Not expired",
            "✅ Not revoked",
            "✅ Scope matches" if expected_scope else "ℹ️ Scope not checked"
        ]
    }))]


async def handle_delegate(args: dict) -> list[TextContent]:
    """
    Create TrustLink for agent-to-agent delegation.
    
    Compliance:
    ✅ HushhMCP: A2A delegation via TrustLink
    ✅ Cryptographically signed delegation proof
    ✅ Scoped and time-limited
    ✅ User authorization recorded
    """
    from_agent = args.get("from_agent")
    to_agent = args.get("to_agent")
    scope_str = args.get("scope")
    user_id = args.get("user_id")
    
    # Map scope string to enum
    # NOTE: Legacy VAULT_READ_* scopes have been removed.
    # Parse scope using centralized resolver
    scope = resolve_scope_to_enum(scope_str)
    
    # Create TrustLink
    trust_link = create_trust_link(
        from_agent=AgentID(from_agent),
        to_agent=AgentID(to_agent),
        scope=scope,
        signed_by_user=UserID(user_id)
    )
    
    # Verify the TrustLink
    is_valid = verify_trust_link(trust_link)
    
    logger.info(f"🔗 TrustLink CREATED: {from_agent} → {to_agent} (scope={scope_str})")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "delegated",
        "trust_link": {
            "from_agent": trust_link.from_agent,
            "to_agent": trust_link.to_agent,
            "scope": str(trust_link.scope),
            "authorized_by_user": trust_link.signed_by_user,
            "created_at": trust_link.created_at,
            "expires_at": trust_link.expires_at,
            "signature": trust_link.signature[:20] + "...",
            "signature_verified": is_valid
        },
        "message": f"Task delegated from {from_agent} to {to_agent}",
        "target_port": AGENT_PORTS.get(to_agent, 10000),
        "a2a_note": "This TrustLink can be verified by the target agent to confirm delegation authority."
    }))]


async def handle_list_scopes() -> list[TextContent]:
    """
    List all available consent scopes dynamically.
    
    Purpose: Transparency - users and developers can see what data categories exist
    
    NOTE: This should ideally fetch from domain_registry for truly dynamic scopes.
    For now, returns common dynamic scopes as examples.
    """
    # Common dynamic scopes (in production, fetch from domain_registry)
    scopes = [
        {
            "scope": "attr.food.*",
            "emoji": "🍽️",
            "description": get_scope_description("attr.food.*"),
            "pattern": "attr.food.{attribute_key}",
            "sensitivity": "medium"
        },
        {
            "scope": "attr.professional.*",
            "emoji": "💼",
            "description": get_scope_description("attr.professional.*"),
            "pattern": "attr.professional.{attribute_key}",
            "sensitivity": "medium"
        },
        {
            "scope": "attr.financial.*",
            "emoji": "💰",
            "description": get_scope_description("attr.financial.*"),
            "pattern": "attr.financial.{attribute_key}",
            "sensitivity": "high"
        },
        {
            "scope": "attr.health.*",
            "emoji": "❤️",
            "description": get_scope_description("attr.health.*"),
            "pattern": "attr.health.{attribute_key}",
            "sensitivity": "high"
        },
    ]
    
    return [TextContent(type="text", text=json.dumps({
        "available_scopes": scopes,
        "total_scopes": len(scopes),
        "scope_format": "attr.{domain}.* for wildcard, attr.{domain}.{attribute_key} for specific",
        "scopes_are_dynamic": True,
        "note": "These are example scopes. Per-user scope strings come from the world model: call discover_user_domains(user_id) to get the actual domains and scope strings for a user (backend: GET /api/world-model/scopes/{user_id}).",
        "usage": "Call discover_user_domains(user_id) first, then request_consent(user_id, scope) with a scope from that result.",
        "privacy_principle": "Each scope requires separate, explicit user consent",
        "hushh_promise": "Your data is never accessed without your permission."
    }))]


async def handle_discover_user_domains(args: dict) -> list[TextContent]:
    """
    Discover which domains a user has and the scope strings to request.
    Calls GET /api/world-model/scopes/{user_id} (or metadata). Use before request_consent.
    """
    from .consent_tools import resolve_email_to_uid

    user_id = args.get("user_id") or ""
    if not user_id.strip():
        return [TextContent(type="text", text=json.dumps({
            "error": "user_id is required",
            "usage": "Call discover_user_domains with user_id (Firebase UID or email)"
        }))]

    resolved_uid, _email, _display = await resolve_email_to_uid(user_id)
    if resolved_uid is None:
        return [TextContent(type="text", text=json.dumps({
            "error": "User not found",
            "user_id": user_id,
            "hint": "Provide a valid Firebase UID or registered email"
        }))]
    uid = resolved_uid

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FASTAPI_URL}/api/world-model/scopes/{uid}")
            if r.status_code == 404:
                return [TextContent(type="text", text=json.dumps({
                    "user_id": uid,
                    "domains": [],
                    "scopes": [],
                    "message": "No world model data for this user (new user or no domains yet)",
                    "usage": "Call request_consent with scope='world_model.read' or attr.{domain}.* after user adds data"
                }))]
            r.raise_for_status()
            data = r.json()
    except httpx.ConnectError as e:
        logger.warning(f"⚠️ Discover domains: backend not reachable: {e}")
        return [TextContent(type="text", text=json.dumps({
            "error": "Cannot reach backend",
            "message": str(e),
            "hint": f"Ensure FastAPI is running at {FASTAPI_URL}"
        }))]
    except Exception as e:
        logger.exception("Discover user domains failed")
        return [TextContent(type="text", text=json.dumps({
            "error": "discover_failed",
            "message": str(e)
        }))]

    scopes = data.get("scopes") or []
    domains = []
    for s in scopes:
        m = re.match(r"^attr\.([a-zA-Z0-9_]+)\.\*$", s)
        if m:
            domains.append(m.group(1))

    return [TextContent(type="text", text=json.dumps({
        "user_id": data.get("user_id", uid),
        "domains": domains,
        "scopes": scopes,
        "usage": "Call request_consent(user_id, scope) with one of the scopes above to request consent"
    }))]
