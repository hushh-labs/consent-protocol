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
from hushh_mcp.services.consent_db import ConsentDBService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/db", tags=["Database Proxy"])


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
    
    This is a minimal SQL operation - no logic, just database check.
    The iOS app handles all consent protocol logic locally.
    """
    try:
        # Use service layer (even though this endpoint is deprecated)
        service = VaultDBService()
        supabase = service.get_supabase()
        response = supabase.table("vault_keys")\
            .select("user_id")\
            .eq("user_id", request.userId)\
            .limit(1)\
            .execute()
        
        has_vault = len(response.data) > 0 if response.data else False
        return VaultCheckResponse(hasVault=has_vault)
    
    except Exception as e:
        logger.error(f"vault/check error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/vault/get", response_model=VaultKeyData)
async def vault_get(request: VaultGetRequest):
    """
    Get encrypted vault key data for the user.
    
    Returns the encrypted vault key (still encrypted with user's passphrase).
    Decryption happens locally on iOS.
    """
    try:
        # Use service layer (even though this endpoint is deprecated)
        service = VaultDBService()
        supabase = service.get_supabase()
        response = supabase.table("vault_keys")\
            .select("auth_method,encrypted_vault_key,salt,iv,recovery_encrypted_vault_key,recovery_salt,recovery_iv")\
            .eq("user_id", request.userId)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Vault not found")
        
        row = response.data[0]
        return VaultKeyData(
            authMethod=row.get("auth_method"),
            encryptedVaultKey=row.get("encrypted_vault_key"),
            salt=row.get("salt"),
            iv=row.get("iv"),
            recoveryEncryptedVaultKey=row.get("recovery_encrypted_vault_key"),
            recoverySalt=row.get("recovery_salt"),
            recoveryIv=row.get("recovery_iv")
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
    
    The vault key is already encrypted locally on iOS with the user's passphrase.
    This just stores the encrypted blob in the database.
    """
    try:
        # Use service layer (even though this endpoint is deprecated)
        from datetime import datetime
        service = VaultDBService()
        supabase = service.get_supabase()
        
        now_ms = int(datetime.now().timestamp() * 1000)
        data = {
            "user_id": request.userId,
            "auth_method": request.authMethod,
            "encrypted_vault_key": request.encryptedVaultKey,
            "salt": request.salt,
            "iv": request.iv,
            "recovery_encrypted_vault_key": request.recoveryEncryptedVaultKey,
            "recovery_salt": request.recoverySalt,
            "recovery_iv": request.recoveryIv,
            "created_at": now_ms,
            "updated_at": now_ms
        }
        
        supabase.table("vault_keys").upsert(
            data,
            on_conflict="user_id"
        ).execute()
        
        logger.info(f"Vault setup for user {request.userId[:8]}...")
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
    
    Returns encrypted data from vault_food table.
    Data is still encrypted - decryption happens on the client.
    """
    try:
        # ⚠️ DEPRECATED: This endpoint lacks authentication
        # Use /api/food/preferences instead which requires VAULT_OWNER token
        # Use service layer for consistency (even though deprecated)
        service = VaultDBService()
        supabase = service.get_supabase()
        response = supabase.table("vault_food")\
            .select("field_name,ciphertext,iv,tag,algorithm")\
            .eq("user_id", request.userId)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return DomainPreferencesResponse(domain="food", preferences=None)
        
        # Build preferences object from rows
        preferences = {}
        for row in response.data:
            preferences[row.get("field_name")] = {
                "ciphertext": row.get("ciphertext"),
                "iv": row.get("iv"),
                "tag": row.get("tag"),
                "algorithm": row.get("algorithm") or "aes-256-gcm",
                "encoding": "base64"
            }
        
        return DomainPreferencesResponse(domain="food", preferences=preferences)
    
    except Exception as e:
        logger.error(f"food/get error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/professional/get", response_model=DomainPreferencesResponse)
async def professional_get(request: DomainGetRequest):
    """
    Get all professional data for the user.
    
    Returns encrypted data from vault_professional table.
    Data is still encrypted - decryption happens on the client.
    """
    try:
        # ⚠️ DEPRECATED: This endpoint lacks authentication
        # Use /api/professional/preferences instead which requires VAULT_OWNER token
        # Use service layer for consistency (even though deprecated)
        service = VaultDBService()
        supabase = service.get_supabase()
        response = supabase.table("vault_professional")\
            .select("field_name,ciphertext,iv,tag,algorithm")\
            .eq("user_id", request.userId)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return DomainPreferencesResponse(domain="professional", preferences=None)
        
        # Build preferences object from rows
        preferences = {}
        for row in response.data:
            preferences[row.get("field_name")] = {
                "ciphertext": row.get("ciphertext"),
                "iv": row.get("iv"),
                "tag": row.get("tag"),
                "algorithm": row.get("algorithm") or "aes-256-gcm",
                "encoding": "base64"
            }
        
        return DomainPreferencesResponse(domain="professional", preferences=preferences)
    
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
    Get status for all vault domains (optimized single query).
    Returns metadata without encrypted data.
    
    Checks:
    - Food: vault_food table (field count)
    - Professional: vault_professional table (field count)
    - Kai: user_investor_profiles (onboarded) + vault_kai_preferences (settings count)
    
    OPTIMIZED: Uses single CTE query for efficient connection pool usage.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")
        
        # Validate VAULT_OWNER token
        validate_vault_owner_token(consent_token, user_id)
        
        # Use service layer - Supabase doesn't support CTEs, so we'll make separate queries
        service = VaultDBService()
        supabase = service.get_supabase()
        
        # Get counts for each domain
        food_response = supabase.table("vault_food")\
            .select("user_id", count="exact")\
            .eq("user_id", user_id)\
            .limit(0)\
            .execute()
        food_count = food_response.count if hasattr(food_response, 'count') and food_response.count is not None else 0
        
        prof_response = supabase.table("vault_professional")\
            .select("user_id", count="exact")\
            .eq("user_id", user_id)\
            .limit(0)\
            .execute()
        prof_count = prof_response.count if hasattr(prof_response, 'count') and prof_response.count is not None else 0
        
        kai_check_response = supabase.table("user_investor_profiles")\
            .select("user_id")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        kai_onboarded = len(kai_check_response.data) > 0 if kai_check_response.data else False
        
        kai_prefs_response = supabase.table("vault_kai_preferences")\
            .select("user_id", count="exact")\
            .eq("user_id", user_id)\
            .limit(0)\
            .execute()
        kai_prefs_count = kai_prefs_response.count if hasattr(kai_prefs_response, 'count') and kai_prefs_response.count is not None else 0
        
        # Kai domain is active if either onboarded OR has preferences
        kai_has_data = kai_onboarded or kai_prefs_count > 0
        
        domains = {
            "food": {"hasData": food_count > 0, "fieldCount": food_count},
            "professional": {"hasData": prof_count > 0, "fieldCount": prof_count},
            "kai": {
                "hasData": kai_has_data,
                "onboarded": kai_onboarded,
                "fieldCount": kai_prefs_count  # Number of Kai preference fields set
            }
        }
        
        total_active = sum(1 for d in domains.values() if d["hasData"])
        
        logger.info(f"✅ Vault status for {user_id}: {total_active}/3 domains active")
        
        return {
            "domains": domains,
            "totalActive": total_active,
            "total": 3
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Vault status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))