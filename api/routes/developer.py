from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from api.models.schemas import ConsentRequest
from hushh_mcp.consent.scope_helpers import get_scope_description, normalize_scope
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Developer API"])

_STATIC_REQUESTABLE_SCOPES = ("world_model.read", "world_model.write")
_MAX_EXPIRY_HOURS = 24 * 365


class DeveloperScopeDescriptor(BaseModel):
    name: str
    description: str
    dynamic: bool = False
    requires_discovery: bool = False


class DeveloperScopeCatalogResponse(BaseModel):
    version: str = "v1"
    scopes_are_dynamic: bool = True
    discovery_required: bool = True
    scopes: list[DeveloperScopeDescriptor]
    discovery_endpoint: str = "/api/v1/user-scopes/{user_id}"
    request_endpoint: str = "/api/v1/request-consent"
    mcp_tools: list[str] = Field(
        default_factory=lambda: [
            "discover_user_domains",
            "request_consent",
            "check_consent_status",
            "get_scoped_data",
        ]
    )
    mcp_resources: list[str] = Field(
        default_factory=lambda: [
            "hushh://info/connector",
            "hushh://info/developer-api",
        ]
    )
    recommended_flow: list[str] = Field(
        default_factory=lambda: [
            "discover_user_domains",
            "request_consent",
            "check_consent_status",
            "get_scoped_data",
        ]
    )
    notes: list[str] = Field(
        default_factory=lambda: [
            "Do not hardcode domain keys. Discover available scopes per user at runtime.",
            "Dynamic attr scopes are derived from world_model_index_v2.available_domains, domain summaries, and domain_registry metadata.",
            "Legacy named domain getters remain compatibility surfaces only; new integrations should use get_scoped_data.",
        ]
    )


class DeveloperUserScopesResponse(BaseModel):
    user_id: str
    available_domains: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
    scopes_are_dynamic: bool = True
    source: str = "world_model_index_v2 + domain_registry"


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.getenv(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _developer_api_enabled() -> bool:
    environment = str(os.getenv("ENVIRONMENT", "development")).strip().lower()
    if environment == "production":
        return _env_truthy("DEVELOPER_API_ENABLED", "false")
    return _env_truthy("DEVELOPER_API_ENABLED", "true")


def _consent_timeout_seconds() -> int:
    raw = str(os.getenv("CONSENT_TIMEOUT_SECONDS", "120")).strip()
    try:
        return max(30, int(raw))
    except ValueError:
        return 120


def _developer_api_disabled_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "error_code": "DEVELOPER_API_DISABLED_IN_PRODUCTION",
            "message": "Developer API is disabled in production.",
        },
    )


def _require_developer_token(
    *,
    header_token: str | None = None,
    body_token: str | None = None,
) -> str:
    if not _developer_api_enabled():
        raise _developer_api_disabled_error()

    required_token = str(os.getenv("MCP_DEVELOPER_TOKEN", "")).strip()
    if not required_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "DEVELOPER_API_NOT_CONFIGURED",
                "message": "Developer API is not configured.",
            },
        )

    provided = (header_token or body_token or "").strip()
    if not provided:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "DEVELOPER_TOKEN_REQUIRED",
                "message": "Developer token is required.",
            },
        )
    if provided != required_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "DEVELOPER_TOKEN_INVALID",
                "message": "Developer token is invalid.",
            },
        )
    return provided


def _normalize_agent_id(value: str | None) -> str:
    raw = str(value or "").strip()
    return raw or "hushh-mcp"


def _is_supported_scope(scope: str) -> bool:
    if scope in _STATIC_REQUESTABLE_SCOPES:
        return True
    return scope.startswith("attr.")


def _scope_catalog() -> list[DeveloperScopeDescriptor]:
    return [
        DeveloperScopeDescriptor(
            name="world_model.read",
            description="Read the full user world model (all discovered domains).",
        ),
        DeveloperScopeDescriptor(
            name="world_model.write",
            description="Write to the user world model in governed flows.",
        ),
        DeveloperScopeDescriptor(
            name="attr.{domain}.*",
            description="Read one discovered domain branch.",
            dynamic=True,
            requires_discovery=True,
        ),
        DeveloperScopeDescriptor(
            name="attr.{domain}.{subintent}.*",
            description="Read one discovered nested branch when metadata exposes subintents.",
            dynamic=True,
            requires_discovery=True,
        ),
        DeveloperScopeDescriptor(
            name="attr.{domain}.{path}",
            description="Read one specific discovered path.",
            dynamic=True,
            requires_discovery=True,
        ),
    ]


async def _get_user_scope_snapshot(user_id: str) -> tuple[list[str], list[str]]:
    world_model = get_world_model_service()
    index = await world_model.get_index_v2(user_id)
    if index is None:
        return [], []
    available_domains = sorted(
        {
            str(domain).strip().lower()
            for domain in (index.available_domains or [])
            if str(domain).strip()
        }
    )
    scopes = sorted(await world_model.scope_generator.get_available_scopes(user_id))
    return available_domains, scopes


