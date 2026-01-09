# api/routes/identity.py
"""
Identity Resolution API Routes

Handles the consent-based flow for matching users to public investor profiles
and creating encrypted copies in their private vault.

Flow:
1. User enters their name
2. Search returns public profile matches
3. User confirms "This is me"
4. System creates encrypted vault copy (consent-then-encrypt)
5. Agents only access the vault copy

Privacy architecture:
- Search uses investor_profiles (PUBLIC, unencrypted)
- Confirmation creates user_investor_profiles (PRIVATE, E2E encrypted)
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.connection import get_pool
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/identity", tags=["Identity Resolution"])


# ============================================================================
# Request/Response Models
# ============================================================================

class IdentityConfirmRequest(BaseModel):
    """Request to confirm identity and create vault copy."""
    investor_id: int  # ID in investor_profiles table
    
    # Encrypted profile data (client encrypts before sending)
    profile_data_ciphertext: str
    profile_data_iv: str
    profile_data_tag: str
    
    # Optional: custom holdings (user's actual holdings)
    custom_holdings_ciphertext: Optional[str] = None
    custom_holdings_iv: Optional[str] = None
    custom_holdings_tag: Optional[str] = None
    
    # Optional: custom preferences
    preferences_ciphertext: Optional[str] = None
    preferences_iv: Optional[str] = None
    preferences_tag: Optional[str] = None


class IdentityConfirmResponse(BaseModel):
    """Response after identity confirmation."""
    success: bool
    message: str
    user_investor_profile_id: int


class IdentityStatus(BaseModel):
    """User's identity resolution status."""
    has_confirmed_identity: bool
    confirmed_at: Optional[str] = None
    investor_name: Optional[str] = None
    investor_firm: Optional[str] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/confirm", response_model=IdentityConfirmResponse)
async def confirm_identity(
    request: IdentityConfirmRequest,
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Confirm identity and create encrypted vault copy.
    
    This is the CONSENT BOUNDARY - public data becomes private data.
    
    Requires VAULT_OWNER token (user must have unlocked vault).
    
    Flow:
    1. Validate VAULT_OWNER token
    2. Fetch public profile from investor_profiles
    3. Store ENCRYPTED copy in user_investor_profiles
    4. Return success
    
    After this, agents only access the vault copy.
    """
    # Validate VAULT_OWNER token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = validate_token(token)
        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Verify investor exists
        investor = await conn.fetchrow(
            "SELECT id, name, firm FROM investor_profiles WHERE id = $1",
            request.investor_id
        )
        
        if not investor:
            raise HTTPException(status_code=404, detail="Investor profile not found")
        
        # Create or update user's encrypted profile
        now = time.time()
        
        result = await conn.fetchval("""
            INSERT INTO user_investor_profiles (
                user_id,
                confirmed_investor_id,
                profile_data_ciphertext,
                profile_data_iv,
                profile_data_tag,
                custom_holdings_ciphertext,
                custom_holdings_iv,
                custom_holdings_tag,
                preferences_ciphertext,
                preferences_iv,
                preferences_tag,
                confirmed_at,
                consent_scope
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 'vault.owner'
            )
            ON CONFLICT (user_id) DO UPDATE SET
                confirmed_investor_id = EXCLUDED.confirmed_investor_id,
                profile_data_ciphertext = EXCLUDED.profile_data_ciphertext,
                profile_data_iv = EXCLUDED.profile_data_iv,
                profile_data_tag = EXCLUDED.profile_data_tag,
                custom_holdings_ciphertext = EXCLUDED.custom_holdings_ciphertext,
                custom_holdings_iv = EXCLUDED.custom_holdings_iv,
                custom_holdings_tag = EXCLUDED.custom_holdings_tag,
                preferences_ciphertext = EXCLUDED.preferences_ciphertext,
                preferences_iv = EXCLUDED.preferences_iv,
                preferences_tag = EXCLUDED.preferences_tag,
                confirmed_at = NOW(),
                updated_at = NOW()
            RETURNING id
        """,
            user_id,
            request.investor_id,
            request.profile_data_ciphertext,
            request.profile_data_iv,
            request.profile_data_tag,
            request.custom_holdings_ciphertext,
            request.custom_holdings_iv,
            request.custom_holdings_tag,
            request.preferences_ciphertext,
            request.preferences_iv,
            request.preferences_tag
        )
        
        logger.info(f"✅ Identity confirmed: {user_id} → {investor['name']} ({investor['firm']})")
        
        return {
            "success": True,
            "message": f"Identity confirmed as {investor['name']}",
            "user_investor_profile_id": result
        }


@router.get("/status", response_model=IdentityStatus)
async def get_identity_status(
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Get user's identity resolution status.
    
    Returns whether user has confirmed an identity and basic info.
    """
    # Validate VAULT_OWNER token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = validate_token(token)
        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                uip.confirmed_at,
                ip.name as investor_name,
                ip.firm as investor_firm
            FROM user_investor_profiles uip
            LEFT JOIN investor_profiles ip ON uip.confirmed_investor_id = ip.id
            WHERE uip.user_id = $1
        """, user_id)
        
        if row:
            return {
                "has_confirmed_identity": True,
                "confirmed_at": row["confirmed_at"].isoformat() if row["confirmed_at"] else None,
                "investor_name": row["investor_name"],
                "investor_firm": row["investor_firm"]
            }
        else:
            return {
                "has_confirmed_identity": False
            }


@router.get("/profile")
async def get_encrypted_profile(
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Get user's encrypted investor profile.
    
    Returns encrypted ciphertext for client-side decryption.
    This is what agents use for personalization.
    """
    # Validate VAULT_OWNER token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = validate_token(token)
        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM user_investor_profiles WHERE user_id = $1
        """, user_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="No confirmed identity found")
        
        return {
            "profile_data": {
                "ciphertext": row["profile_data_ciphertext"],
                "iv": row["profile_data_iv"],
                "tag": row["profile_data_tag"]
            },
            "custom_holdings": {
                "ciphertext": row["custom_holdings_ciphertext"],
                "iv": row["custom_holdings_iv"],
                "tag": row["custom_holdings_tag"]
            } if row["custom_holdings_ciphertext"] else None,
            "preferences": {
                "ciphertext": row["preferences_ciphertext"],
                "iv": row["preferences_iv"],
                "tag": row["preferences_tag"]
            } if row["preferences_ciphertext"] else None,
            "confirmed_at": row["confirmed_at"].isoformat() if row["confirmed_at"] else None,
            "algorithm": row["algorithm"]
        }


@router.delete("/profile")
async def delete_identity(
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Delete user's confirmed identity (reset).
    
    Use when user wants to re-confirm or start fresh.
    """
    # Validate VAULT_OWNER token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = validate_token(token)
        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        deleted = await conn.execute(
            "DELETE FROM user_investor_profiles WHERE user_id = $1",
            user_id
        )
        
        logger.info(f"🗑️ Identity reset for user {user_id}")
        
        return {"success": True, "message": "Identity reset successfully"}
