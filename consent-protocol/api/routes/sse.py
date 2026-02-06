# api/routes/sse.py
"""
Server-Sent Events (SSE) for Real-time Consent Notifications

Replaces expensive polling with efficient server-push.
Single persistent connection per user for consent updates.
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)

# Consent timeout from env var (synced with frontend via CONSENT_TIMEOUT_SECONDS)
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

router = APIRouter(prefix="/api/consent", tags=["SSE"])


async def consent_event_generator(
    user_id: str,
    request: Request
) -> AsyncGenerator[dict, None]:
    """
    Generate SSE events for consent notifications.

    Event-driven: waits on per-user queue (NOTIFY pushes here). No DB polling.
    Backfills once on connect, then only yields when NOTIFY delivers an event.
    Heartbeat every 30s to keep connection alive.
    """
    from datetime import datetime
    from api.consent_listener import get_consent_queue

    logger.info(f"SSE connection opened for user: {user_id}")
    connection_start_ms = int(datetime.now().timestamp() * 1000)
    # Backfill window: last 2 minutes so events that just happened are sent on connect
    BACKFILL_WINDOW_MS = 2 * 60 * 1000
    after_timestamp_ms = connection_start_ms - BACKFILL_WINDOW_MS
    notified_event_ids = set()
    HEARTBEAT_INTERVAL = 30
    queue = get_consent_queue(user_id)

    try:
        # Backfill once: any events in the last 2 minutes (so late-connecting clients get recent NOTIFYs)
        from hushh_mcp.services.consent_db import ConsentDBService
        service = ConsentDBService()
        recent_events = await service.get_recent_consent_events(
            user_id=user_id,
            after_timestamp_ms=after_timestamp_ms,
            limit=10
        )
        for event in recent_events:
            event_id = event.get("request_id") or event.get("token_id")
            request_id = event.get("request_id")
            if event_id and event_id not in notified_event_ids:
                notified_event_ids.add(event_id)
                yield {
                    "event": "consent_update",
                    "id": event_id,
                    "data": json.dumps({
                        "request_id": request_id,
                        "action": event["action"],
                        "scope": event["scope"],
                        "agent_id": event["agent_id"],
                        "timestamp": event["issued_at"]
                    })
                }
                logger.info(f"SSE event sent (backfill): {event['action']} for {request_id}")

        # Event-driven loop: wait on queue (heartbeat on timeout)
        while True:
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected: {user_id}")
                break
            try:
                data = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL)
            except asyncio.TimeoutError:
                import time
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": int(time.time() * 1000)})
                }
                continue
            request_id = data.get("request_id") or ""
            event_id = request_id
            if event_id and event_id not in notified_event_ids:
                notified_event_ids.add(event_id)
                yield {
                    "event": "consent_update",
                    "id": event_id,
                    "data": json.dumps({
                        "request_id": request_id,
                        "action": data.get("action", "REQUESTED"),
                        "scope": data.get("scope", ""),
                        "agent_id": data.get("agent_id", ""),
                        "timestamp": data.get("issued_at", 0)
                    })
                }
                logger.info(f"SSE event sent: {data.get('action')} for {request_id}")
    except asyncio.CancelledError:
        logger.info(f"SSE connection cancelled for user: {user_id}")
    except Exception as e:
        logger.error(f"SSE error for user {user_id}: {e}")
        raise


@router.get("/events/{user_id}")
async def consent_events(user_id: str, request: Request):
    """
    SSE endpoint for consent notifications.
    
    Connect to receive real-time updates when consent requests
    are approved or denied.
    
    Example client usage:
    ```javascript
    const evtSource = new EventSource('/api/consent/events/user_123');
    evtSource.addEventListener('consent_update', (e) => {
        const data = JSON.parse(e.data);
        console.log('Consent updated:', data.action);
    });
    ```
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    return EventSourceResponse(
        consent_event_generator(user_id, request),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",  # CORS for SSE
            "Access-Control-Allow-Credentials": "true",
        }
    )


@router.get("/events/{user_id}/poll/{request_id}")
async def poll_specific_request(user_id: str, request_id: str, request: Request):
    """
    SSE endpoint for a specific consent request.
    
    More efficient than general events when waiting for a specific decision.
    Closes automatically when the request is resolved.
    """
    async def specific_event_generator():
        elapsed = 0
        
        while elapsed < CONSENT_TIMEOUT_SECONDS:
            if await request.is_disconnected():
                break
            
            from hushh_mcp.services.consent_db import ConsentDBService
            service = ConsentDBService()
            
            # Use service method to check for resolution
            result = await service.get_resolved_request(user_id, request_id)
            
            if result:
                yield {
                    "event": "consent_resolved",
                    "id": request_id,
                    "data": json.dumps({
                        "request_id": request_id,
                        "action": result["action"],
                        "scope": result["scope"],
                        "resolved": True
                    })
                }
                # Wait briefly to ensure client receives the event before we close connection
                logger.info(f"✅ Consent resolved for {request_id}, keeping connection open briefly")
                await asyncio.sleep(2.0)
                break
            
            await asyncio.sleep(0.5)
            elapsed += 0.5
            
            # Keep connection alive every 15s
            if elapsed % 15 == 0:
                yield {"comment": "keepalive"}
        
        # Timeout event
        if elapsed >= CONSENT_TIMEOUT_SECONDS:
            yield {
                "event": "consent_timeout",
                "id": request_id,
                "data": json.dumps({
                    "request_id": request_id,
                    "timeout": True,
                    "message": "Consent request timed out"
                })
            }
    
    return EventSourceResponse(
        specific_event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
