from __future__ import annotations

import json
from typing import Any

from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

from api.developer_auth import remote_mcp_disabled_error, remote_mcp_enabled
from hushh_mcp.services.developer_registry_service import DeveloperRegistryService
from mcp_modules.developer_context import (
    reset_current_developer_principal,
    set_current_developer_principal,
)
from mcp_server import server as mcp_server


def _header_value(scope: dict[str, Any], header_name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key.lower() == header_name:
            return value.decode("utf-8").strip()
    return None


def _client_ip(scope: dict[str, Any]) -> str | None:
    client = scope.get("client")
    if isinstance(client, tuple) and client:
        return str(client[0])
    return None


def _parse_api_key(scope: dict[str, Any]) -> str:
    authorization = _header_value(scope, b"authorization") or ""
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


async def _send_json(send, status_code: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    await send({"type": "http.response.start", "status": status_code, "headers": headers})
    await send({"type": "http.response.body", "body": body, "more_body": False})


class _StreamableHTTPASGIApp:
    def __init__(self, session_manager: StreamableHTTPSessionManager):
        self.session_manager = session_manager

    async def __call__(self, scope, receive, send) -> None:
        await self.session_manager.handle_request(scope, receive, send)


class AuthenticatedRemoteMCPApp:
    def __init__(self, session_manager: StreamableHTTPSessionManager):
        self._registry = DeveloperRegistryService()
        self._inner = _StreamableHTTPASGIApp(session_manager)

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") != "http":
            await _send_json(send, 404, {"detail": "Not found"})
            return

        if not remote_mcp_enabled():
            exc = remote_mcp_disabled_error()
            await _send_json(send, exc.status_code, exc.detail)
            return

        raw_api_key = _parse_api_key(scope)
        if not raw_api_key:
            await _send_json(
                send,
                401,
                {
                    "error_code": "DEVELOPER_TOKEN_REQUIRED",
                    "message": "Developer API key is required for remote MCP.",
                },
            )
            return

        principal = self._registry.authenticate_token(
            raw_api_key,
            ip_address=_client_ip(scope),
            user_agent=_header_value(scope, b"user-agent"),
        )
        if principal is None:
            await _send_json(
                send,
                403,
                {
                    "error_code": "DEVELOPER_TOKEN_INVALID",
                    "message": "Developer API key is invalid or revoked.",
                },
            )
            return

        context_tokens = set_current_developer_principal(principal, api_key=raw_api_key)
        try:
            await self._inner(scope, receive, send)
        finally:
            reset_current_developer_principal(context_tokens)


_session_manager = StreamableHTTPSessionManager(
    app=mcp_server,
    json_response=False,
    stateless=True,
)
remote_mcp_app = AuthenticatedRemoteMCPApp(_session_manager)
_session_manager_lifespan = None


async def startup_remote_mcp() -> None:
    global _session_manager_lifespan
    if _session_manager_lifespan is not None:
        return
    _session_manager_lifespan = _session_manager.run()
    await _session_manager_lifespan.__aenter__()


async def shutdown_remote_mcp() -> None:
    global _session_manager_lifespan
    if _session_manager_lifespan is None:
        return
    await _session_manager_lifespan.__aexit__(None, None, None)
    _session_manager_lifespan = None
