# mcp_modules/sse_client.py
"""
SSE Client for MCP Consent Polling

Provides a reusable async SSE client that connects to the FastAPI
SSE endpoint to wait for consent resolution. This replaces HTTP polling
with efficient server-push notifications.

Uses the existing endpoint: /api/consent/events/{user_id}/poll/{request_id}
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class ConsentResolution:
    """Result of waiting for consent resolution via SSE."""
    status: str  # "granted", "denied", "timeout", "error"
    request_id: str
    scope: Optional[str] = None
    message: Optional[str] = None


async def wait_for_consent_via_sse(
    user_id: str,
    request_id: str,
    scope: str,
    fastapi_url: str,
    timeout_seconds: int = 300
) -> ConsentResolution:
    """
    Wait for a consent request to be resolved using SSE.
    
    Args:
        user_id: The user's ID
        request_id: The pending consent request ID
        scope: The scope being requested
        fastapi_url: Base URL of the FastAPI server
        timeout_seconds: Maximum time to wait before timing out
        
    Returns:
        ConsentResolution with status and details
    """
    sse_url = f"{fastapi_url}/api/consent/events/{user_id}/poll/{request_id}"
    logger.info(f"🔌 [SSE] Connecting to {sse_url}")
    
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds + 10)) as client:
            async with client.stream("GET", sse_url) as response:
                if response.status_code != 200:
                    logger.error(f"❌ [SSE] Failed to connect: {response.status_code}")
                    return ConsentResolution(
                        status="error",
                        request_id=request_id,
                        message=f"SSE connection failed: {response.status_code}"
                    )
                
                logger.info("✅ [SSE] Connected, waiting for consent resolution...")
                
                # Track elapsed time for client-side timeout
                import time
                start_time = time.time()
                
                current_event_type = None
                current_event_data = []
                
                async for line in response.aiter_lines():
                    # Check client-side timeout
                    if time.time() - start_time > timeout_seconds:
                        logger.warning(f"⏰ [SSE] Client-side timeout after {timeout_seconds}s")
                        return ConsentResolution(
                            status="timeout",
                            request_id=request_id,
                            scope=scope,
                            message=f"Consent request timed out after {timeout_seconds} seconds"
                        )

                    line = line.strip()
                    
                    # Empty line indicates end of event
                    if not line:
                        if current_event_type and current_event_data:
                            # Process complete event
                            full_data = "\n".join(current_event_data)
                            try:
                                data = json.loads(full_data)
                                
                                if current_event_type == "consent_resolved":
                                    action = data.get("action", "")
                                    if action == "CONSENT_GRANTED":
                                        logger.info("🎉 [SSE] Consent GRANTED!")
                                        return ConsentResolution(
                                            status="granted",
                                            request_id=request_id,
                                            scope=data.get("scope", scope),
                                            message="User approved consent"
                                        )
                                    elif action == "CONSENT_DENIED":
                                        logger.info("❌ [SSE] Consent DENIED")
                                        return ConsentResolution(
                                            status="denied",
                                            request_id=request_id,
                                            scope=data.get("scope", scope),
                                            message="User denied consent"
                                        )
                                
                                elif current_event_type == "consent_timeout":
                                    logger.warning("⏰ [SSE] Server-side timeout")
                                    return ConsentResolution(
                                        status="timeout",
                                        request_id=request_id,
                                        scope=scope,
                                        message="Consent request timed out"
                                    )
                                    
                            except json.JSONDecodeError as e:
                                logger.warning(f"⚠️ [SSE] Failed to parse event data: {e}")
                        
                        # Reset for next event
                        current_event_type = None
                        current_event_data = []
                        continue
                    
                    # Parse fields
                    if line.startswith("event:"):
                        current_event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        current_event_data.append(line[5:].strip())
                    # Comments (starting with :) or other fields are ignored
                
                # Connection closed without resolution
                logger.warning("⚠️ [SSE] Connection closed without resolution")
                return ConsentResolution(
                    status="error",
                    request_id=request_id,
                    message="SSE connection closed unexpectedly"
                )
                
    except httpx.ConnectError as e:
        logger.error(f"❌ [SSE] Connection error: {e}")
        return ConsentResolution(
            status="error",
            request_id=request_id,
            message=f"Cannot connect to consent server: {e}"
        )
    except asyncio.TimeoutError:
        logger.warning("⏰ [SSE] Request timeout")
        return ConsentResolution(
            status="timeout",
            request_id=request_id,
            scope=scope,
            message=f"Consent request timed out after {timeout_seconds} seconds"
        )
    except Exception as e:
        logger.error(f"❌ [SSE] Unexpected error: {e}")
        return ConsentResolution(
            status="error",
            request_id=request_id,
            message=f"SSE error: {str(e)}"
        )
