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

from db.connection import get_pool
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
    
    pool = await get_pool()
    
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for pref in request.preferences:
                    await conn.execute(
                        """
                        INSERT INTO vault_kai_preferences (
                            user_id, field_name, ciphertext, iv, tag, updated_at, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (user_id, field_name) 
                        DO UPDATE SET 
                            ciphertext = EXCLUDED.ciphertext,
                            iv = EXCLUDED.iv,
                            tag = EXCLUDED.tag,
                            updated_at = EXCLUDED.updated_at
                        """,
                        request.user_id,
                        pref.field_name,
                        pref.ciphertext,
                        pref.iv,
                        pref.tag,
                        int(datetime.now().timestamp()),
                        int(datetime.now().timestamp())
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
    
    pool = await get_pool()
    
    rows = await pool.fetch(
        """
        SELECT field_name, ciphertext, iv, tag
        FROM vault_kai_preferences
        WHERE user_id = $1
        """,
        user_id
    )
    
    prefs = []
    for row in rows:
        prefs.append(EncryptedPreference(
            field_name=row["field_name"],
            ciphertext=row["ciphertext"],
            iv=row["iv"],
            tag=row["tag"] or ""
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

    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM vault_kai_preferences WHERE user_id = $1",
        user_id
    )

    return {"success": True, "result": result}
