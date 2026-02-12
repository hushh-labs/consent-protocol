# mcp/tools/consent_tools.py
"""
Consent request and status check handlers.

Only world-model scopes are supported: world_model.read, world_model.write, attr.{domain}.*
"""

import json
import logging

import httpx
from mcp.types import TextContent

from mcp_modules.config import (
    CONSENT_POLL_INTERVAL_SECONDS,
    CONSENT_TIMEOUT_SECONDS,
    FASTAPI_URL,
    FRONTEND_URL,
    MCP_DEVELOPER_TOKEN,
    PRODUCTION_MODE,
    SCOPE_API_MAP,
    resolve_scope_api,
)

logger = logging.getLogger("hushh-mcp-server")


async def resolve_email_to_uid(user_id: str) -> tuple[str, str | None, str | None]:
    """
    If user_id is an email, resolve to Firebase UID.
    Returns (user_id, email, display_name).
    """
    if not user_id or "@" not in user_id:
        return user_id, None, None

    logger.info(f"📧 Detected email address: {user_id}")

    try:
        async with httpx.AsyncClient() as client:
            lookup_response = await client.get(
                f"{FASTAPI_URL}/api/user/lookup", params={"email": user_id}, timeout=5.0
            )

            if lookup_response.status_code == 200:
                lookup_data = lookup_response.json()

                if lookup_data.get("exists"):
                    resolved_uid = lookup_data["user_id"]
                    email = lookup_data["email"]
                    display_name = lookup_data.get("display_name", email.split("@")[0])
                    logger.info(f"✅ Resolved {user_id} → {resolved_uid} ({display_name})")
                    return resolved_uid, email, display_name
                else:
                    return None, user_id, None  # User not found

    except Exception as e:
        logger.warning(f"⚠️ Email lookup failed: {e}")

    return user_id, None, None


