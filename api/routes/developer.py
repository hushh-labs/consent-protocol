from __future__ import annotations

import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

from api.developer_auth import (
    authenticate_developer_principal,
    developer_api_disabled_error,
    developer_api_enabled,
    try_authenticate_developer_principal,
)
from api.middleware import require_firebase_auth
from api.models.schemas import ConsentRequest
from api.utils.firebase_admin import get_firebase_auth_app
from hushh_mcp.consent.scope_helpers import get_scope_description, normalize_scope
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.developer_registry_service import (
    DEFAULT_PUBLIC_TOOL_GROUPS,
    DeveloperPrincipal,
    DeveloperRegistryService,
    normalize_tool_groups,
    visible_tool_names_for_groups,
)
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()
developer_api_router = APIRouter(prefix="/api/v1", tags=["Developer API"])
portal_router = APIRouter(prefix="/api/developer", tags=["Developer Portal"])

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
    tool_catalog_endpoint: str = "/api/v1/tool-catalog"
    mcp_tools: list[str] = Field(default_factory=list)
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
            "Use get_scoped_data for all consented reads; public named data getters are not supported.",
        ]
    )


class DeveloperUserScopesResponse(BaseModel):
    user_id: str
    available_domains: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
    scopes_are_dynamic: bool = True
    source: str = "world_model_index_v2 + domain_registry"
    app_id: str | None = None
    app_display_name: str | None = None


class DeveloperToolCatalogResponse(BaseModel):
    version: str = "v1"
    approval_required: bool = False
    allowed_tool_groups: list[str]
    compatibility_status: str
    tools: list[dict]
    tool_groups: list[dict]
    recommended_flow: list[str]
    notes: list[str]
    app_id: str | None = None
    app_display_name: str | None = None


class DeveloperConsentStatusResponse(BaseModel):
    status: str
    user_id: str
    scope: str | None = None
    request_id: str | None = None
    consent_token: str | None = None
    expires_at: int | None = None
    poll_timeout_at: int | None = None
    app_id: str | None = None
    app_display_name: str | None = None
    message: str


class DeveloperPortalApiKeyResponse(BaseModel):
    id: int
    app_id: str
    key_prefix: str
    label: str | None = None
    created_at: int
    revoked_at: int | None = None
    last_used_at: int | None = None


class DeveloperPortalAppResponse(BaseModel):
    app_id: str
    agent_id: str
    display_name: str
    contact_email: str
    support_url: str | None = None
    policy_url: str | None = None
    website_url: str | None = None
    status: str
    allowed_tool_groups: list[str]
    created_at: int
    updated_at: int


class DeveloperPortalAccessResponse(BaseModel):
    access_enabled: bool
    user_id: str
    owner_email: str | None = None
    owner_display_name: str | None = None
    owner_provider_ids: list[str] = Field(default_factory=list)
    app: DeveloperPortalAppResponse | None = None
    active_key: DeveloperPortalApiKeyResponse | None = None
    raw_api_key: str | None = None
    developer_api_key_env_var: str = "HUSHH_DEVELOPER_API_KEY"
    notes: list[str] = Field(
        default_factory=lambda: [
            "Use the developer API key in Authorization: Bearer <developer-api-key> for /api/v1 and remote MCP.",
            "User consent is still approved inside Kai one scope at a time.",
            "Dynamic scopes must be discovered per user before requesting consent.",
        ]
    )


class DeveloperPortalProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    support_url: str | None = Field(default=None, max_length=512)
    policy_url: str | None = Field(default=None, max_length=512)
    website_url: str | None = Field(default=None, max_length=512)


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


def _consent_timeout_seconds() -> int:
    raw = "120"
    try:
        import os

        raw = str(os.getenv("CONSENT_TIMEOUT_SECONDS", "120")).strip()
        return max(30, int(raw))
    except ValueError:
        return 120


def _is_supported_scope(scope: str) -> bool:
    if scope in _STATIC_REQUESTABLE_SCOPES:
        return True
    return scope.startswith("attr.")


def _resolve_principal(
    *,
    request: Request,
    authorization: str | None,
) -> DeveloperPrincipal:
    return authenticate_developer_principal(
        authorization=authorization,
        request=request,
    )


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


