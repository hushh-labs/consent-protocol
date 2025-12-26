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
    
    Checks for consent updates every 500ms and yields events
    when a pending request is approved/denied.
    Sends heartbeat every 30s to keep connection alive.
    """
    logger.info(f"SSE connection opened for user: {user_id}")
    
    # Track connection start time - only send events AFTER this
    # This prevents re-sending old events on reconnect
    from datetime import datetime
    connection_start_ms = int(datetime.now().timestamp() * 1000)
    
    # Track which events we've already notified about this session
    # Use request_id as primary key since token_id can be auto-generated
    notified_event_ids = set()
    
    # Heartbeat tracking
    last_heartbeat = 0
    HEARTBEAT_INTERVAL = 30  # seconds
    
    try:
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected: {user_id}")
                break
            
            from db.connection import get_pool
            pool = await get_pool()
            
            # Query for events that happened AFTER this connection started
            recent_events = await pool.fetch("""
                SELECT token_id, request_id, action, scope, agent_id, issued_at
                FROM consent_audit
                WHERE user_id = $1 
                AND action IN ('REQUESTED', 'CONSENT_GRANTED', 'CONSENT_DENIED', 'REVOKED')
                AND issued_at > $2
                ORDER BY issued_at DESC
                LIMIT 10
            """, user_id, connection_start_ms)
            
            for event in recent_events:
                # Use request_id as primary event key (more stable than auto-generated token_id)
                # Fall back to token_id if request_id is not available
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
                    logger.info(f"SSE event sent: {event['action']} for {request_id}")
            
            # Send heartbeat every 30 seconds to keep connection alive
            import time
            current_time = time.time()
            if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": int(current_time * 1000)})
                }
                last_heartbeat = current_time
                logger.debug(f"SSE heartbeat sent for user: {user_id}")
            
            # Check every 500ms
            await asyncio.sleep(0.5)
            
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
            
            from db.connection import get_pool
            pool = await get_pool()
            
            result = await pool.fetchrow("""
                SELECT action, scope, agent_id, issued_at
                FROM consent_audit
                WHERE user_id = $1 AND request_id = $2
                AND action IN ('CONSENT_GRANTED', 'CONSENT_DENIED')
                ORDER BY issued_at DESC
                LIMIT 1
            """, user_id, request_id)
            
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
                break
            
            await asyncio.sleep(0.5)
            elapsed += 0.5
        
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
