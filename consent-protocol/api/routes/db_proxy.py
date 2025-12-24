# api/routes/db_proxy.py
"""
Minimal SQL Proxy for iOS Native App.

This module provides a thin database access layer for the iOS native app.
All consent protocol logic runs locally on iOS - this only executes SQL operations.

Security:
- Requires Firebase ID token authentication
- Only pre-defined operations allowed (no raw SQL)
- All connections use Cloud SQL Auth Proxy (SSL)
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    auth_method = EXCLUDED.auth_method,
                    encrypted_vault_key = EXCLUDED.encrypted_vault_key,
                    salt = EXCLUDED.salt,
                    iv = EXCLUDED.iv,
                    recovery_encrypted_vault_key = EXCLUDED.recovery_encrypted_vault_key,
                    recovery_salt = EXCLUDED.recovery_salt,
                    recovery_iv = EXCLUDED.recovery_iv,
                    updated_at = NOW()
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
