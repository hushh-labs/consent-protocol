# api/routes/sse.py
"""
Server-Sent Events (SSE) for real-time consent notifications.

Regulated cutover rules:
- Consent SSE is disabled in production by default.
- When enabled, caller must provide Firebase bearer token and matching user_id.
- Consent polling endpoint is deprecated and disabled.
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from api.utils.firebase_auth import verify_firebase_bearer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consent", tags=["SSE"])


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.getenv(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _consent_sse_enabled() -> bool:
    explicit = os.getenv("CONSENT_SSE_ENABLED")
    if explicit is not None:
        return _env_truthy("CONSENT_SSE_ENABLED")

    # Secure default: off in production, on elsewhere.
    environment = str(os.getenv("ENVIRONMENT", "development")).strip().lower()
    return environment != "production"


def _ensure_consent_sse_enabled() -> None:
    if _consent_sse_enabled():
        return

    raise HTTPException(
        status_code=410,
        detail={
            "error_code": "CONSENT_SSE_DISABLED",
            "message": "Consent SSE is disabled. Use FCM notifications.",
        },
    )


def _authorize_sse_user(user_id: str, authorization: Optional[str]) -> None:
    firebase_uid = verify_firebase_bearer(authorization)
    if firebase_uid != user_id:
        raise HTTPException(status_code=403, detail="User ID mismatch")


async def consent_event_generator(user_id: str, request: Request) -> AsyncGenerator[dict, None]:
    """
    Generate SSE events for consent notifications.

    Event-driven: waits on per-user queue (NOTIFY pushes here). No DB polling.
    Backfills once on connect, then only yields when NOTIFY delivers an event.
    Heartbeat every 30s to keep connection alive.
    """
    from datetime import datetime

    from api.consent_listener import get_consent_queue
    from hushh_mcp.services.consent_db import ConsentDBService

    logger.info("consent_sse.open user_id=%s", user_id)
    connection_start_ms = int(datetime.now().timestamp() * 1000)
    backfill_window_ms = 2 * 60 * 1000
    after_timestamp_ms = connection_start_ms - backfill_window_ms
    notified_event_ids = set()
    heartbeat_interval = 30
    queue = get_consent_queue(user_id)

    try:
        service = ConsentDBService()
        recent_events = await service.get_recent_consent_events(
            user_id=user_id,
            after_timestamp_ms=after_timestamp_ms,
            limit=10,
        )
        for event in recent_events:
            event_id = event.get("request_id") or event.get("token_id")
            request_id = event.get("request_id")
            if not event_id or event_id in notified_event_ids:
                continue

            notified_event_ids.add(event_id)
            yield {
                "event": "consent_update",
                "id": event_id,
                "data": json.dumps(
                    {
                        "request_id": request_id,
                        "action": event["action"],
                        "scope": event["scope"],
                        "agent_id": event["agent_id"],
                        "timestamp": event["issued_at"],
                    }
                ),
            }

        while True:
            if await request.is_disconnected():
                logger.info("consent_sse.disconnected user_id=%s", user_id)
                break

            try:
                data = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)
            except asyncio.TimeoutError:
                import time

                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": int(time.time() * 1000)}),
                }
                continue

            request_id = data.get("request_id") or ""
            event_id = request_id
            if not event_id or event_id in notified_event_ids:
                continue

            notified_event_ids.add(event_id)
            yield {
                "event": "consent_update",
                "id": event_id,
                "data": json.dumps(
                    {
                        "request_id": request_id,
                        "action": data.get("action", "REQUESTED"),
                        "scope": data.get("scope", ""),
                        "agent_id": data.get("agent_id", ""),
                        "timestamp": data.get("issued_at", 0),
                    }
                ),
            }
    except asyncio.CancelledError:
        logger.info("consent_sse.cancelled user_id=%s", user_id)
    except Exception as e:
        logger.error("consent_sse.error user_id=%s error=%s", user_id, e)
        raise


@router.get("/events/{user_id}")
async def consent_events(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None, description="Bearer Firebase ID token"),
):
    """
    Authenticated SSE endpoint for consent notifications.

    Disabled by default in production; FCM is the primary notification path.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    _ensure_consent_sse_enabled()
    _authorize_sse_user(user_id, authorization)

    return EventSourceResponse(
        consent_event_generator(user_id, request),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/events/{user_id}/poll/{request_id}")
async def poll_specific_request(user_id: str, request_id: str, request: Request):
    """Deprecated consent poll endpoint (disabled)."""
    _ = user_id
    _ = request_id
    _ = request
    raise HTTPException(
        status_code=410,
        detail={
            "error_code": "CONSENT_POLL_DEPRECATED",
            "message": "Consent polling endpoint is disabled. Use FCM notifications.",
        },
    )
