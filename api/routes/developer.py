# api/routes/developer.py
"""
Developer API v1 endpoints for external access with consent.

Only world-model scopes are supported: world_model.read, world_model.write,
attr.{domain}.*, and optional nested attr.{domain}.{subintent}.* scopes.
"""

import json
import logging
import os
import re
import time
import uuid

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from api.models import ConsentRequest, ConsentResponse, DataAccessRequest
from hushh_mcp.consent.scope_generator import get_scope_generator
from hushh_mcp.consent.scope_helpers import get_scope_description as get_dynamic_scope_description
from hushh_mcp.consent.scope_helpers import normalize_scope, resolve_scope_to_enum
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.domain_registry_service import get_domain_registry_service

# Well-known non-dynamic world-model scopes (dot notation).
_STATIC_WORLD_MODEL_SCOPES = {
    "world_model.read",
    "world_model.write",
}

# Pattern for dynamic attr scopes with optional nested subintent paths:
# - attr.{domain}.*
# - attr.{domain}.{subintent}.*
# - attr.{domain}.{subintent}.{attribute}
_DYNAMIC_ATTR_SCOPE_RE = re.compile(r"^attr\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*(?:\.\*)?$")


def _is_valid_world_model_scope(scope: str) -> bool:
    """Return True if *scope* is a recognized world-model scope (static or dynamic)."""
    if scope in _STATIC_WORLD_MODEL_SCOPES:
        return True
    return bool(_DYNAMIC_ATTR_SCOPE_RE.match(scope))


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Developer API"])
_DEVELOPER_API_DISABLED_PAYLOAD = {
    "error_code": "DEVELOPER_API_DISABLED_IN_PRODUCTION",
    "message": "Developer API is disabled in production.",
}


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.getenv(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _is_production() -> bool:
    environment = str(os.getenv("ENVIRONMENT", "development")).strip().lower()
    return environment == "production"


def _developer_api_enabled() -> bool:
    if _is_production():
        return False
    return _env_truthy("DEVELOPER_API_ENABLED", "true")


def _disabled_response_if_needed() -> JSONResponse | None:
    if _developer_api_enabled():
        return None
    return JSONResponse(status_code=410, content=_DEVELOPER_API_DISABLED_PAYLOAD)


def _load_registered_developers() -> dict[str, dict]:
    raw = str(os.getenv("DEVELOPER_REGISTRY_JSON", "")).strip()
    if not raw:
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("developer_api.registry_invalid_json")
        return {}

    if not isinstance(payload, dict):
        logger.error("developer_api.registry_invalid_shape")
        return {}

    registry: dict[str, dict] = {}
    for token, config in payload.items():
        if not isinstance(token, str) or not isinstance(config, dict):
            continue

        name = str(config.get("name", "")).strip()
        approved_scopes = config.get("approved_scopes")
        if not name or not isinstance(approved_scopes, list):
            continue
        if not all(isinstance(scope, str) and scope for scope in approved_scopes):
            continue

        registry[token] = {"name": name, "approved_scopes": approved_scopes}

    return registry


def _require_registered_developer(developer_token: str) -> dict:
    token = str(developer_token or "").strip()
    registered_developers = _load_registered_developers()
    if not registered_developers:
        logger.error("developer_api.registry_missing_or_empty")
        raise HTTPException(status_code=503, detail="Developer registry is not configured")
    dev_info = registered_developers.get(token)
    if not dev_info:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid developer token")
    return dev_info


def get_scope_description(scope: str) -> str:
    """
    Human-readable scope descriptions.

    Delegated to centralized dynamic scope resolution.
    """
    return str(get_dynamic_scope_description(scope))


@router.get("")
async def developer_api_root():
    """Welcome to Hushh Developer API."""
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled
    return {
        "message": "Welcome to Hushh Developer API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "POST /api/v1/request-consent",
            "POST /api/v1/food-data",
            "POST /api/v1/professional-data",
            "GET /api/v1/list-scopes",
            "GET /api/v1/user-scopes/{user_id}",
        ],
    }


