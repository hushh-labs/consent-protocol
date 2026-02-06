"""
Push notification token registration for consent (FCM/APNs).

Stores device tokens so the notification worker can send push when consent
requests are created (WhatsApp-style delivery when app is closed).
"""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request

from api.utils.firebase_auth import verify_firebase_bearer
from db.db_client import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

Platform = Literal["web", "ios", "android"]


@router.post("/register")
async def register_push_token(request: Request):
    """
    Register FCM or APNs device token for the authenticated user.

    Call after login or when the user grants notification permission.
    One token per user per platform (latest wins). Requires Firebase ID token.
    """
    auth_header = request.headers.get("Authorization")
    firebase_uid = verify_firebase_bearer(auth_header)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = body.get("user_id") or body.get("userId")
    token = body.get("token")
    platform = body.get("platform", "web")

    if not user_id or not token:
        raise HTTPException(
            status_code=400,
            detail="user_id and token are required",
        )
    if firebase_uid != user_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot register token for another user",
        )
    if platform not in ("web", "ios", "android"):
        raise HTTPException(
            status_code=400,
            detail="platform must be one of: web, ios, android",
        )

    db = get_db()
    # Upsert: ON CONFLICT (user_id, platform) DO UPDATE SET token, updated_at
    sql = """
        INSERT INTO user_push_tokens (user_id, token, platform, created_at, updated_at)
        VALUES (:user_id, :token, :platform, NOW(), NOW())
        ON CONFLICT (user_id, platform)
        DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()
        RETURNING id, user_id, platform, created_at, updated_at
    """
    result = db.execute_raw(
        sql,
        {"user_id": user_id, "token": token, "platform": platform},
    )
    if result.error:
        logger.error("Push token registration failed: %s", result.error)
        raise HTTPException(status_code=500, detail="Failed to register token")

    row = result.data[0] if result.data else None
    logger.info("Push token registered for user=%s platform=%s", user_id, platform)
    return {"ok": True, "user_id": user_id, "platform": platform, "id": row.get("id")}
