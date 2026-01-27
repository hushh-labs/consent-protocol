# api/routes/consent.py
"""
Consent management endpoints (pending, approve, deny, revoke, history, active).
"""

import logging
import time
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.consent.token import issue_token, validate_token
from hushh_mcp.constants import ConsentScope
from api.utils.firebase_auth import verify_firebase_bearer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/consent", tags=["Consent Management"])

# Export data storage (in-memory for temporary encrypted data during MCP flow)
_consent_exports: Dict[str, Dict] = {}


def get_scope_description(scope: str) -> str:
    """Human-readable scope descriptions."""
    descriptions = {
        # Dot notation (canonical)
        "vault.read.food": "Read your food preferences (dietary, cuisines, budget)",
        "vault.read.professional": "Read your professional profile (title, skills, experience)",
        "vault.write.food": "Write to your food preferences",
        "vault.write.professional": "Write to your professional profile",
        # Underscore notation (legacy fallback)
        "vault_read_food": "Read your food preferences (dietary, cuisines, budget)",
        "vault_read_professional": "Read your professional profile (title, skills, experience)",
        "vault_write_food": "Write to your food preferences",
        "vault_write_professional": "Write to your professional profile",
    }
    return descriptions.get(scope, f"Access: {scope}")


# ============================================================================
# PENDING CONSENT MANAGEMENT
# ============================================================================

class CancelConsentRequest(BaseModel):
    userId: str
    requestId: str


@router.get("/pending")
async def get_pending_consents(userId: str):
    """
    Get all pending consent requests for a user.
    Uses ConsentDBService for database access.
    """
    service = ConsentDBService()
    pending_from_db = await service.get_pending_requests(userId)
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
    service = ConsentDBService()
    pending_request = await service.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
    # Issue consent token - map scope to ConsentScope enum
    # Handles both underscore (legacy) and dot notation (new)
    scope_map = {
        # Underscore notation (legacy from API)
        "vault_read_food": ConsentScope.VAULT_READ_FOOD,
        "vault_read_professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault_write_food": ConsentScope.VAULT_WRITE_FOOD,
        "vault_write_professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
        # Dot notation (canonical)
        "vault.read.food": ConsentScope.VAULT_READ_FOOD,
        "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault.write.food": ConsentScope.VAULT_WRITE_FOOD,
        "vault.write.professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
    }
    
    consent_scope = scope_map.get(pending_request["scope"])
    if not consent_scope:
        raise HTTPException(status_code=400, detail=f"Unknown scope: {pending_request['scope']}")
    
    # Get developer token from metadata or use developer name
    metadata = pending_request.get("metadata", {})
    developer_token = metadata.get("developer_token", pending_request["developer"])
    expiry_hours = metadata.get("expiry_hours", 24)
    
    # MODULAR COMPLIANCE CHECK: Idempotency
    # Before issuing a NEW token, check if a valid token for this scope/agent already exists.
    # This prevents duplication and ensures a clean audit log.
    
    service = ConsentDBService()
    active_tokens = await service.get_active_tokens(userId)
    existing_token = None
    
    # 1. Filter active tokens for the requested scope and agent
    for t in active_tokens:
        # Check Scope Match
        if t.get("scope") != consent_scope.value:
            continue
            
        # Check Agent Match (Normalize developer token format)
        t_agent = t.get("agent_id") or t.get("developer")
        req_agent = f"developer:{developer_token}"
        
        # Simple match or exact match
        if t_agent == req_agent or t_agent == developer_token:
            # Check Expiry (ensure it has reasonable life left, e.g., > 1 hour)
            expires_at = t.get("expires_at", 0)
            if expires_at > (time.time() * 1000) + (60 * 60 * 1000):
                existing_token = t
                break
    
    if existing_token:
        # IDEMPOTENT RETURN: Reuse existing token
        logger.info(f"♻️ Idempotent: Reusing existing active token for {consent_scope.value}")
        
        # Log REUSE event for audit trail (optional, but good for tracking)
        # await consent_db.insert_event(..., action="TOKEN_REUSED", ...) 
        
        return {
            "status": "approved",
            "message": f"Consent granted to {pending_request['developer']} (Existing)",
            "consent_token": existing_token.get("id") or existing_token.get("token"), # access db model field
            "export_key": exportKey, # Reuse provided key for this session or potentially re-encrypt (Scope limitation: Reusing token implies reusing access)
            # Note: Export Key is ephemeral for the SESSION. If we reuse token, the Client might need the key.
            # But in ZK flow, Client HAS the key. We just need to authorize.
            "expires_at": existing_token.get("expires_at")
        }

    # Issue token with export key embedded (If no existing found)
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
        logger.info("   Stored encrypted export for token")
    
    # Log CONSENT_GRANTED to database with dot notation scope
    service = ConsentDBService()
    await service.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=consent_scope.value,  # Use dot notation (e.g., "vault.read.food")
        action="CONSENT_GRANTED",
        token_id=token.token,
        request_id=requestId,
        expires_at=token.expires_at
    )
    logger.info("✅ CONSENT_GRANTED event saved to DB")
    
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
    service = ConsentDBService()
    pending_request = await service.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
    # Log CONSENT_DENIED to database
    await service.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CONSENT_DENIED",
        request_id=requestId
    )
    logger.info("❌ CONSENT_DENIED event saved to DB")
    
    return {"status": "denied", "message": f"Consent denied to {pending_request['developer']}"}