@router.post("/request-consent", response_model=ConsentResponse)
async def request_consent(request: ConsentRequest):
    """
    Request consent from a user for data access.

    External developers call this to request permission to access
    specific user data. The user will be notified and must approve.

    Follows Hushh Core Principle: "Consent First"

    IMPORTANT: This does NOT auto-approve. User must explicitly approve
    via the /api/consent/pending/approve endpoint.
    """
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled

    logger.info("developer_api.request_consent scope=%s", request.scope)

    # Verify developer
    dev_info = _require_registered_developer(request.developer_token)

    # Normalize to dot notation for storage and validation (e.g. attr_food -> attr.food.*)
    scope_dot = normalize_scope(request.scope)
    if not _is_valid_world_model_scope(scope_dot):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid scope: {request.scope}. Use world_model.read/world_model.write "
                "or dynamic attr.{domain}.* / attr.{domain}.{subintent}.* scopes."
            ),
        )

    if scope_dot.startswith("attr."):
        scope_generator = get_scope_generator()
        if not await scope_generator.validate_scope(scope_dot, request.user_id):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Scope '{scope_dot}' is not available for this user. "
                    "Discover valid scopes first via /api/v1/user-scopes/{user_id}."
                ),
            )

    # Verify scope is allowed for this developer.
    approved = [normalize_scope(str(scope)) for scope in dev_info["approved_scopes"]]
    scope_generator = get_scope_generator()
    is_scope_approved = False
    for allowed_scope in approved:
        if allowed_scope == "*":
            is_scope_approved = True
            break
        if allowed_scope == scope_dot:
            is_scope_approved = True
            break
        # world_model.read is broader than any attr.* scope.
        if allowed_scope == "world_model.read" and scope_dot.startswith("attr."):
            is_scope_approved = True
            break
        # Allow narrower requests under approved wildcard paths.
        if allowed_scope.startswith("attr.") and scope_dot.startswith("attr."):
            if scope_generator.matches_wildcard(scope_dot, allowed_scope):
                is_scope_approved = True
                break

    if not is_scope_approved:
        raise HTTPException(
            status_code=403, detail=f"Scope '{scope_dot}' not approved for this developer"
        )

    # Resolve to enum for token issuance
    resolve_scope_to_enum(scope_dot)

    # Check if consent already granted (query database with dot notation)
    service = ConsentDBService()
    is_active = await service.is_token_active(
        request.user_id,
        scope_dot,
        dev_info["name"],
    )
    if is_active:
        # Fetch the active token to return it
        active_tokens = await service.get_active_tokens(
            request.user_id,
            agent_id=dev_info["name"],
            scope=scope_dot,
        )
        existing_token = None
        expires_at = None

        for t in active_tokens:
            existing_token = t.get("token_id")
            expires_at = t.get("expires_at")
            break

        if existing_token:
            return ConsentResponse(
                status="already_granted",
                message="User has already granted consent for this scope.",
                consent_token=existing_token,
                expires_at=expires_at,
            )

    # Check if request already pending (query database with dot notation)
    service = ConsentDBService()
    pending = await service.get_pending_requests(request.user_id)
    pending_for_scope = [p for p in pending if p.get("scope") == scope_dot]
    if pending_for_scope:
        existing_id = pending_for_scope[0].get("id") or pending_for_scope[0].get("request_id")
        return ConsentResponse(
            status="pending",
            message="Consent request already pending. Waiting for user approval.",
            request_id=existing_id,
        )

    # Generate a request ID
    request_id = str(uuid.uuid4())[:8]

    # Pending request lifetime: use expiry_hours (capped at 24) so request stays pending for long timeouts
    now_ms = int(time.time() * 1000)
    pending_hours = min(max(1, request.expiry_hours), 24)
    poll_timeout_at = now_ms + int(pending_hours * 3600 * 1000)

    # Store in database with dot notation scope (mandatory)
    service = ConsentDBService()
    await service.insert_event(
        user_id=request.user_id,
        agent_id=dev_info["name"],
        scope=scope_dot,
        action="REQUESTED",
        request_id=request_id,
        scope_description=get_scope_description(scope_dot),
        poll_timeout_at=poll_timeout_at,
        metadata={
            "developer_name": dev_info["name"],
            "expiry_hours": request.expiry_hours,
            **({"bid_value": request.bid_value} if request.bid_value is not None else {}),
        },
    )
    logger.info("developer_api.request_created request_id=%s scope=%s", request_id, scope_dot)

    return ConsentResponse(
        status="pending",
        message=f"Consent request submitted. User must approve in their dashboard. Request ID: {request_id}",
        request_id=request_id,
    )


@router.post("/food-data")
async def get_food_data(_request: DataAccessRequest):
    """Removed: use world-model for domain data."""
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled
    raise HTTPException(status_code=410, detail="Gone. Use world-model API for domain data.")