async def handle_request_consent(args: dict) -> list[TextContent]:
    """
    Request consent from a user with BLOCKING POLL until approved.

    PRODUCTION MODE (BLOCKING):
    1. Creates pending request in FastAPI backend
    2. WAITS for user to approve via dashboard (polls every few seconds)
    3. Returns token ONLY after user explicitly approves
    4. Times out after configurable period

    Compliance:
    ✅ HushhMCP: Consent First - NO data access without explicit approval
    ✅ HushhMCP: User must actively approve in dashboard
    ✅ HushhMCP: Cryptographic token only after human consent
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")

    # Email resolution
    original_identifier = user_id
    user_id, user_email, user_display_name = await resolve_email_to_uid(user_id)

    # User not found
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
                        "suggestion": f"The user needs to create a Hushh account first at {frontend_url}/login",
                        "action_required": "User must sign up before data can be requested.",
                        "next_steps": [
                            f"1. Ask the user to visit {frontend_url}/login",
                            "2. They can sign in with Google or email",
                            "3. Complete the passphrase setup to secure their vault",
                            "4. Then request consent again",
                        ],
                    }
                ),
            )
        ]

    # Validate scope (supports dynamic attr.{domain}.* scopes)
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
                        "hint": "Use list_scopes tool to see available options, or use attr.<domain>.* for any domain",
                    }
                ),
            )
        ]

    # Production mode
    if PRODUCTION_MODE:
        display_id = user_display_name or user_email or user_id
        logger.info(f"🔐 PRODUCTION MODE: Requesting consent for {display_id}/{scope_str}")
        logger.info(
            f"   ⏱️ Timeout: {CONSENT_TIMEOUT_SECONDS}s, Poll interval: {CONSENT_POLL_INTERVAL_SECONDS}s"
        )

        try:
            async with httpx.AsyncClient() as client:
                # Step 1: Create pending consent request
                logger.info("📤 Creating pending consent request in FastAPI...")

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
                    logger.error(f"❌ FastAPI error creating request: {error_detail}")
                    return [
                        TextContent(
                            type="text",
                            text=json.dumps(
                                {
                                    "status": "error",
                                    "error": error_detail,
                                    "hint": "Check if FastAPI is running and developer is registered",
                                }
                            ),
                        )
                    ]

                data = create_response.json()
                status = data.get("status")

                # Already granted
                if status == "already_granted":
                    logger.info("✅ Consent already granted - returning existing token")
                    return [
                        TextContent(
                            type="text",
                            text=json.dumps(
                                {
                                    "status": "granted",
                                    "consent_token": data.get("consent_token"),
                                    "user_id": user_id,
                                    "scope": scope_str,
                                    "message": "✅ Consent already granted. Use this token to access data.",
                                }
                            ),
                        )
                    ]

                # Pending - wait for approval via SSE (efficient server-push)
                if status == "pending":
                    # Prefer request_id from response JSON (backend now returns it)
                    request_id = data.get("request_id")
                    if not request_id:
                        message = data.get("message", "")
                        if "Request ID:" in message:
                            request_id = message.split("Request ID:")[-1].strip()
                    if not request_id:
                        # Fetch pending to get request_id
                        pending_response = await client.get(
                            f"{FASTAPI_URL}/api/consent/pending",
                            params={"userId": user_id},
                            timeout=10.0,
                        )
                        if pending_response.status_code == 200:
                            pending_list = pending_response.json().get("pending", [])
                            for req in pending_list:
                                # DB now stores dot notation scope
                                if req.get("scope") == scope_str:
                                    request_id = req.get("id")
                                    break

                    if not request_id:
                        logger.error("❌ Could not find request_id for pending consent")
                        return [
                            TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "error",
                                        "error": "Could not track consent request",
                                        "message": "Failed to find request ID for the pending consent",
                                    }
                                ),
                            )
                        ]

                    logger.info(f"📋 Consent request created (ID: {request_id})")
                    logger.info(
                        "🔌 Using SSE to wait for user approval (user must have Hushh app consent page open to see the request)..."
                    )

                    # Use SSE client for efficient server-push notifications
                    from mcp_modules.sse_client import wait_for_consent_via_sse

                    resolution = await wait_for_consent_via_sse(
                        user_id=user_id,
                        request_id=request_id,
                        scope=scope_str,
                        fastapi_url=FASTAPI_URL,
                        timeout_seconds=CONSENT_TIMEOUT_SECONDS,
                    )

                    # Handle resolution
                    if resolution.status == "granted":
                        # CRITICAL: Fetch the token with retry logic
                        # Token may take a moment to propagate to database
                        import asyncio

                        consent_token = None
                        max_retries = 5
                        retry_delay = 0.5  # 500ms

                        for attempt in range(max_retries):
                            logger.info(
                                f"🔄 Fetching consent token (attempt {attempt + 1}/{max_retries})..."
                            )

                            active_response = await client.get(
                                f"{FASTAPI_URL}/api/consent/active",
                                params={"userId": user_id},
                                timeout=10.0,
                            )

                            if active_response.status_code == 200:
                                active_list = active_response.json().get("active", [])
                                # Match by scope (DB stores dot notation)
                                active_token = next(
                                    (t for t in active_list if t.get("scope") == scope_str), None
                                )

                                if active_token:
                                    consent_token = active_token.get("token_id")
                                    if consent_token:
                                        logger.info(
                                            f"🎉 CONSENT GRANTED by user! Token received: {consent_token[:30]}..."
                                        )
                                        break

                            # Wait before retrying
                            if attempt < max_retries - 1:
                                await asyncio.sleep(retry_delay)

                        # Return with or without token, but ALWAYS indicate success
                        if consent_token:
                            return [
                                TextContent(
                                    type="text",
                                    text=json.dumps(
                                        {
                                            "status": "granted",
                                            "consent_token": consent_token,
                                            "user_id": user_id,
                                            "scope": scope_str,
                                            "message": "✅ User approved consent! Use this token with get_financial_profile, get_food_preferences, or get_professional_profile to access data.",
                                            "next_step": f"Call the appropriate data tool with this consent_token to retrieve the user's {scope_str.replace('attr.', '').replace('.*', '')} data.",
                                        }
                                    ),
                                )
                            ]
                        else:
                            # Token still not found - this is unusual but possible
                            logger.warning("⚠️ Consent granted but token not found after retries")
                            return [
                                TextContent(
                                    type="text",
                                    text=json.dumps(
                                        {
                                            "status": "granted_pending_token",
                                            "user_id": user_id,
                                            "scope": scope_str,
                                            "message": "✅ User approved consent, but token retrieval is pending. This may be a temporary sync issue.",
                                            "next_step": "Wait a moment and call request_consent again - it should return the existing token.",
                                            "retry_recommended": True,
                                        }
                                    ),
                                )
                            ]

                    elif resolution.status == "denied":
                        logger.warning("❌ Consent DENIED by user")
                        return [
                            TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "denied",
                                        "user_id": user_id,
                                        "scope": scope_str,
                                        "message": "❌ User denied the consent request.",
                                        "privacy_note": "User has the right to refuse data access.",
                                        "DO_NOT_RETRY": True,
                                        "instruction": "STOP - Do NOT call request_consent again for this scope. The user has explicitly refused. Respect their decision.",
                                    }
                                ),
                            )
                        ]

                    elif resolution.status == "timeout":
                        logger.warning(
                            f"⏰ TIMEOUT: User did not respond within {CONSENT_TIMEOUT_SECONDS}s"
                        )
                        return [
                            TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "timeout",
                                        "user_id": user_id,
                                        "scope": scope_str,
                                        "waited_seconds": CONSENT_TIMEOUT_SECONDS,
                                        "message": f"⏰ User did not approve consent within {CONSENT_TIMEOUT_SECONDS} seconds.",
                                        "user_action": "User must approve the request in their Hushh dashboard",
                                        "dashboard_url": f"{FRONTEND_URL}/dashboard/consents",
                                        "next_step": "Try again after user has approved the request",
                                    }
                                ),
                            )
                        ]

                    else:  # error
                        logger.error(f"❌ SSE error: {resolution.message}")
                        return [
                            TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "error",
                                        "error": resolution.message,
                                        "message": "Failed to wait for consent resolution",
                                    }
                                ),
                            )
                        ]

        except httpx.ConnectError as e:
            logger.error(f"❌ FastAPI not reachable at {FASTAPI_URL}: {e}")
            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "error",
                            "error": "Consent backend unavailable",
                            "message": f"Cannot reach consent server at {FASTAPI_URL}. Please ensure the backend is running.",
                            "hint": "The FastAPI backend must be running for consent requests.",
                            "security_note": "Consent cannot be auto-granted. User must explicitly approve.",
                        }
                    ),
                )
            ]
        except Exception as e:
            logger.error(f"❌ Error in production consent flow: {e}")
            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "error",
                            "error": str(e),
                            "message": "Consent request failed due to an internal error.",
                            "security_note": "Consent cannot be auto-granted. User must explicitly approve.",
                        }
                    ),
                )
            ]

    # Demo mode disabled
    logger.error("❌ DEMO MODE DISABLED: Cannot auto-issue tokens in production")
    return [
        TextContent(
            type="text",
            text=json.dumps(
                {
                    "status": "error",
                    "error": "Production mode requires explicit user consent",
                    "message": "Auto-granting tokens is disabled. User must approve via dashboard.",
                    "dashboard_url": f"{FRONTEND_URL}/dashboard/consents",
                    "security_note": "HushhMCP: Consent First - NO data access without explicit user approval",
                }
            ),
        )
    ]


async def handle_check_consent_status(args: dict) -> list[TextContent]:
    """
    Check consent status - returns active token if available, or pending status.

    Flow:
    1. First check active consents → return token if found
    2. Then check pending requests → return pending status
    3. Otherwise return not_found status

    Compliance:
    ✅ Returns token only after user explicitly approves
    ✅ Respects user's decision (grant or deny)
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")

    # Email resolution
    original_identifier = user_id
    user_id, user_email, user_display_name = await resolve_email_to_uid(user_id)

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

    logger.info(f"🔄 Checking consent status: user={user_id}, scope={scope_str}")

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Check for active consent first
            active_response = await client.get(
                f"{FASTAPI_URL}/api/consent/active", params={"userId": user_id}, timeout=10.0
            )

            if active_response.status_code == 200:
                active_list = active_response.json().get("active", [])

                # Check for exact scope match first
                active_token = next((t for t in active_list if t.get("scope") == scope_str), None)

                if active_token:
                    token_id = active_token.get("token_id")
                    expires_at = active_token.get("expiresAt")
                    logger.info(f"✅ Found active consent token for {scope_str}")
                    return [
                        TextContent(
                            type="text",
                            text=json.dumps(
                                {
                                    "status": "granted",
                                    "consent_token": token_id,
                                    "user_id": user_id,
                                    "scope": scope_str,
                                    "expires_at": expires_at,
                                    "message": "✅ Consent is active! Use this token to access data.",
                                    "next_step": "Call get_financial_profile, get_food_preferences, or get_professional_profile with this consent_token.",
                                }
                            ),
                        )
                    ]

            # Step 2: Check for pending consent
            pending_response = await client.get(
                f"{FASTAPI_URL}/api/consent/pending", params={"userId": user_id}, timeout=10.0
            )

            if pending_response.status_code == 200:
                pending_data = pending_response.json()
                pending_list = pending_data.get("pending", [])

                for req in pending_list:
                    if req.get("scope") == scope_str:
                        logger.info(f"⏳ Consent still pending for {scope_str}")
                        return [
                            TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "pending",
                                        "user_id": user_id,
                                        "scope": scope_str,
                                        "message": "⏳ Consent request is pending. User must approve in their Hushh app.",
                                        "request_id": req.get("id"),
                                        "requested_at": req.get("requestedAt"),
                                        "dashboard_url": f"{FRONTEND_URL}/dashboard/consents",
                                    }
                                ),
                            )
                        ]

            # Step 3: No active or pending consent found
            logger.info(f"ℹ️ No consent found for {scope_str}")
            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "not_found",
                            "user_id": user_id,
                            "scope": scope_str,
                            "message": "No consent found for this scope. Use request_consent to request access.",
                            "next_step": f"Call request_consent with scope='{scope_str}' to request user approval.",
                        }
                    ),
                )
            ]

    except httpx.ConnectError:
        logger.warning("⚠️ FastAPI not reachable")
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
        logger.error(f"❌ Error checking consent status: {e}")
        return [TextContent(type="text", text=json.dumps({"status": "error", "error": str(e)}))]
