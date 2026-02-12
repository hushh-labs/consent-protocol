# api/routes/db_proxy.py
"""
⚠️ DEPRECATED ⚠️ - Minimal SQL Proxy for iOS Native App.

🔒 SECURITY UPDATE 🔒
As of this update, all routes now require Firebase authentication.
This addresses the previous security vulnerabilities.

Legacy Description:
This module provides a thin database access layer for the iOS native app.
All consent protocol logic runs locally on iOS - this only executes SQL operations.

Security:
- All routes now require Firebase ID token authentication
- Only pre-defined operations allowed (no raw SQL)
- All connections use Supabase session pooler (DB_*); SSL required
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from api.middleware import require_firebase_auth, verify_user_id_match
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
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
# Vault Endpoints (Minimal SQL Operations)
# ============================================================================

# NOTE: /food/get and /professional/get removed; domain data is via world-model.


@router.post("/vault/check", response_model=VaultCheckResponse)
async def vault_check(
    request: VaultCheckRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    """
    Check if a vault exists for the user.

    ⚠️ DEPRECATED: Use modern vault endpoints instead.

    SECURITY: Requires Firebase authentication. User can only check their own vault.
    """
    # Verify user is checking their own vault
    verify_user_id_match(firebase_uid, request.userId)

    try:
        service = VaultKeysService()
        has_vault = await service.check_vault_exists(request.userId)
        return VaultCheckResponse(hasVault=has_vault)

    except Exception as e:
        logger.error(f"vault/check error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/vault/get", response_model=VaultKeyData)
async def vault_get(
    request: VaultGetRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    """
    Get encrypted vault key data for the user.

    ⚠️ DEPRECATED: Use modern vault endpoints instead.

    SECURITY: Requires Firebase authentication. User can only get their own vault.
    """
    # Verify user is getting their own vault
    verify_user_id_match(firebase_uid, request.userId)

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
            recoveryIv=vault_data["recoveryIv"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"vault/get error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/vault/setup", response_model=SuccessResponse)
async def vault_setup(
    request: VaultSetupRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    """
    Store encrypted vault key data.

    ⚠️ DEPRECATED: Use modern vault endpoints instead.

    SECURITY: Requires Firebase authentication. User can only setup their own vault.
    """
    # Verify user is setting up their own vault
    verify_user_id_match(firebase_uid, request.userId)

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
            recovery_iv=request.recoveryIv,
        )
        return SuccessResponse(success=True)

    except Exception as e:
        logger.error(f"vault/setup error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# ============================================================================
# Vault Status Endpoint (Token-Enforced Metadata)
# ============================================================================


def validate_vault_owner_token(consent_token: str, user_id: str) -> None:
    """Validate VAULT_OWNER consent token."""
    if not consent_token:
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Vault owner must provide VAULT_OWNER token.",
        )

    valid, reason, token_obj = validate_token(consent_token)

    if not valid:
        logger.warning(f"Invalid consent token: {reason}")
        raise HTTPException(status_code=401, detail=f"Invalid consent token: {reason}")

    if token_obj is None:
        logger.error("Consent token validated but payload missing")
        raise HTTPException(status_code=401, detail="Invalid consent token: missing token payload")

    if token_obj.scope != ConsentScope.VAULT_OWNER:
        logger.warning(
            f"Insufficient scope: {token_obj.scope.value} (requires {ConsentScope.VAULT_OWNER.value})"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient scope: {token_obj.scope.value}. VAULT_OWNER scope required.",
        )

    if str(token_obj.user_id) != user_id:
        logger.warning(f"Token userId mismatch: {token_obj.user_id} != {user_id}")
        raise HTTPException(status_code=403, detail="Token userId does not match requested userId")

    logger.info(f"✅ VAULT_OWNER token validated for {user_id}")


@router.post("/vault/status")
async def get_vault_status(
    request: Request,
    firebase_uid: str = Depends(require_firebase_auth),
):
    """
    Get status for all vault domains.
    Returns metadata without encrypted data.

    SECURITY: Requires Firebase authentication AND VAULT_OWNER token.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")

        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")

        # Verify user is getting their own vault status
        verify_user_id_match(firebase_uid, user_id)

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
