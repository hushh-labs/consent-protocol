# mcp/tools/consent_tools.py
"""
Consent request and status check handlers.

Only world-model scopes are supported: world_model.read, world_model.write, attr.{domain}.*

Regulated cutover note:
- request_consent no longer performs blocking SSE/poll waits for consent resolution.
- caller receives `pending` and must wait for user approval in-app (FCM-driven flow).
"""

import json
import logging
from typing import Optional

import httpx
from mcp.types import TextContent

from mcp_modules.config import (
    FASTAPI_URL,
    FRONTEND_URL,
    MCP_DEVELOPER_TOKEN,
    PRODUCTION_MODE,
    SCOPE_API_MAP,
    resolve_scope_api,
)

logger = logging.getLogger("hushh-mcp-server")


async def resolve_email_to_uid(user_id: str) -> tuple[Optional[str], str | None, str | None]:
    """
    If user_id is an email, resolve to Firebase UID.
    Returns (user_id, email, display_name).
    """
    if not user_id or "@" not in user_id:
        return user_id, None, None

    if not MCP_DEVELOPER_TOKEN:
        logger.warning("Email-to-UID lookup skipped: MCP_DEVELOPER_TOKEN not configured")
        return user_id, None, None

    try:
        async with httpx.AsyncClient() as client:
            lookup_response = await client.get(
                f"{FASTAPI_URL}/api/user/lookup",
                params={"email": user_id},
                headers={"X-MCP-Developer-Token": MCP_DEVELOPER_TOKEN},
                timeout=5.0,
            )

            if lookup_response.status_code == 200:
                lookup_data = lookup_response.json()
                if lookup_data.get("exists"):
                    resolved_uid = lookup_data["user_id"]
                    email = lookup_data.get("email")
                    display_name = lookup_data.get("display_name")
                    logger.info("Resolved email to uid for consent request")
                    return resolved_uid, email, display_name
                return None, user_id, None

            logger.warning("Email lookup failed with status=%s", lookup_response.status_code)
    except Exception as e:
        logger.warning("Email lookup failed: %s", e)

    return user_id, None, None


async def handle_request_consent(args: dict) -> list[TextContent]:
    """
    Request consent from a user.

    In production, this endpoint returns:
    - granted: if already granted
    - pending: user must approve in Hushh app/dashboard
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")

    original_identifier = user_id
    user_id, user_email, user_display_name = await resolve_email_to_uid(user_id)

    if user_id is None:
        frontend_url = FRONTEND_URL
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "user_not_found",
                        "email": original_identifier,
                        "message": f"No Hushh account found for {original_identifier}",
                        "signup_url": f"{frontend_url}/login",
                    }
                ),
            )
        ]

    scope_api = resolve_scope_api(scope_str)
    if not scope_api:
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "error": f"Invalid scope: {scope_str}",
                        "valid_scopes": list(SCOPE_API_MAP.keys())
                        + ["attr.{domain}.*  (any domain)"],
                        "hint": "Use list_scopes tool to see available options, or use attr.<domain>.*",
                    }
                ),
            )
        ]

    if not PRODUCTION_MODE:
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "error": "Production mode requires explicit user consent",
                        "message": "Auto-granting tokens is disabled.",
                    }
                ),
            )
        ]

    display_id = user_display_name or user_email or user_id
    logger.info("Requesting consent for %s / %s", display_id, scope_str)

    try:
        async with httpx.AsyncClient() as client:
            create_response = await client.post(
                f"{FASTAPI_URL}/api/v1/request-consent",
                json={
                    "developer_token": MCP_DEVELOPER_TOKEN,
                    "user_id": user_id,
                    "scope": scope_api,
                    "expiry_hours": 24,
                },
                timeout=10.0,
            )

            if create_response.status_code != 200:
                error_detail = create_response.json().get("detail", "Unknown error")
                return [
                    TextContent(
                        type="text",
                        text=json.dumps(
                            {
                                "status": "error",
                                "error": error_detail,
                                "hint": "Check backend availability and developer registration.",
                            }
                        ),
                    )
                ]

            data = create_response.json()
            status = data.get("status")

            if status == "already_granted":
                return [
                    TextContent(
                        type="text",
                        text=json.dumps(
                            {
                                "status": "granted",
                                "consent_token": data.get("consent_token"),
                                "user_id": user_id,
                                "scope": scope_str,
                                "message": "Consent already granted.",
                            }
                        ),
                    )
                ]

            request_id = data.get("request_id")
            if not request_id:
                message = data.get("message", "")
                if "Request ID:" in message:
                    request_id = message.split("Request ID:")[-1].strip()

            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "pending",
                            "user_id": user_id,
                            "scope": scope_str,
                            "request_id": request_id,
                            "message": "Consent request submitted. User approval is pending in Hushh app.",
                            "dashboard_url": f"{FRONTEND_URL}/consents?tab=pending",
                            "next_step": "Call check_consent_status later, or wait for user confirmation.",
                        }
                    ),
                )
            ]

    except httpx.ConnectError as e:
        logger.error("Consent backend unavailable at %s: %s", FASTAPI_URL, e)
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "error": "Consent backend unavailable",
                        "message": f"Cannot reach consent server at {FASTAPI_URL}.",
                    }
                ),
            )
        ]
    except Exception as e:
        logger.error("Error requesting consent: %s", e)
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "error": "Consent request failed",
                    }
                ),
            )
        ]


async def handle_check_consent_status(args: dict) -> list[TextContent]:
    """
    Check consent status - returns active token if available, or pending status.
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")

    original_identifier = user_id
    user_id, _user_email, _user_display_name = await resolve_email_to_uid(user_id)

    if user_id is None:
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "user_not_found",
                        "email": original_identifier,
                        "message": f"No Hushh account found for {original_identifier}",
                    }
                ),
            )
        ]

    logger.info("Checking consent status user=%s scope=%s", user_id, scope_str)

    try:
        # Note: These endpoints require VAULT_OWNER auth. If unavailable, we return
        # a pending/not_found response instead of polling consent events.
        async with httpx.AsyncClient() as client:
            active_response = await client.get(
                f"{FASTAPI_URL}/api/consent/active",
                params={"userId": user_id},
                timeout=10.0,
            )

            if active_response.status_code == 200:
                active_list = active_response.json().get("active", [])
                active_token = next((t for t in active_list if t.get("scope") == scope_str), None)
                if active_token:
                    return [
                        TextContent(
                            type="text",
                            text=json.dumps(
                                {
                                    "status": "granted",
                                    "consent_token": active_token.get("token_id"),
                                    "user_id": user_id,
                                    "scope": scope_str,
                                    "expires_at": active_token.get("expiresAt"),
                                    "message": "Consent is active.",
                                }
                            ),
                        )
                    ]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "pending_or_unavailable",
                        "user_id": user_id,
                        "scope": scope_str,
                        "message": "Consent not yet active or status endpoint unavailable without user session.",
                    }
                ),
            )
        ]

    except httpx.ConnectError:
        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {
                        "status": "error",
                        "error": "Cannot connect to consent backend",
                        "hint": "Make sure FastAPI server is running on " + FASTAPI_URL,
                    }
                ),
            )
        ]
    except Exception as e:
        logger.error("Error checking consent status: %s", e)
        return [TextContent(type="text", text=json.dumps({"status": "error", "error": str(e)}))]
