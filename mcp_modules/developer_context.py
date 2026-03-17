from __future__ import annotations

import os
from contextvars import ContextVar, Token

from hushh_mcp.services.developer_registry_service import (
    DEFAULT_PUBLIC_TOOL_GROUPS,
    DeveloperPrincipal,
    DeveloperRegistryService,
    visible_tool_names_for_groups,
)

_current_developer_principal: ContextVar[DeveloperPrincipal | None] = ContextVar(
    "hushh_mcp_developer_principal",
    default=None,
)
_current_developer_api_key: ContextVar[str | None] = ContextVar(
    "hushh_mcp_developer_api_key",
    default=None,
)


def _configured_api_key() -> str:
    return str(os.getenv("HUSHH_DEVELOPER_API_KEY", "")).strip()


def set_current_developer_principal(
    principal: DeveloperPrincipal | None,
    *,
    api_key: str | None = None,
) -> tuple[Token, Token]:
    principal_token = _current_developer_principal.set(principal)
    api_key_token = _current_developer_api_key.set(api_key)
    return principal_token, api_key_token


def reset_current_developer_principal(tokens: tuple[Token, Token]) -> None:
    principal_token, api_key_token = tokens
    _current_developer_principal.reset(principal_token)
    _current_developer_api_key.reset(api_key_token)


def get_current_developer_principal() -> DeveloperPrincipal | None:
    principal = _current_developer_principal.get()
    if principal is not None:
        return principal

    raw_api_key = _configured_api_key()
    if not raw_api_key:
        return None
    return DeveloperRegistryService().authenticate_token(raw_api_key)


def get_current_visible_tool_names() -> tuple[str, ...]:
    principal = get_current_developer_principal()
    if principal is None:
        return visible_tool_names_for_groups(DEFAULT_PUBLIC_TOOL_GROUPS)
    return visible_tool_names_for_groups(principal.allowed_tool_groups)


def is_tool_allowed(tool_name: str) -> bool:
    return tool_name in set(get_current_visible_tool_names())


def get_developer_request_headers() -> dict[str, str]:
    raw_api_key = _current_developer_api_key.get() or _configured_api_key()
    if not raw_api_key:
        return {}
    return {"Authorization": f"Bearer {raw_api_key}"}
