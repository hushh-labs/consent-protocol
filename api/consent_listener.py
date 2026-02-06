"""
Consent NOTIFY listener: LISTEN consent_audit_new, send FCM and push to in-app queues.

Runs in a background asyncio task. On NOTIFY: parses payload, fetches user push
tokens, sends FCM (if configured), and puts event into per-user queue for SSE.

Also runs an optional timeout job: every 2 minutes, inserts TIMEOUT events for
REQUESTED rows that have passed poll_timeout_at, so SSE clients get event-driven
"request expired" updates.
"""

import asyncio
import json
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Interval for timeout job (seconds)
TIMEOUT_JOB_INTERVAL = 120

# Per-user queues for SSE generators (no polling). Key = user_id.
_consent_notify_queues: Dict[str, asyncio.Queue] = {}
_consent_notify_queues_lock = asyncio.Lock()

# Diagnostic: set when listener is running and when NOTIFY is received
_listener_active = False
_notify_received_count = 0
_last_notify_user_id: str | None = None
_last_notify_action: str | None = None


def get_consent_queue(user_id: str) -> asyncio.Queue:
    """Get or create the asyncio queue for this user (used by SSE generator)."""
    if user_id not in _consent_notify_queues:
        _consent_notify_queues[user_id] = asyncio.Queue()
    return _consent_notify_queues[user_id]


def get_consent_listener_status() -> dict:
    """Return status for GET /debug/consent-listener (listener_active, queue_count, notify_received_count)."""
    return {
        "listener_active": _listener_active,
        "queue_count": len(_consent_notify_queues),
        "notify_received_count": _notify_received_count,
        "last_notify_user_id": _last_notify_user_id,
        "last_notify_action": _last_notify_action,
    }


def _notify_callback(connection, pid, channel, payload: str):
    """Sync callback from asyncpg when NOTIFY consent_audit_new is received."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(_handle_notify(payload))
            )
    except Exception as e:
        logger.exception("Consent notify callback error: %s", e)


async def _handle_notify(payload_str: str):
    """Parse payload, send FCM to user's tokens, push to in-app queue."""
    global _notify_received_count, _last_notify_user_id, _last_notify_action
    try:
        data = json.loads(payload_str)
        user_id = data.get("user_id")
        if not user_id:
            return
        action = data.get("action", "REQUESTED")
        _notify_received_count += 1
        _last_notify_user_id = user_id
        _last_notify_action = action
        logger.info("Consent NOTIFY received user_id=%s action=%s", user_id, action)
        # Push to in-app queue so SSE generator can send consent_update
        async with _consent_notify_queues_lock:
            q = _consent_notify_queues.get(user_id)
            if q is not None:
                try:
                    q.put_nowait(data)
                except asyncio.QueueFull:
                    pass
        # Send FCM to user's registered tokens
        await _send_fcm_for_user(user_id, data)
    except json.JSONDecodeError as e:
        logger.warning("Consent notify invalid JSON: %s", e)
    except Exception as e:
        logger.exception("Consent notify handle error: %s", e)


async def _send_fcm_for_user(user_id: str, data: Dict[str, Any]):
    """Fetch tokens from user_push_tokens and send FCM data message."""
    try:
        from db.db_client import get_db
        db = get_db()
        # Sync query via raw SQL (user_push_tokens may not exist yet if migration not run)
        result = db.execute_raw(
            "SELECT token, platform FROM user_push_tokens WHERE user_id = :uid",
            {"uid": user_id},
        )
        if result.error or not result.data:
            logger.info("FCM skipped: no push tokens for user_id=%s", user_id)
            return
        from api.utils.firebase_admin import ensure_firebase_admin
        configured, _ = ensure_firebase_admin()
        if not configured:
            logger.warning("FCM skipped: Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT_JSON)")
            return
        from firebase_admin import messaging
        request_id = data.get("request_id", "")
        action = data.get("action", "REQUESTED")
        for row in result.data:
            token = row.get("token")
            if not token:
                continue
            message = messaging.Message(
                data={
                    "type": "consent_request" if action == "REQUESTED" else "consent_resolved",
                    "request_id": request_id,
                    "action": action,
                    "user_id": user_id,
                    "deep_link": "/consents?tab=pending",
                },
                token=token,
                notification=messaging.Notification(
                    title="Consent request" if action == "REQUESTED" else "Consent updated",
                    body=f"Request {request_id}: {action}" if action != "REQUESTED" else "New consent request waiting for your approval.",
                ) if action == "REQUESTED" else None,
            )
            try:
                messaging.send(message)
            except Exception as e:
                logger.warning("FCM send failed for user %s: %s", user_id, e)
    except Exception as e:
        logger.exception("FCM send for user %s failed: %s", user_id, e)


async def _timeout_job_loop():
    """Periodically emit TIMEOUT events for expired REQUESTED rows (NOTIFY → SSE)."""
    from hushh_mcp.services.consent_db import ConsentDBService
    while True:
        try:
            await asyncio.sleep(TIMEOUT_JOB_INTERVAL)
            count = await ConsentDBService().emit_timeout_events()
            if count:
                logger.info("Timeout job: emitted %d TIMEOUT event(s)", count)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Timeout job error: %s", e)


async def run_consent_listener():
    """
    Long-running task: LISTEN consent_audit_new and dispatch to FCM + in-app queues.
    Uses a dedicated asyncpg connection (db.connection.get_pool()).
    Also starts the optional timeout job (TIMEOUT events for expired requests).
    """
    # Start timeout job in background (runs every TIMEOUT_JOB_INTERVAL)
    timeout_task = asyncio.create_task(_timeout_job_loop())
    try:
        from db.connection import get_pool
        pool = await get_pool()
    except Exception as e:
        logger.error("Consent listener: DB pool not available (%s), skipping LISTEN", e)
        timeout_task.cancel()
        return
    conn = None
    try:
        conn = await pool.acquire()
        await conn.execute("LISTEN consent_audit_new")
        # asyncpg add_listener is a coroutine (must be awaited)
        await conn.add_listener("consent_audit_new", _notify_callback)
        global _listener_active
        _listener_active = True
        logger.info("Consent NOTIFY listener active (consent_audit_new)")
        try:
            while True:
                await asyncio.sleep(3600)
        finally:
            _listener_active = False
    except asyncio.CancelledError:
        logger.info("Consent listener cancelled")
    except Exception as e:
        logger.exception("Consent listener error: %s", e)
    finally:
        _listener_active = False
        timeout_task.cancel()
        try:
            await timeout_task
        except asyncio.CancelledError:
            pass
        if conn is not None:
            try:
                # asyncpg remove_listener is a coroutine (must be awaited)
                await conn.remove_listener("consent_audit_new", _notify_callback)
                await conn.execute("UNLISTEN consent_audit_new")
            except Exception:
                pass
            await pool.release(conn)
