from __future__ import annotations

import os

from fastapi import HTTPException, Request, status

from hushh_mcp.services.developer_registry_service import (
    DeveloperPrincipal,
    DeveloperRegistryService,
)


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.getenv(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def environment() -> str:
    return str(os.getenv("ENVIRONMENT", "development")).strip().lower()


def developer_api_enabled() -> bool:
    current_environment = environment()
    if current_environment == "production":
        return _env_truthy("DEVELOPER_API_ENABLED", "false")
    return _env_truthy("DEVELOPER_API_ENABLED", "true")


def remote_mcp_enabled() -> bool:
    if not developer_api_enabled():
        return False
    return _env_truthy("REMOTE_MCP_ENABLED", "false")


def developer_api_disabled_error() -> HTTPException:
    current_environment = environment()
    is_production = current_environment == "production"
    return HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "error_code": (
                "DEVELOPER_API_DISABLED_IN_PRODUCTION"
                if is_production
                else "DEVELOPER_API_DISABLED"
            ),
            "message": (
                "Developer API is disabled in production."
                if is_production
                else "Developer API is not enabled in this environment."
            ),
        },
    )


def remote_mcp_disabled_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "error_code": "REMOTE_MCP_DISABLED",
            "message": "Remote MCP is not enabled in this environment.",
        },
    )


def _resolve_bearer_token(authorization: str | None = None) -> str:
    bearer = str(authorization or "").strip()
    if bearer.lower().startswith("bearer "):
        return bearer[7:].strip()
    return ""


def _resolve_query_token(token: str | None = None) -> str:
    return str(token or "").strip()


def _developer_token_query_required_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "error_code": "DEVELOPER_TOKEN_QUERY_REQUIRED",
            "message": "Use ?token=<developer-token> instead of Authorization header for developer access.",
        },
    )


def authenticate_developer_principal(
    *,
    token: str | None = None,
    authorization: str | None = None,
    request: Request | None = None,
) -> DeveloperPrincipal:
    if not developer_api_enabled():
        raise developer_api_disabled_error()

    raw_token = _resolve_query_token(token)
    if not raw_token:
        if _resolve_bearer_token(authorization):
            raise _developer_token_query_required_error()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "DEVELOPER_TOKEN_REQUIRED",
                "message": "Developer token is required. Pass ?token=<developer-token>.",
            },
        )

    client_ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    principal = DeveloperRegistryService().authenticate_token(
        raw_token,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "DEVELOPER_TOKEN_INVALID",
                "message": "Developer token is invalid or revoked.",
            },
        )
    return principal


def try_authenticate_developer_principal(
    *,
    token: str | None = None,
    authorization: str | None = None,
    request: Request | None = None,
) -> DeveloperPrincipal | None:
    if not developer_api_enabled():
        return None

    raw_token = _resolve_query_token(token)
    if not raw_token:
        if _resolve_bearer_token(authorization):
            raise _developer_token_query_required_error()
        return None

    client_ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    return DeveloperRegistryService().authenticate_token(
        raw_token,
        ip_address=client_ip,
        user_agent=user_agent,
    )