@router.get("/list-scopes", response_model=DeveloperScopeCatalogResponse)
async def list_scopes():
    """
    Return the public developer scope catalog.

    This endpoint is intentionally generic: it documents canonical scope patterns
    but does not expose user-specific domain availability.
    """
    if not _developer_api_enabled():
        raise _developer_api_disabled_error()

    return DeveloperScopeCatalogResponse(scopes=_scope_catalog())


@router.get("")
async def developer_api_root():
    """Return a lightweight versioned contract summary for external developers."""
    if not _developer_api_enabled():
        raise _developer_api_disabled_error()

    return {
        "version": "v1",
        "dynamic_scopes": True,
        "endpoints": {
            "list_scopes": "/api/v1/list-scopes",
            "user_scopes": "/api/v1/user-scopes/{user_id}",
            "request_consent": "/api/v1/request-consent",
        },
        "recommended_resources": [
            "hushh://info/connector",
            "hushh://info/developer-api",
        ],
        "recommended_mcp_flow": [
            "discover_user_domains",
            "request_consent",
            "check_consent_status",
            "get_scoped_data",
        ],
        "compatibility_tools": [
            "get_financial_profile",
            "get_food_preferences",
            "get_professional_profile",
        ],
    }


@router.get("/user-scopes/{user_id}", response_model=DeveloperUserScopesResponse)
async def get_user_scopes(
    user_id: str,
    x_mcp_developer_token: Optional[str] = Header(None, alias="X-MCP-Developer-Token"),
):
    """
    Return developer-consumable dynamic scopes for a user.

    This is the publishable developer-token wrapper around runtime scope discovery.
    """
    _require_developer_token(header_token=x_mcp_developer_token)

    available_domains, scopes = await _get_user_scope_snapshot(user_id)
    return DeveloperUserScopesResponse(
        user_id=user_id,
        available_domains=available_domains,
        scopes=scopes,
    )


@router.post("/request-consent")
async def request_consent(
    payload: ConsentRequest,
    x_mcp_developer_token: Optional[str] = Header(None, alias="X-MCP-Developer-Token"),
):
    """
    Create a developer consent request for a dynamic scope.

    This route is designed for MCP hosts and external developer clients.
    """
    _require_developer_token(
        header_token=x_mcp_developer_token,
        body_token=payload.developer_token,
    )

    normalized_scope = normalize_scope(payload.scope)
    if not _is_supported_scope(normalized_scope):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_SCOPE",
                "message": f"Unsupported scope: {payload.scope}",
                "valid_scopes": [descriptor.name for descriptor in _scope_catalog()],
            },
        )

    if payload.expiry_hours <= 0 or payload.expiry_hours > _MAX_EXPIRY_HOURS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_EXPIRY_HOURS",
                "message": f"expiry_hours must be between 1 and {_MAX_EXPIRY_HOURS}",
            },
        )

    available_domains, discovered_scopes = await _get_user_scope_snapshot(payload.user_id)
    if normalized_scope.startswith("attr.") and normalized_scope not in set(discovered_scopes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "SCOPE_NOT_DISCOVERED_FOR_USER",
                "message": "Requested scope is not available for this user.",
                "discovery_hint": "Call GET /api/v1/user-scopes/{user_id} first and request one of the returned scopes.",
                "available_domains": available_domains,
            },
        )

    agent_id = _normalize_agent_id(payload.agent_id)
    service = ConsentDBService()

    active_tokens = await service.get_active_tokens(
        payload.user_id,
        agent_id=agent_id,
        scope=normalized_scope,
    )
    if active_tokens:
        active = active_tokens[0]
        logger.info(
            "developer_api.request_consent.reused scope=%s agent_id=%s", normalized_scope, agent_id
        )
        return {
            "status": "already_granted",
            "message": "Consent already active for this developer app and scope.",
            "consent_token": active.get("token_id"),
            "expires_at": active.get("expires_at"),
            "request_id": active.get("request_id"),
            "scope": normalized_scope,
            "agent_id": agent_id,
        }

    if await service.was_recently_denied(payload.user_id, normalized_scope):
        return {
            "status": "denied_recently",
            "message": "This scope was recently denied. Wait before sending another request.",
            "scope": normalized_scope,
            "agent_id": agent_id,
        }

    request_id = f"req_{uuid.uuid4().hex}"
    now_ms = int(time.time() * 1000)
    poll_timeout_at = now_ms + (_consent_timeout_seconds() * 1000)
    scope_description = get_scope_description(normalized_scope)

    await service.insert_event(
        user_id=payload.user_id,
        agent_id=agent_id,
        scope=normalized_scope,
        action="REQUESTED",
        request_id=request_id,
        scope_description=scope_description,
        poll_timeout_at=poll_timeout_at,
        metadata={
            "expiry_hours": payload.expiry_hours,
            "request_source": "developer_api_v1",
            **({"reason": payload.reason} if payload.reason else {}),
        },
    )

    logger.info(
        "developer_api.request_consent.created scope=%s agent_id=%s", normalized_scope, agent_id
    )
    return {
        "status": "pending",
        "message": "Consent request submitted. User approval is pending in the Hushh app.",
        "request_id": request_id,
        "scope": normalized_scope,
        "scope_description": scope_description,
        "poll_timeout_at": poll_timeout_at,
        "expires_in_hours": payload.expiry_hours,
        "agent_id": agent_id,
        "approval_surface": "/consents",
    }
