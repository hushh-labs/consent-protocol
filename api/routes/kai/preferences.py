# api/routes/kai/preferences.py
"""
Kai Preferences Endpoints

Handles user preferences for Kai (risk profile, processing mode).
Now backed by WorldModelService (world_model_data + world_model_index_v2)
instead of the deprecated vault_kai_preferences table.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.middleware import require_vault_owner_token
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()


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


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/preferences/store")
async def store_preferences(
    request: StorePreferencesRequest,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Store user preferences via WorldModelService.

    Stores an encrypted blob under domain='kai_preferences' and updates
    the domain_summaries metadata in world_model_index_v2.

    REQUIRES: VAULT_OWNER consent token.
    """
    if token_data.get("user_id") != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id",
        )

    # Log operation for audit trail
    consent_service = ConsentDBService()
    field_names = [p.field_name for p in request.preferences]
    await consent_service.log_operation(
        user_id=request.user_id,
        operation="kai.preferences.write",
        metadata={"fields": field_names},
    )

    world_model = get_world_model_service()

    # Build the encrypted blob from the list of preferences
    # We combine them into a single blob keyed by field_name
    encrypted_blob = {
        "fields": {
            p.field_name: {
                "ciphertext": p.ciphertext,
                "iv": p.iv,
                "tag": p.tag or "",
            }
            for p in request.preferences
        },
        "algorithm": "aes-256-gcm",
    }

    # Non-sensitive summary for world_model_index_v2
    summary = {
        "field_names": field_names,
        "field_count": len(field_names),
    }

    try:
        success = await world_model.store_domain_data(
            user_id=request.user_id,
            domain="kai_preferences",
            encrypted_blob=encrypted_blob,
            summary=summary,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store preferences",
            )

        logger.info(
            f"[Kai] Stored {len(request.preferences)} preferences for {request.user_id}"
        )
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Kai] Failed to store preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store settings",
        )


@router.get("/preferences/{user_id}")
async def get_preferences(
    user_id: str,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Retrieve preferences for a user from WorldModelService.

    Returns the encrypted blob stored under domain='kai_preferences'.
    The client must decrypt it using the vault key (BYOK).
    REQUIRES: VAULT_OWNER consent token.
    """
    if token_data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id",
        )

    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.preferences.read",
    )

    world_model = get_world_model_service()

    try:
        data = await world_model.get_domain_data(user_id, "kai_preferences")
    except Exception as e:
        logger.error(f"[Kai] Failed to read preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read preferences",
        )

    if not data:
        # No preferences stored yet — return empty response
        return {"encrypted_blob": None, "has_preferences": False}

    # Return the encrypted envelope; client decrypts with vault key
    return {
        "encrypted_blob": {
            "ciphertext": data.get("ciphertext", ""),
            "iv": data.get("iv", ""),
            "tag": data.get("tag", ""),
            "algorithm": data.get("algorithm", "aes-256-gcm"),
        },
        "has_preferences": True,
    }


@router.delete("/preferences/{user_id}")
async def delete_preferences(
    user_id: str,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Delete all Kai preferences for a user.

    Removes the 'kai_preferences' domain from the world model.
    REQUIRES: VAULT_OWNER consent token.
    """
    if token_data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id",
        )

    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.preferences.delete",
    )

    world_model = get_world_model_service()
    success = await world_model.delete_domain_data(user_id, "kai_preferences")

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete preferences",
        )

    return {"success": True, "deleted_domain": "kai_preferences"}