@router.post("/cancel")
async def cancel_consent(payload: CancelConsentRequest):
    """
    Cancel a pending consent request.

    Implementation: insert a terminal audit action so the request no longer
    appears as pending (pending = latest action == REQUESTED).
    """
    logger.info(f"🛑 User {payload.userId} cancelling consent request {payload.requestId}")

    service = ConsentDBService()
    pending_request = await service.get_pending_by_request_id(payload.userId, payload.requestId)
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")

    await service.insert_event(
        user_id=payload.userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CANCELLED",
        request_id=payload.requestId,
        scope_description=pending_request.get("scope_description")
    )

    return {"status": "cancelled", "requestId": payload.requestId}


@router.post("/vault-owner-token")
async def issue_vault_owner_token(request: Request):
    """
    Issue VAULT_OWNER consent token for authenticated user.
    
    This is the master token that grants vault owners full access
    to their own encrypted data. Issued after passphrase verification.
    
    Security:
    - Requires Firebase ID token verification
    - Only issued to the user for their own vault
    - 24-hour expiry (renewable)
    - Logged to consent_audit
    
    CONSENT-FIRST ARCHITECTURE:
    - Vault owners use this token instead of bypassing authentication
    - Maintains protocol integrity (no auth bypasses)
    - All access logged for compliance
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing Authorization header with Firebase ID token"
            )
        # Verify request body
        body = await request.json()
        user_id = body.get("userId")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")
        
        firebase_uid = verify_firebase_bearer(auth_header)

        # Ensure user is requesting token for their own vault
        if firebase_uid != user_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot issue VAULT_OWNER token for another user"
            )
        
        # Check for existing active VAULT_OWNER token in DB
        now_ms = int(time.time() * 1000)
        service = ConsentDBService()
        active_tokens = await service.get_active_tokens(user_id)
        
        for t in active_tokens:
            # Match scope = vault.owner and agent = self
            if t.get("scope") == ConsentScope.VAULT_OWNER.value and t.get("agent_id") == "self":
                # Check if token has > 1 hour left
                expires_at = t.get("expires_at", 0)
                if expires_at > now_ms + (60 * 60 * 1000):  # 1 hour buffer
                    # REUSE existing token (only if it still validates)
                    #
                    # NOTE: In older deployments, some systems stored a non-token identifier in `token_id`.
                    # If we blindly reuse it, downstream calls fail with "Invalid signature".
                    candidate_token = t.get("token_id")
                    if not candidate_token:
                        logger.warning(
                            f"⚠️ VAULT_OWNER reuse candidate missing token_id for {user_id}; issuing new token"
                        )
                        break

                    is_valid, reason, payload = validate_token(candidate_token, ConsentScope.VAULT_OWNER)
                    if not is_valid or not payload:
                        logger.warning(
                            "⚠️ Stored VAULT_OWNER token failed validation; issuing new token. "
                            f"user_id={user_id} reason={reason}"
                        )
                        break

                    logger.info(f"♻️ Reusing active VAULT_OWNER token for {user_id} (expires: {expires_at})")
                    return {
                        "token": candidate_token,
                        "expiresAt": expires_at,
                        "scope": ConsentScope.VAULT_OWNER.value
                    }
        
        # No valid token found - issue new one
        logger.info(f"🔑 Issuing NEW VAULT_OWNER token for {user_id} (24h expiry)")
        
        # Issue new token (24-hour expiry)
        token_obj = issue_token(
            user_id=user_id,
            agent_id="self",  # Vault owner accessing their own data
            scope=ConsentScope.VAULT_OWNER,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
        )
        
        # Store in consent_audit (CONSENT_GRANTED for get_active_tokens() compatibility)
        service = ConsentDBService()
        await service.insert_event(
            user_id=user_id,
            agent_id="self",
            scope="vault.owner",
            action="CONSENT_GRANTED",  # Use CONSENT_GRANTED for active token queries
            token_id=token_obj.token,  # Store FULL token (not truncated)
            expires_at=token_obj.expires_at
        )
        
        logger.info(f"✅ VAULT_OWNER token issued and stored for {user_id}")
        
        return {
            "token": token_obj.token,
            "expiresAt": token_obj.expires_at,
            "scope": "vault.owner"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ VAULT_OWNER token issuance failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/revoke")
async def revoke_consent(request: Request):
    """
    User revokes an active consent token.
    
    This removes access for the app that was previously granted consent.
    For VAULT_OWNER tokens, this effectively locks the vault.
    """
    try:
        from hushh_mcp.consent.token import revoke_token
        
        body = await request.json()
        userId = body.get("userId")
        scope = body.get("scope")
        
        if not userId or not scope:
            raise HTTPException(status_code=400, detail="userId and scope are required")
        
        logger.info(f"🔒 User {userId} revoking consent for scope: {scope}")
        
        # Get the active token for this scope
        service = ConsentDBService()
    active_tokens = await service.get_active_tokens(userId)
        logger.info(f"📋 Found {len(active_tokens)} active tokens for user")
        
        token_to_revoke = None
        for token in active_tokens:
            logger.info(f"   Token scope: {token.get('scope')}, looking for: {scope}")
            if token.get("scope") == scope:
                token_to_revoke = token
                break
        
        if not token_to_revoke:
            raise HTTPException(status_code=404, detail=f"No active consent found for scope: {scope}")
        
        # CRITICAL: Add the actual token to in-memory revocation set
        # This ensures validate_token() will reject it immediately
        original_token = token_to_revoke.get("token_id")
        if original_token and not original_token.startswith("REVOKED_"):
            revoke_token(original_token)
            logger.info(f"🔒 Token added to in-memory revocation set")
        
        # Generate a NEW unique token_id for the REVOKED event
        # (Cannot reuse original token_id due to UNIQUE constraint on consent_audit table)
        import time
        revoke_token_id = f"REVOKED_{int(time.time() * 1000)}_{scope}"
        agent_id = token_to_revoke.get("agent_id") or token_to_revoke.get("developer") or "Unknown"
        request_id = token_to_revoke.get("request_id")
        
        logger.info(f"🔒 Revoking - new token_id: {revoke_token_id}, agent: {agent_id}, request_id: {request_id}")
        
        # Log REVOKED event to database (link to original request_id for trail)
        service = ConsentDBService()
        await service.insert_event(
            user_id=userId,
            agent_id=agent_id,
            scope=scope,
            action="REVOKED",
            token_id=revoke_token_id,
            request_id=request_id
        )
        logger.info(f"✅ REVOKED event saved to DB for scope: {scope}")
        
        # Return special flag for VAULT_OWNER revocation so client knows to lock vault
        is_vault_owner = scope == "vault.owner" or scope == "VAULT_OWNER"
        
        return {
            "status": "revoked", 
            "message": f"Consent for {scope} has been revoked",
            "lockVault": is_vault_owner  # Signal client to lock vault
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Revoke error: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


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
        logger.warning("⚠️ No export data found for token")
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