def _developer_root_payload() -> dict[str, object]:
    return {
        "version": "v1",
        "dynamic_scopes": True,
        "endpoints": {
            "list_scopes": "/api/v1/list-scopes",
            "tool_catalog": "/api/v1/tool-catalog",
            "user_scopes": "/api/v1/user-scopes/{user_id}",
            "request_consent": "/api/v1/request-consent",
            "consent_status": "/api/v1/consent-status",
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
        "public_beta_default_tool_groups": list(DEFAULT_PUBLIC_TOOL_GROUPS),
        "developer_access": {
            "mode": "self_serve",
            "portal": "/developers",
            "portal_api": {
                "access": "/api/developer/access",
                "enable": "/api/developer/access/enable",
                "profile": "/api/developer/access/profile",
                "rotate_key": "/api/developer/access/rotate-key",
            },
        },
    }


def _serialize_api_key(api_key: dict | None) -> DeveloperPortalApiKeyResponse | None:
    if not api_key:
        return None
    return DeveloperPortalApiKeyResponse(
        id=int(api_key["id"]),
        app_id=str(api_key["app_id"]),
        key_prefix=str(api_key["key_prefix"]),
        label=str(api_key["label"]) if api_key.get("label") else None,
        created_at=int(api_key["created_at"]),
        revoked_at=int(api_key["revoked_at"]) if api_key.get("revoked_at") else None,
        last_used_at=int(api_key["last_used_at"]) if api_key.get("last_used_at") else None,
    )


def _serialize_app(app: dict | None) -> DeveloperPortalAppResponse | None:
    if not app:
        return None
    allowed_groups = normalize_tool_groups(app.get("allowed_tool_groups"))
    return DeveloperPortalAppResponse(
        app_id=str(app["app_id"]),
        agent_id=str(app["agent_id"]),
        display_name=str(app["display_name"]),
        contact_email=str(app["contact_email"]),
        support_url=str(app["support_url"]) if app.get("support_url") else None,
        policy_url=str(app["policy_url"]) if app.get("policy_url") else None,
        website_url=str(app["website_url"]) if app.get("website_url") else None,
        status=str(app["status"]),
        allowed_tool_groups=list(allowed_groups),
        created_at=int(app["created_at"]),
        updated_at=int(app["updated_at"]),
    )


def _portal_access_response(
    *,
    firebase_uid: str,
    owner_email: str | None,
    owner_display_name: str | None,
    owner_provider_ids: list[str] | tuple[str, ...] | None,
    app: dict | None,
    active_key: dict | None,
    raw_api_key: str | None = None,
) -> DeveloperPortalAccessResponse:
    provider_ids = [str(item).strip() for item in (owner_provider_ids or []) if str(item).strip()]
    return DeveloperPortalAccessResponse(
        access_enabled=app is not None,
        user_id=firebase_uid,
        owner_email=owner_email,
        owner_display_name=owner_display_name,
        owner_provider_ids=provider_ids,
        app=_serialize_app(app),
        active_key=_serialize_api_key(active_key),
        raw_api_key=raw_api_key,
    )


def _resolve_firebase_owner_profile(firebase_uid: str) -> dict[str, object]:
    owner_email: str | None = None
    owner_display_name: str | None = None
    owner_provider_ids: list[str] = []

    try:
        from firebase_admin import auth as firebase_auth

        firebase_app = get_firebase_auth_app()
        if firebase_app is not None:
            user_record = firebase_auth.get_user(firebase_uid, app=firebase_app)
            owner_email = getattr(user_record, "email", None)
            owner_display_name = getattr(user_record, "display_name", None)
            owner_provider_ids = sorted(
                {
                    str(getattr(provider, "provider_id", "")).strip()
                    for provider in (getattr(user_record, "provider_data", None) or [])
                    if str(getattr(provider, "provider_id", "")).strip()
                }
            )
    except Exception as exc:
        logger.warning("developer.portal.profile_lookup_failed uid=%s error=%s", firebase_uid, exc)

    return {
        "owner_email": owner_email,
        "owner_display_name": owner_display_name,
        "owner_provider_ids": owner_provider_ids,
    }


@developer_api_router.get("/list-scopes", response_model=DeveloperScopeCatalogResponse)
async def list_scopes():
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    return DeveloperScopeCatalogResponse(
        scopes=_scope_catalog(),
        mcp_tools=list(visible_tool_names_for_groups(DEFAULT_PUBLIC_TOOL_GROUPS)),
    )


@developer_api_router.get("")
async def developer_api_root():
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    return _developer_root_payload()


@developer_api_router.get("/tool-catalog", response_model=DeveloperToolCatalogResponse)
async def get_tool_catalog(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    principal = try_authenticate_developer_principal(
        authorization=authorization,
        request=request,
    )
    payload = DeveloperRegistryService().get_tool_catalog(principal=principal)
    return DeveloperToolCatalogResponse(
        **payload,
        app_id=principal.app_id if principal else None,
        app_display_name=principal.display_name if principal else None,
    )


@developer_api_router.get("/user-scopes/{user_id}", response_model=DeveloperUserScopesResponse)
async def get_user_scopes(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    principal = _resolve_principal(
        request=request,
        authorization=authorization,
    )

    available_domains, scopes = await _get_user_scope_snapshot(user_id)
    return DeveloperUserScopesResponse(
        user_id=user_id,
        available_domains=available_domains,
        scopes=scopes,
        app_id=principal.app_id,
        app_display_name=principal.display_name,
    )


@developer_api_router.get("/consent-status", response_model=DeveloperConsentStatusResponse)
async def get_consent_status(
    request: Request,
    user_id: str = Query(..., alias="user_id"),
    scope: str | None = Query(default=None),
    request_id: str | None = Query(default=None),
    authorization: Optional[str] = Header(None),
):
    principal = _resolve_principal(
        request=request,
        authorization=authorization,
    )
    normalized_scope = normalize_scope(scope) if scope else None

    service = ConsentDBService()
    if normalized_scope:
        active_tokens = await service.get_active_tokens(
            user_id,
            agent_id=principal.agent_id,
            scope=normalized_scope,
        )
        if active_tokens:
            active = active_tokens[0]
            return DeveloperConsentStatusResponse(
                status="granted",
                user_id=user_id,
                scope=normalized_scope,
                request_id=active.get("request_id"),
                consent_token=active.get("token_id"),
                expires_at=active.get("expires_at"),
                app_id=principal.app_id,
                app_display_name=principal.display_name,
                message="Consent is active for this app and scope.",
            )

    if request_id:
        latest = await service.get_request_status(user_id, request_id)
        if latest and latest.get("agent_id") == principal.agent_id:
            latest_action = str(latest.get("action") or "").strip().upper()
            status_map = {
                "REQUESTED": "pending",
                "CONSENT_GRANTED": "granted",
                "CONSENT_DENIED": "denied",
                "TIMEOUT": "expired",
                "CANCELLED": "cancelled",
                "REVOKED": "revoked",
            }
            resolved_status = status_map.get(latest_action, "unknown")
            return DeveloperConsentStatusResponse(
                status=resolved_status,
                user_id=user_id,
                scope=latest.get("scope"),
                request_id=request_id,
                consent_token=latest.get("token_id"),
                expires_at=latest.get("expires_at"),
                poll_timeout_at=latest.get("poll_timeout_at"),
                app_id=principal.app_id,
                app_display_name=principal.display_name,
                message=f"Latest request action is {latest_action or 'UNKNOWN'}.",
            )

    return DeveloperConsentStatusResponse(
        status="not_found",
        user_id=user_id,
        scope=normalized_scope,
        request_id=request_id,
        app_id=principal.app_id,
        app_display_name=principal.display_name,
        message="No matching consent state was found for this app.",
    )


@developer_api_router.post("/request-consent")
async def request_consent(
    payload: ConsentRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    principal = _resolve_principal(
        request=request,
        authorization=authorization,
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

    service = ConsentDBService()
    active_tokens = await service.get_active_tokens(
        payload.user_id,
        agent_id=principal.agent_id,
        scope=normalized_scope,
    )
    if active_tokens:
        active = active_tokens[0]
        logger.info(
            "developer_api.request_consent.reused scope=%s app_id=%s",
            normalized_scope,
            principal.app_id,
        )
        return {
            "status": "already_granted",
            "message": "Consent already active for this developer app and scope.",
            "consent_token": active.get("token_id"),
            "expires_at": active.get("expires_at"),
            "request_id": active.get("request_id"),
            "scope": normalized_scope,
            "agent_id": principal.agent_id,
            "app_id": principal.app_id,
            "app_display_name": principal.display_name,
        }

    if await service.was_recently_denied(
        payload.user_id,
        normalized_scope,
        agent_id=principal.agent_id,
    ):
        return {
            "status": "denied_recently",
            "message": "This scope was recently denied. Wait before sending another request.",
            "scope": normalized_scope,
            "agent_id": principal.agent_id,
            "app_id": principal.app_id,
            "app_display_name": principal.display_name,
        }

    request_id = f"req_{uuid.uuid4().hex}"
    now_ms = int(time.time() * 1000)
    poll_timeout_at = now_ms + (_consent_timeout_seconds() * 1000)
    scope_description = get_scope_description(normalized_scope)
    metadata = DeveloperRegistryService.build_consent_metadata(
        principal,
        reason=payload.reason,
    )
    metadata.update({"expiry_hours": payload.expiry_hours})

    await service.insert_event(
        user_id=payload.user_id,
        agent_id=principal.agent_id,
        scope=normalized_scope,
        action="REQUESTED",
        request_id=request_id,
        scope_description=scope_description,
        poll_timeout_at=poll_timeout_at,
        metadata=metadata,
    )

    logger.info(
        "developer_api.request_consent.created scope=%s app_id=%s",
        normalized_scope,
        principal.app_id,
    )
    return {
        "status": "pending",
        "message": "Consent request submitted. User approval is pending in the Hushh app.",
        "request_id": request_id,
        "scope": normalized_scope,
        "scope_description": scope_description,
        "poll_timeout_at": poll_timeout_at,
        "expires_in_hours": payload.expiry_hours,
        "agent_id": principal.agent_id,
        "app_id": principal.app_id,
        "app_display_name": principal.display_name,
        "approval_surface": "/consents",
    }


@portal_router.get("/access", response_model=DeveloperPortalAccessResponse)
async def get_developer_access(
    firebase_uid: str = Depends(require_firebase_auth),
):
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    registry = DeveloperRegistryService()
    owner_profile = _resolve_firebase_owner_profile(firebase_uid)
    app = registry.get_app_by_owner_uid(firebase_uid)
    active_key = registry.get_active_api_key(app_id=str(app["app_id"])) if app else None
    return _portal_access_response(
        firebase_uid=firebase_uid,
        owner_email=owner_profile["owner_email"] if isinstance(owner_profile, dict) else None,
        owner_display_name=owner_profile["owner_display_name"]
        if isinstance(owner_profile, dict)
        else None,
        owner_provider_ids=owner_profile["owner_provider_ids"]
        if isinstance(owner_profile, dict)
        else [],
        app=app,
        active_key=active_key,
    )


@portal_router.post("/access/enable", response_model=DeveloperPortalAccessResponse)
async def enable_developer_access(
    firebase_uid: str = Depends(require_firebase_auth),
):
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    owner_profile = _resolve_firebase_owner_profile(firebase_uid)
    registry = DeveloperRegistryService()
    ensured = registry.ensure_self_serve_access(
        owner_firebase_uid=firebase_uid,
        owner_email=str(owner_profile.get("owner_email") or "").strip() or None,
        owner_display_name=str(owner_profile.get("owner_display_name") or "").strip() or None,
        owner_provider_ids=owner_profile.get("owner_provider_ids")
        if isinstance(owner_profile, dict)
        else [],
    )
    return _portal_access_response(
        firebase_uid=firebase_uid,
        owner_email=str(owner_profile.get("owner_email") or "").strip() or None,
        owner_display_name=str(owner_profile.get("owner_display_name") or "").strip() or None,
        owner_provider_ids=owner_profile.get("owner_provider_ids")
        if isinstance(owner_profile, dict)
        else [],
        app=ensured.get("app"),
        active_key=ensured.get("active_key"),
        raw_api_key=str(ensured.get("raw_api_key") or "").strip() or None,
    )


@portal_router.patch("/access/profile", response_model=DeveloperPortalAccessResponse)
async def update_developer_access_profile(
    payload: DeveloperPortalProfileUpdateRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    registry = DeveloperRegistryService()
    updated_app = registry.update_self_serve_profile(
        owner_firebase_uid=firebase_uid,
        display_name=payload.display_name,
        website_url=payload.website_url,
        support_url=payload.support_url,
        policy_url=payload.policy_url,
    )
    if updated_app is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DEVELOPER_ACCESS_NOT_ENABLED",
                "message": "Enable developer access before updating the app profile.",
            },
        )

    owner_profile = _resolve_firebase_owner_profile(firebase_uid)
    active_key = registry.get_active_api_key(app_id=str(updated_app["app_id"]))
    return _portal_access_response(
        firebase_uid=firebase_uid,
        owner_email=str(owner_profile.get("owner_email") or "").strip() or None,
        owner_display_name=str(owner_profile.get("owner_display_name") or "").strip() or None,
        owner_provider_ids=owner_profile.get("owner_provider_ids")
        if isinstance(owner_profile, dict)
        else [],
        app=updated_app,
        active_key=active_key,
    )


@portal_router.post("/access/rotate-key", response_model=DeveloperPortalAccessResponse)
async def rotate_developer_access_key(
    firebase_uid: str = Depends(require_firebase_auth),
):
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    registry = DeveloperRegistryService()
    rotated = registry.rotate_self_serve_api_key(owner_firebase_uid=firebase_uid)
    if rotated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DEVELOPER_ACCESS_NOT_ENABLED",
                "message": "Enable developer access before rotating an API key.",
            },
        )

    owner_profile = _resolve_firebase_owner_profile(firebase_uid)
    return _portal_access_response(
        firebase_uid=firebase_uid,
        owner_email=str(owner_profile.get("owner_email") or "").strip() or None,
        owner_display_name=str(owner_profile.get("owner_display_name") or "").strip() or None,
        owner_provider_ids=owner_profile.get("owner_provider_ids")
        if isinstance(owner_profile, dict)
        else [],
        app=rotated.get("app"),
        active_key=rotated.get("active_key"),
        raw_api_key=str(rotated.get("raw_api_key") or "").strip() or None,
    )


router.include_router(developer_api_router)
router.include_router(portal_router)
