# api/routes/consent.py
"""
Consent management endpoints (pending, approve, deny, revoke, history, active).
"""

import logging
import time
import uuid
from typing import Dict

from fastapi import APIRouter, HTTPException, Request

from api.models import ConsentRequest, ConsentResponse
from shared import REGISTERED_DEVELOPERS
from hushh_mcp.consent.token import validate_token, issue_token
from hushh_mcp.constants import ConsentScope
import consent_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consent", tags=["Consent Management"])

# Export data storage (in-memory for temporary encrypted data during MCP flow)
_consent_exports: Dict[str, Dict] = {}


def get_scope_description(scope: str) -> str:
    """Human-readable scope descriptions."""
    descriptions = {
        "vault_read_food": "Read your food preferences (dietary, cuisines, budget)",
        "vault_read_professional": "Read your professional profile (title, skills, experience)",
        "vault_write_food": "Write to your food preferences",
        "vault_write_professional": "Write to your professional profile",
    }
    return descriptions.get(scope, f"Access: {scope}")


# ============================================================================
# PENDING CONSENT MANAGEMENT
# ============================================================================

@router.get("/pending")
async def get_pending_consents(userId: str):
    """
    Get all pending consent requests for a user.
    Uses database via consent_db module for persistence.
    """
    pending_from_db = await consent_db.get_pending_requests(userId)
    logger.info(f"📋 Found {len(pending_from_db)} pending requests in DB for {userId}")
    return {"pending": pending_from_db}


@router.post("/pending/approve")
async def approve_consent(request: Request):
    """
    User approves a pending consent request (Zero-Knowledge).
    
    Browser sends encrypted export data (server never sees plaintext).
    Export key is embedded in the consent token.
    """
    body = await request.json()
    userId = body.get("userId")
    requestId = body.get("requestId")
    exportKey = body.get("exportKey")  # Hex-encoded AES-256 key
    encryptedData = body.get("encryptedData")  # Base64 ciphertext
    encryptedIv = body.get("encryptedIv")  # Base64 IV
    encryptedTag = body.get("encryptedTag")  # Base64 auth tag
    
    logger.info(f"✅ User {userId} approving consent request {requestId}")
    logger.info(f"   Export data present: {bool(encryptedData)}")
    
    # Get pending request from database
    pending_request = await consent_db.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
    # Issue consent token
    scope_map = {
        "vault_read_food": ConsentScope.VAULT_READ_FOOD,
        "vault_read_professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault_write_food": ConsentScope.VAULT_WRITE_FOOD,
        "vault_write_professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
    }
    
    consent_scope = scope_map.get(pending_request["scope"])
    if not consent_scope:
        raise HTTPException(status_code=400, detail=f"Unknown scope: {pending_request['scope']}")
    
    # Get developer token from metadata or use developer name
    metadata = pending_request.get("metadata", {})
    developer_token = metadata.get("developer_token", pending_request["developer"])
    expiry_hours = metadata.get("expiry_hours", 24)
    
    # Issue token with export key embedded
    token = issue_token(
        user_id=userId,
        agent_id=f"developer:{developer_token}",
        scope=consent_scope,
        expires_in_ms=expiry_hours * 60 * 60 * 1000
    )
    
    # Store encrypted export linked to token (still in-memory for export data)
    if encryptedData and exportKey:
        _consent_exports[token.token] = {
            "encrypted_data": encryptedData,
            "iv": encryptedIv,
            "tag": encryptedTag,
            "export_key": exportKey,  # Will be in token for MCP decryption
            "scope": pending_request["scope"],
            "created_at": int(time.time() * 1000),
        }
        logger.info(f"   Stored encrypted export for token")
    
    # Log CONSENT_GRANTED to database
    await consent_db.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CONSENT_GRANTED",
        token_id=token.token,
        request_id=requestId,
        expires_at=token.expires_at
    )
    logger.info(f"✅ CONSENT_GRANTED event saved to DB")
    
    # Return token with export key for MCP decryption
    return {
        "status": "approved",
        "message": f"Consent granted to {pending_request['developer']}",
        "consent_token": token.token,
        "export_key": exportKey,  # MCP uses this to decrypt
        "expires_at": token.expires_at
    }


@router.post("/pending/deny")
async def deny_consent(userId: str, requestId: str):
    """
    User denies a pending consent request.
    """
    logger.info(f"❌ User {userId} denying consent request {requestId}")
    
    # Get pending request from database
    pending_request = await consent_db.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
    # Log CONSENT_DENIED to database
    await consent_db.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CONSENT_DENIED",
        request_id=requestId
    )
    logger.info(f"❌ CONSENT_DENIED event saved to DB")
    
    return {"status": "denied", "message": f"Consent denied to {pending_request['developer']}"}


@router.post("/revoke")
async def revoke_consent(request: Request):
    """
    User revokes an active consent token.
    
    This removes access for the app that was previously granted consent.
    """
    body = await request.json()
    userId = body.get("userId")
    scope = body.get("scope")
    
    if not userId or not scope:
        raise HTTPException(status_code=400, detail="userId and scope are required")
    
    logger.info(f"🔒 User {userId} revoking consent for scope: {scope}")
    
    # Get the active token for this scope
    active_tokens = await consent_db.get_active_tokens(userId)
    token_to_revoke = None
    for token in active_tokens:
        if token.get("scope") == scope:
            token_to_revoke = token
            break
    
    if not token_to_revoke:
        raise HTTPException(status_code=404, detail=f"No active consent found for scope: {scope}")
    
    # Log REVOKED event to database (link to original request_id for trail)
    await consent_db.insert_event(
        user_id=userId,
        agent_id=token_to_revoke.get("agent_id", token_to_revoke.get("developer", "Unknown")),
        scope=scope,
        action="REVOKED",
        token_id=token_to_revoke.get("token_id"),
        request_id=token_to_revoke.get("request_id")  # Link to original request
    )
    logger.info(f"🔒 REVOKED event saved to DB for scope: {scope}, request_id: {token_to_revoke.get('request_id')}")
    
    return {"status": "revoked", "message": f"Consent for {scope} has been revoked"}


@router.get("/data")
async def get_consent_export_data(consent_token: str):
    """
    Retrieve encrypted export data for a consent token (Zero-Knowledge).
    
    MCP calls this with a valid consent token.
    Returns encrypted data + export key for client-side decryption.
    Server NEVER sees plaintext.
    """
    logger.info(f"📦 Export data request for token: {consent_token[:30]}...")
    
    # Validate the consent token
    valid, reason, token_obj = validate_token(consent_token)
    if not valid:
        logger.warning(f"❌ Token validation failed: {reason}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    # Look up the encrypted export
    if consent_token not in _consent_exports:
        logger.warning(f"⚠️ No export data found for token")
        raise HTTPException(status_code=404, detail="No export data for this token")
    
    export_data = _consent_exports[consent_token]
    
    logger.info(f"✅ Returning encrypted export for scope: {export_data.get('scope')}")
    
    return {
        "status": "success",
        "encrypted_data": export_data["encrypted_data"],
        "iv": export_data["iv"],
        "tag": export_data["tag"],
        "export_key": export_data["export_key"],  # MCP decrypts with this
        "scope": export_data["scope"],
    }


# Expose _consent_exports for other modules that need it
def get_consent_exports() -> Dict[str, Dict]:
    """Get the consent exports dictionary (for cross-module access)."""
    return _consent_exports
