# api/routes/kai/preferences.py
"""
Kai Preferences Endpoints

Handles encrypted user preferences for Kai (risk profile, processing mode).
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from hushh_mcp.services.vault_db import VaultDBService, ConsentValidationError
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.types import EncryptedPayload
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# HELPERS
# ============================================================================

async def validate_vault_owner(authorization: str, expected_user_id: str) -> None:
    """Validate VAULT_OWNER token and ensure user_id matches."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Missing consent token. Call /api/consent/owner-token first."
        )
    
    token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(token, ConsentScope.VAULT_OWNER)
    
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    if payload.user_id != expected_user_id:
        raise HTTPException(
            status_code=403, 
            detail="Token user does not match requested user"
        )


# ============================================================================
# MODELS
# ============================================================================

class EncryptedPreference(BaseModel):
    field_name: str
    ciphertext: str
    iv: str
    tag: Optional[str] = ""


class StorePreferencesRequest(BaseModel):
    user_id: str
    preferences: List[EncryptedPreference]


class PreferencesResponse(BaseModel):
    preferences: List[EncryptedPreference]


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/preferences/store")
async def store_preferences(
    request: StorePreferencesRequest,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Store encrypted user preferences (Risk Profile, Processing Mode).
    
    REQUIRES: VAULT_OWNER consent token.
    Upserts by (user_id, field_name).
    """
    await validate_vault_owner(authorization, request.user_id)
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    field_names = [p.field_name for p in request.preferences]
    await consent_service.log_operation(
        user_id=request.user_id,
        operation="kai.preferences.write",
        metadata={"fields": field_names}
    )
    
    # Use VaultDBService to store preferences
    service = VaultDBService()
    try:
        # Convert to EncryptedPayload format
        fields = {}
        for pref in request.preferences:
            fields[pref.field_name] = EncryptedPayload(
                ciphertext=pref.ciphertext,
                iv=pref.iv,
                tag=pref.tag or "",
                algorithm="aes-256-gcm",
                encoding="base64"
            )
        
        # Get consent token from authorization header
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing consent token")
        consent_token = authorization.replace("Bearer ", "")
        
        await service.store_encrypted_fields(
            user_id=request.user_id,
            domain="kai_preferences",
            fields=fields,
            consent_token=consent_token
        )
        
        logger.info(f"[Kai] Stored {len(request.preferences)} encrypted preferences for {request.user_id}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"[Kai] Failed to store preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to store settings")


@router.get("/preferences/{user_id}", response_model=PreferencesResponse)
async def get_preferences(
    user_id: str,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Retrieve all encrypted preferences for a user.
    
    REQUIRES: VAULT_OWNER consent token.
    """
    await validate_vault_owner(authorization, user_id)
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.preferences.read"
    )
    
    # Use VaultDBService to get preferences
    service = VaultDBService()
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing consent token")
    consent_token = authorization.replace("Bearer ", "")
    
    try:
        encrypted_fields = await service.get_encrypted_fields(
            user_id=user_id,
            domain="kai_preferences",
            consent_token=consent_token,
            field_names=None
        )
    except ConsentValidationError as e:
        raise HTTPException(
            status_code=401 if e.reason in ["missing_token", "invalid_token"] else 403,
            detail=str(e)
        )
    
    prefs = []
    for field_name, payload in encrypted_fields.items():
        prefs.append(EncryptedPreference(
            field_name=field_name,
            ciphertext=payload.ciphertext,
            iv=payload.iv,
            tag=payload.tag or ""
        ))
    
    return PreferencesResponse(preferences=prefs)


@router.delete("/preferences/{user_id}")
async def delete_preferences(
    user_id: str,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Delete all encrypted Kai preferences for a user.

    Requires VAULT_OWNER (consent protocol).
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(token)
    if not valid or not payload:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")

    if payload.scope != ConsentScope.VAULT_OWNER.value:
        raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")

    if payload.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete preferences for another user")

    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.preferences.delete"
    )

    # Use VaultDBService to delete preferences
    service = VaultDBService()
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    consent_token = authorization.replace("Bearer ", "")
    
    try:
        deleted_count = await service.delete_encrypted_fields(
            user_id=user_id,
            domain="kai_preferences",
            consent_token=consent_token,
            field_names=None  # Delete all
        )
    except ConsentValidationError as e:
        raise HTTPException(
            status_code=401 if e.reason in ["missing_token", "invalid_token"] else 403,
            detail=str(e)
        )

    return {"success": True, "deleted_count": deleted_count}
