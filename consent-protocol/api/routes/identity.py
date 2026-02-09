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

NOTE: user_investor_profiles table has been removed. This module is a placeholder
for future refactoring. Endpoints return 503 until migration completes.
"""

import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from api.utils.firebase_auth import verify_firebase_bearer
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.services.investor_db import InvestorDBService

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
    custom_holdings_ciphertext: str | None = None
    custom_holdings_iv: str | None = None
    custom_holdings_tag: str | None = None
    
    # Optional: custom preferences
    preferences_ciphertext: str | None = None
    preferences_iv: str | None = None
    preferences_tag: str | None = None


class IdentityConfirmResponse(BaseModel):
    """Response after identity confirmation."""
    success: bool
    message: str
    user_investor_profile_id: int


class IdentityStatus(BaseModel):
    """User's identity resolution status."""
    has_confirmed_identity: bool
    confirmed_at: str | None = None
    investor_name: str | None = None
    investor_firm: str | None = None


class AutoDetectMatch(BaseModel):
    """Investor match from auto-detection."""
    id: int
    name: str
    firm: str | None = None
    title: str | None = None
    aum_billions: float | None = None
    investment_style: list | None = None
    top_holdings: list | None = None
    confidence: float


class AutoDetectResponse(BaseModel):
    """Response from auto-detection."""
    detected: bool
    display_name: str | None = None
    matches: list[AutoDetectMatch] = []


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/auto-detect", response_model=AutoDetectResponse)
async def auto_detect_investor(
    authorization: str = Header(..., description="Bearer Firebase ID token")
):
    """
    Auto-detect investor from Firebase displayName.
    
    Used during onboarding to suggest identity match.
    """
    # Validate Firebase token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    try:
        verify_firebase_bearer(authorization)

        from firebase_admin import auth as firebase_auth

        token = authorization.replace("Bearer ", "")
        decoded_token = firebase_auth.verify_id_token(token)
        user_name = decoded_token.get("name", "")
        user_email = decoded_token.get("email", "")

        display_name = user_name or (user_email.split("@")[0] if user_email else "")

        if not display_name or len(display_name) < 2:
            return {"detected": False, "display_name": None, "matches": []}

        logger.info(f"🔍 Auto-detecting investor for displayName: {display_name}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    
    # Use service layer for investor search
    service = InvestorDBService()
    search_results = await service.search_investors(name=display_name, limit=5)
    
    if not search_results:
        logger.info(f"📭 No investor matches found for: {display_name}")
        return {"detected": False, "display_name": display_name, "matches": []}
    
    # Convert to match expected format
    matches = []
    for result in search_results:
        profile = await service.get_investor_by_id(result["id"])
        top_holdings = profile.get("top_holdings") if profile else None
        
        matches.append({
            "id": result["id"],
            "name": result["name"],
            "firm": result.get("firm"),
            "title": result.get("title"),
            "aum_billions": result.get("aum_billions"),
            "investment_style": result.get("investment_style"),
            "top_holdings": top_holdings[:3] if top_holdings else None,
            "confidence": result.get("similarity_score", 0.0)
        })
    
    logger.info(f"✅ Found {len(matches)} investor matches for: {display_name}")
    
    return {
        "detected": True,
        "display_name": display_name,
        "matches": matches
    }


@router.post("/confirm", response_model=IdentityConfirmResponse)
async def confirm_identity(
    request: IdentityConfirmRequest,
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Confirm identity and create encrypted vault copy.
    
    This is the CONSENT BOUNDARY - public data becomes private data.
    
    Requires VAULT_OWNER token (user must have unlocked vault).
    
    NOTE: user_investor_profiles table has been removed. This endpoint returns 503
    until database migration completes.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # Use service layer to verify investor exists
    investor_service = InvestorDBService()
    investor = await investor_service.get_investor_by_id(request.investor_id)
    
    if not investor:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    
    # NOTE: user_investor_profiles table has been removed. This functionality needs refactoring.
    raise HTTPException(
        status_code=503, 
        detail="Identity confirmation temporarily unavailable - database schema migration in progress"
    )


@router.get("/status", response_model=IdentityStatus)
async def get_identity_status(
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Get user's identity resolution status.
    
    Returns whether user has confirmed an identity and basic info.
    
    NOTE: user_investor_profiles table has been removed. This endpoint returns 503
    until database migration completes.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # NOTE: user_investor_profiles table has been removed.
    raise HTTPException(
        status_code=503, 
        detail="Identity status temporarily unavailable - database schema migration in progress"
    )


@router.post("/profile")
async def get_encrypted_profile(
    request: "GetProfileRequest"  # Pydantic model reference
):
    """
    Get user's encrypted investor profile.
    
    Returns encrypted ciphertext for client-side decryption.
    This is what agents use for personalization.
    
    NOTE: Uses POST + Body for robust token transmission (avoids header stripping).
    
    NOTE: user_investor_profiles table has been removed. This endpoint returns 503
    until database migration completes.
    """
    # Extract token from request body
    if hasattr(request, "consent_token"):
        token = getattr(request, "consent_token")
    else:
        raise HTTPException(status_code=400, detail="Missing consent_token in request body")
    
    try:
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # NOTE: user_investor_profiles table has been removed.
    raise HTTPException(
        status_code=503, 
        detail="Get encrypted profile temporarily unavailable - database schema migration in progress"
    )


@router.delete("/profile")
async def delete_identity(
    authorization: str = Header(..., description="Bearer VAULT_OWNER token")
):
    """
    Delete user's confirmed identity (reset).
    
    Use when user wants to re-confirm or start fresh.
    
    NOTE: user_investor_profiles table has been removed. This endpoint returns 503
    until database migration completes.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # NOTE: user_investor_profiles table has been removed.
    raise HTTPException(
        status_code=503, 
        detail="Delete identity temporarily unavailable - database schema migration in progress"
    )