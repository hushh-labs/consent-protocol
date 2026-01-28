# api/routes/db_proxy.py
"""
⚠️ DEPRECATED ⚠️ - Minimal SQL Proxy for iOS Native App.

🔒 SECURITY WARNING 🔒
This module has CRITICAL SECURITY VULNERABILITIES:
- /db/food/get and /db/professional/get endpoints LACK AUTHENTICATION
- Any client with a userId can retrieve encrypted vault data
- This bypasses the consent-first architecture

🚀 MIGRATION PATH:
Please use the new modular agents instead:
- Food: /api/food/preferences (requires VAULT_OWNER token)
- Professional: /api/professional/preferences (requires VAULT_OWNER token)

These routes are maintained for backward compatibility ONLY.
They will be removed in a future version.

Legacy Description:
This module provides a thin database access layer for the iOS native app.
All consent protocol logic runs locally on iOS - this only executes SQL operations.

Security (BROKEN - DO NOT USE):
- Should require Firebase ID token authentication (NOT ENFORCED)
- Only pre-defined operations allowed (no raw SQL)
- All connections use Cloud SQL Auth Proxy (SSL)
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from hushh_mcp.services.vault_db import VaultDBService
from hushh_mcp.services.vault_keys_service import VaultKeysService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/db", tags=["Database Proxy (DEPRECATED)"])


# ============================================================================
# Request/Response Models
# ============================================================================

class VaultCheckRequest(BaseModel):
    userId: str


class VaultCheckResponse(BaseModel):
    hasVault: bool


class VaultGetRequest(BaseModel):
    userId: str


class VaultKeyData(BaseModel):
    authMethod: str
    encryptedVaultKey: str
    salt: str
    iv: str
    recoveryEncryptedVaultKey: str
    recoverySalt: str
    recoveryIv: str


class VaultSetupRequest(BaseModel):
    userId: str
    authMethod: str = "passphrase"
    encryptedVaultKey: str
    salt: str
    iv: str
    recoveryEncryptedVaultKey: str
    recoverySalt: str
    recoveryIv: str


class SuccessResponse(BaseModel):
    success: bool


# ============================================================================
# Firebase Token Verification (Optional - for authenticated requests)
# ============================================================================

async def verify_firebase_token_optional(authorization: Optional[str] = None) -> Optional[dict]:
    """
    Optional Firebase token verification.
    In production, this should always be required.
    For development, we allow requests without tokens.
    """
    if not authorization:
        return None
    
    # In development mode, accept any token format
    # In production, use firebase_admin to verify
    try:
        if authorization.startswith("Bearer "):
            token = authorization[7:]
            # TODO: Use firebase_admin.auth.verify_id_token(token) in production
            # For now, just return a placeholder
            return {"uid": None, "token": token}
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
    
    return None


# ============================================================================
# Vault Endpoints (Minimal SQL Operations)
# ============================================================================

@router.post("/vault/check", response_model=VaultCheckResponse)
async def vault_check(request: VaultCheckRequest):
    """
    Check if a vault exists for the user.
    
    ⚠️ DEPRECATED: Use modern vault endpoints instead.
    """
    try:
        service = VaultKeysService()
        has_vault = await service.check_vault_exists(request.userId)
        return VaultCheckResponse(hasVault=has_vault)
    
    except Exception as e:
        logger.error(f"vault/check error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/vault/get", response_model=VaultKeyData)
async def vault_get(request: VaultGetRequest):
    """
    Get encrypted vault key data for the user.
    
    ⚠️ DEPRECATED: Use modern vault endpoints instead.
    """
    try:
        service = VaultKeysService()
        vault_data = await service.get_vault_key(request.userId)
        
        if not vault_data:
            raise HTTPException(status_code=404, detail="Vault not found")
        
        return VaultKeyData(
            authMethod=vault_data["authMethod"],
            encryptedVaultKey=vault_data["encryptedVaultKey"],
            salt=vault_data["salt"],
            iv=vault_data["iv"],
            recoveryEncryptedVaultKey=vault_data["recoveryEncryptedVaultKey"],
            recoverySalt=vault_data["recoverySalt"],
            recoveryIv=vault_data["recoveryIv"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"vault/get error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/vault/setup", response_model=SuccessResponse)
async def vault_setup(request: VaultSetupRequest):
    """
    Store encrypted vault key data.
    
    ⚠️ DEPRECATED: Use modern vault endpoints instead.
    """
    try:
        service = VaultKeysService()
        await service.setup_vault(
            user_id=request.userId,
            auth_method=request.authMethod,
            encrypted_vault_key=request.encryptedVaultKey,
            salt=request.salt,
            iv=request.iv,
            recovery_encrypted_vault_key=request.recoveryEncryptedVaultKey,
            recovery_salt=request.recoverySalt,
            recovery_iv=request.recoveryIv
        )
        return SuccessResponse(success=True)
    
    except Exception as e:
        logger.error(f"vault/setup error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# ============================================================================
# Domain Data Endpoints (Food & Professional)
# ============================================================================

class DomainGetRequest(BaseModel):
    userId: str


class DomainPreferencesResponse(BaseModel):
    domain: str
    preferences: dict | None


@router.post("/food/get", response_model=DomainPreferencesResponse)
async def food_get(request: DomainGetRequest):
    """
    Get all food preferences for the user.
    
    ⚠️ DEPRECATED: This endpoint lacks authentication!
    Use /api/food/preferences instead which requires VAULT_OWNER token.
    """
    try:
        service = VaultDBService()
        preferences = await service._get_domain_preferences_deprecated(request.userId, "food")
        return DomainPreferencesResponse(domain="food", preferences=preferences if preferences else None)
    
    except Exception as e:
        logger.error(f"food/get error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/professional/get", response_model=DomainPreferencesResponse)
async def professional_get(request: DomainGetRequest):
    """
    Get all professional data for the user.
    
    ⚠️ DEPRECATED: This endpoint lacks authentication!
    Use /api/professional/preferences instead which requires VAULT_OWNER token.
    """
    try:
        service = VaultDBService()
        preferences = await service._get_domain_preferences_deprecated(request.userId, "professional")
        return DomainPreferencesResponse(domain="professional", preferences=preferences if preferences else None)
    
    except Exception as e:
        logger.error(f"professional/get error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# ============================================================================
# Vault Status Endpoint (Token-Enforced Metadata)
# ============================================================================

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from fastapi import Request


def validate_vault_owner_token(consent_token: str, user_id: str) -> None:
    """Validate VAULT_OWNER consent token."""
    if not consent_token:
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Vault owner must provide VAULT_OWNER token."
        )
    
    valid, reason, token_obj = validate_token(consent_token)
    
    if not valid:
        logger.warning(f"Invalid consent token: {reason}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid consent token: {reason}"
        )
    
    if token_obj.scope != ConsentScope.VAULT_OWNER.value:
        logger.warning(
            f"Insufficient scope: {token_obj.scope} (requires {ConsentScope.VAULT_OWNER.value})"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient scope: {token_obj.scope}. VAULT_OWNER scope required."
        )
    
    if token_obj.user_id != user_id:
        logger.warning(
            f"Token userId mismatch: {token_obj.user_id} != {user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Token userId does not match requested userId"
        )
    
    logger.info(f"✅ VAULT_OWNER token validated for {user_id}")


@router.post("/vault/status")
async def get_vault_status(request: Request):
    """
    Get status for all vault domains.
    Returns metadata without encrypted data.
    
    Requires VAULT_OWNER token.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")
        
        # Use VaultKeysService (handles consent validation internally)
        service = VaultKeysService()
        status = await service.get_vault_status(user_id, consent_token)
        
        return status
    
    except ValueError as e:
        # Consent validation errors
        raise HTTPException(status_code=401, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Vault status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))