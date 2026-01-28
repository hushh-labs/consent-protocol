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
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from hushh_mcp.services.investor_db import InvestorDBService
from hushh_mcp.services.user_investor_profile_db import UserInvestorProfileService
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from api.utils.firebase_auth import verify_firebase_bearer

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


class AutoDetectMatch(BaseModel):
    """Investor match from auto-detection."""
    id: int
    name: str
    firm: Optional[str] = None
    title: Optional[str] = None
    aum_billions: Optional[float] = None
    investment_style: Optional[list] = None
    top_holdings: Optional[list] = None
    confidence: float


class AutoDetectResponse(BaseModel):
    """Response from auto-detection."""
    detected: bool
    display_name: Optional[str] = None
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
    
    Flow:
    1. Validate Firebase ID token
    2. Extract displayName from token
    3. Search investor_profiles by displayName
    4. Return best matches with confidence scores
    
    If no displayName or no matches found, returns {"detected": False}
    """
    import re

    # Validate Firebase token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    # Verify Firebase ID token and pull name/email from decoded claims
    try:
        # verify uid + token validity
        verify_firebase_bearer(authorization)

        # read decoded token claims (avoid leaking errors)
        from firebase_admin import auth as firebase_auth

        token = authorization.replace("Bearer ", "")
        decoded_token = firebase_auth.verify_id_token(token)
        user_name = decoded_token.get("name", "")
        user_email = decoded_token.get("email", "")

        # Try display name first, fallback to email prefix
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
        # Get full profile to access top_holdings
        profile = await service.get_investor_by_id(result["id"])
        top_holdings = profile.get("top_holdings") if profile else None
        
        matches.append({
            "id": result["id"],
            "name": result["name"],
            "firm": result.get("firm"),
            "title": result.get("title"),
            "aum_billions": result.get("aum_billions"),
            "investment_style": result.get("investment_style"),
            "top_holdings": top_holdings[:3] if top_holdings else None,  # Top 3 only
            "confidence": result.get("similarity_score", 0.0)
        })
        
        logger.info(f"✅ Found {len(matches)} investor matches for: {display_name}")
        
        # Debug logging to inspect matches content before Pydantic validation
        try:
            for match in matches:
                logger.info(f"Match: {match}")
            
            return {
                "detected": True,
                "display_name": display_name,
                "matches": matches
            }
        except Exception as e:
            logger.error(f"Error constructing/validating response: {e}")
            raise HTTPException(status_code=500, detail=str(e))

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
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
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
    
    # Use UserInvestorProfileService to create/update the encrypted profile
    profile_service = UserInvestorProfileService()
    
    try:
        result = await profile_service.create_or_update_profile(
            token=token,
            investor_id=request.investor_id,
            profile_data_ciphertext=request.profile_data_ciphertext,
            profile_data_iv=request.profile_data_iv,
            profile_data_tag=request.profile_data_tag,
            custom_holdings_ciphertext=request.custom_holdings_ciphertext,
            custom_holdings_iv=request.custom_holdings_iv,
            custom_holdings_tag=request.custom_holdings_tag,
            preferences_ciphertext=request.preferences_ciphertext,
            preferences_iv=request.preferences_iv,
            preferences_tag=request.preferences_tag
        )
        
        logger.info(f"✅ Identity confirmed: {user_id} → {investor['name']} ({investor.get('firm', 'N/A')})")
        
        return {
            "success": True,
            "message": f"Identity confirmed as {investor['name']}",
            "user_investor_profile_id": result.get("id") if result else None
        }
        
    except Exception as e:
        logger.error(f"Failed to confirm identity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to confirm identity: {str(e)}")


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
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # Use service layer for user_investor_profiles operations
    profile_service = UserInvestorProfileService()
    
    try:
        status = await profile_service.get_status(token)
        return status
    except Exception as e:
        logger.error(f"Error getting identity status: {e}")
        return {"has_confirmed_identity": False}


class GetProfileRequest(BaseModel):
    consent_token: str

@router.post("/profile")
async def get_encrypted_profile(
    request: GetProfileRequest
):
    """
    Get user's encrypted investor profile.
    
    Returns encrypted ciphertext for client-side decryption.
    This is what agents use for personalization.
    
    NOTE: Uses POST + Body for robust token transmission (avoids header stripping).
    """
    token = request.consent_token
    
    try:
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # Use service layer for user_investor_profiles operations
    profile_service = UserInvestorProfileService()
    
    profile = await profile_service.get_profile(token)
    
    if not profile:
        raise HTTPException(status_code=404, detail="No confirmed identity found")
    
    return profile


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
        is_valid, error_msg, payload = validate_token(token)
        if not is_valid or not payload:
             raise HTTPException(status_code=401, detail=error_msg or "Invalid token")

        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise HTTPException(status_code=403, detail="VAULT_OWNER scope required")
        user_id = payload.user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid VAULT_OWNER token")
    
    # Use service layer for user_investor_profiles operations
    profile_service = UserInvestorProfileService()
    
    await profile_service.delete_profile(token)
    
    logger.info(f"🗑️ Identity reset for user {user_id}")
    
    return {"success": True, "message": "Identity reset successfully"}