@router.post("/professional-data")
async def get_professional_data(_request: DataAccessRequest):
    """Removed: use world-model for domain data."""
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled
    raise HTTPException(status_code=410, detail="Gone. Use world-model API for domain data.")


@router.get("/list-scopes")
async def list_available_scopes():
    """
    List all available consent scopes (world-model only).

    Developers can reference this to understand what data they can request.
    Dynamic ``attr.{domain}.*`` scopes are accepted for any domain registered
    in the user's world model.
    """
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled

    scopes = [
        {"name": "world_model.read", "description": get_scope_description("world_model.read")},
        {"name": "world_model.write", "description": get_scope_description("world_model.write")},
    ]

    registry = get_domain_registry_service()
    await registry.ensure_canonical_domains()
    registry_domains = await registry.list_domains(include_empty=True)

    parent_domains = sorted(
        {
            str(domain.domain_key).strip().lower()
            for domain in registry_domains
            if not domain.parent_domain
        }
    )

    for domain_key in parent_domains:
        scopes.append(
            {
                "name": f"attr.{domain_key}.*",
                "description": get_scope_description(f"attr.{domain_key}.*"),
                "source": "domain_registry",
            }
        )

    for domain in registry_domains:
        parent_key = str(domain.parent_domain or "").strip().lower()
        if not parent_key:
            continue
        domain_key = str(domain.domain_key).strip().lower()
        if parent_key not in parent_domains:
            continue
        if domain_key.startswith(f"{parent_key}."):
            subintent = domain_key[len(parent_key) + 1 :]
        else:
            subintent = domain_key
        if not subintent:
            continue
        sub_scope = f"attr.{parent_key}.{subintent}.*"
        scopes.append(
            {
                "name": sub_scope,
                "description": get_scope_description(sub_scope),
                "source": "domain_registry",
            }
        )

    # Add contract templates for clients that construct user-specific requests dynamically.
    scopes.append(
        {
            "name": "attr.{domain}.*",
            "description": "Dynamic domain scope from user metadata (discover first).",
            "source": "template",
        }
    )
    scopes.append(
        {
            "name": "attr.{domain}.{subintent}.*",
            "description": "Dynamic subintent scope when domain metadata exposes subintents.",
            "source": "template",
        }
    )

    deduped = []
    seen = set()
    for row in scopes:
        name = row.get("name")
        if not isinstance(name, str) or not name or name in seen:
            continue
        seen.add(name)
        deduped.append(row)

    return {
        "scopes": deduped,
        "scopes_are_dynamic": True,
        "scope_pattern": "attr.{domain}.* and attr.{domain}.{subintent}.*",
        "note": "Per-user scope strings should be discovered via /api/v1/user-scopes/{user_id}.",
    }


@router.get("/user-scopes/{user_id}")
async def list_user_scopes(
    user_id: str,
    x_mcp_developer_token: str | None = Header(None, alias="X-MCP-Developer-Token"),
    developer_token: str | None = None,
):
    """
    Discover user-specific dynamic scope strings using developer auth.

    This endpoint is intended for MCP/tooling flows that need domain discovery
    before requesting user consent.
    """
    disabled = _disabled_response_if_needed()
    if disabled:
        return disabled

    token = str(x_mcp_developer_token or developer_token or "").strip()
    dev_info = _require_registered_developer(token)

    scope_generator = get_scope_generator()
    scopes = await scope_generator.get_available_scopes(user_id)

    approved_scopes = [normalize_scope(str(scope)) for scope in dev_info["approved_scopes"]]
    if "*" not in approved_scopes:
        filtered_scopes: list[str] = []
        for discovered_scope in scopes:
            allowed = False
            for approved_scope in approved_scopes:
                if approved_scope == discovered_scope:
                    allowed = True
                    break
                if approved_scope == "world_model.read" and discovered_scope.startswith("attr."):
                    allowed = True
                    break
                if approved_scope.startswith("attr.") and discovered_scope.startswith("attr."):
                    if scope_generator.matches_wildcard(discovered_scope, approved_scope):
                        allowed = True
                        break
            if allowed:
                filtered_scopes.append(discovered_scope)
        scopes = sorted(set(filtered_scopes))

    domains = sorted(
        {
            domain
            for scope in scopes
            for domain, _path, _is_wildcard in [scope_generator.parse_scope(scope)]
            if domain
        }
    )

    return {
        "user_id": user_id,
        "domains": domains,
        "scopes": scopes,
        "scopes_are_dynamic": True,
    }
