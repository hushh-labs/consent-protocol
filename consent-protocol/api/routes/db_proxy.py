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

from db.connection import get_pool

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
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT 1 FROM vault_keys WHERE user_id = $1",
                request.userId
            )
        
        return VaultCheckResponse(hasVault=result is not None)
    
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
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT auth_method, encrypted_vault_key, salt, iv,
                       recovery_encrypted_vault_key, recovery_salt, recovery_iv
                FROM vault_keys WHERE user_id = $1
                """,
                request.userId
            )
        
        if not row:
            raise HTTPException(status_code=404, detail="Vault not found")
        
        return VaultKeyData(
            authMethod=row["auth_method"],
            encryptedVaultKey=row["encrypted_vault_key"],
            salt=row["salt"],
            iv=row["iv"],
            recoveryEncryptedVaultKey=row["recovery_encrypted_vault_key"],
            recoverySalt=row["recovery_salt"],
            recoveryIv=row["recovery_iv"]
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
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO vault_keys (
                    user_id, auth_method,
                    encrypted_vault_key, salt, iv,
                    recovery_encrypted_vault_key, recovery_salt, recovery_iv,
                    created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT))
                ON CONFLICT (user_id) DO UPDATE SET
                    auth_method = EXCLUDED.auth_method,
                    encrypted_vault_key = EXCLUDED.encrypted_vault_key,
                    salt = EXCLUDED.salt,
                    iv = EXCLUDED.iv,
                    recovery_encrypted_vault_key = EXCLUDED.recovery_encrypted_vault_key,
                    recovery_salt = EXCLUDED.recovery_salt,
                    recovery_iv = EXCLUDED.recovery_iv,
                    updated_at = CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT)
                """,
                request.userId,
                request.authMethod,
                request.encryptedVaultKey,
                request.salt,
                request.iv,
                request.recoveryEncryptedVaultKey,
                request.recoverySalt,
                request.recoveryIv
            )
        
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
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT field_name, ciphertext, iv, tag, algorithm
                FROM vault_food WHERE user_id = $1
                """,
                request.userId
            )
        
        if not rows:
            return DomainPreferencesResponse(domain="food", preferences=None)
        
        # Build preferences object from rows
        preferences = {}
        for row in rows:
            preferences[row["field_name"]] = {
                "ciphertext": row["ciphertext"],
                "iv": row["iv"],
                "tag": row["tag"],
                "algorithm": row["algorithm"] or "aes-256-gcm",
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
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT field_name, ciphertext, iv, tag, algorithm
                FROM vault_professional WHERE user_id = $1
                """,
                request.userId
            )
        
        if not rows:
            return DomainPreferencesResponse(domain="professional", preferences=None)
        
        # Build preferences object from rows
        preferences = {}
        for row in rows:
            preferences[row["field_name"]] = {
                "ciphertext": row["ciphertext"],
                "iv": row["iv"],
                "tag": row["tag"],
                "algorithm": row["algorithm"] or "aes-256-gcm",
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
        
        pool = await get_pool()
        
        # OPTIMIZED: Single query with CTEs
        # Note: Kai preferences count includes risk_profile + processing_mode fields
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                WITH food_count AS (
                    SELECT COUNT(*) as cnt FROM vault_food WHERE user_id = $1
                ),
                prof_count AS (
                    SELECT COUNT(*) as cnt FROM vault_professional WHERE user_id = $1
                ),
                kai_check AS (
                    SELECT EXISTS(SELECT 1 FROM user_investor_profiles WHERE user_id = $1) as exists
                ),
                kai_prefs_count AS (
                    SELECT COUNT(*) as cnt FROM vault_kai_preferences WHERE user_id = $1
                )
                SELECT 
                    (SELECT cnt FROM food_count) as food_count,
                    (SELECT cnt FROM prof_count) as prof_count,
                    (SELECT exists FROM kai_check) as kai_onboarded,
                    (SELECT cnt FROM kai_prefs_count) as kai_prefs_count
                """,
                user_id
            )
        
        food_count = row["food_count"]
        prof_count = row["prof_count"]
        kai_onboarded = row["kai_onboarded"]
        kai_prefs_count = row["kai_prefs_count"]
        
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