# mcp/tools/utility_tools.py
"""
Utility tool handlers (validate_token, delegate, list_scopes).
"""

import json
import logging

from mcp.types import TextContent

from hushh_mcp.consent.token import validate_token
from hushh_mcp.trust.link import create_trust_link, verify_trust_link
from hushh_mcp.constants import ConsentScope, AGENT_PORTS
from hushh_mcp.types import UserID, AgentID

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
    
    # Determine expected scope if provided
    expected_scope = None
    if expected_scope_str:
        scope_map = {
            "vault.read.food": ConsentScope.VAULT_READ_FOOD,
            "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
            "vault.read.finance": ConsentScope.VAULT_READ_FINANCE,
        }
        expected_scope = scope_map.get(expected_scope_str)
    
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
    scope_map = {
        "vault.read.food": ConsentScope.VAULT_READ_FOOD,
        "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "agent.food.collect": ConsentScope.AGENT_FOOD_COLLECT,
    }
    scope = scope_map.get(scope_str, ConsentScope.CUSTOM_TEMPORARY)
    
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
    List all available consent scopes.
    
    Purpose: Transparency - users and developers can see what data categories exist
    """
    scopes = [
        {
            "scope": "vault.read.food",
            "emoji": "🍽️",
            "description": "Read food preferences (dietary, cuisines, budget)",
            "data_fields": ["dietary_restrictions", "favorite_cuisines", "monthly_budget", "allergies", "meal_preferences"],
            "sensitivity": "medium"
        },
        {
            "scope": "vault.read.professional",
            "emoji": "💼",
            "description": "Read professional profile (title, skills, experience)",
            "data_fields": ["title", "skills", "experience_level", "job_preferences", "certifications"],
            "sensitivity": "medium"
        },
        {
            "scope": "vault.read.finance",
            "emoji": "💰",
            "description": "Read financial data (budget, transactions)",
            "data_fields": ["monthly_budget", "spending_categories", "savings_goals"],
            "sensitivity": "high"
        },
    ]
    
    return [TextContent(type="text", text=json.dumps({
        "available_scopes": scopes,
        "total_scopes": len(scopes),
        "usage": "Call request_consent with user_id and desired scope to obtain a consent token",
        "privacy_principle": "Each scope requires separate, explicit user consent",
        "security_note": "vault.read.all is NOT available via MCP - full data access requires the Hushh portal.",
        "hushh_promise": "Your data is never accessed without your permission."
    }))]
