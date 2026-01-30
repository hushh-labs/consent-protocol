# api/routes/professional.py
"""
Professional Agent - Modular Backend with VAULT_OWNER Token Validation

CONSENT-FIRST ARCHITECTURE:
- All endpoints require VAULT_OWNER consent token
- No authentication bypasses
- Uniform validation across all agents
- Revocation checked against both in-memory and DB
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from hushh_mcp.services.vault_db import ConsentValidationError, VaultDBService
from hushh_mcp.types import EncryptedPayload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/professional", tags=["Professional Agent"])


@router.post("/preferences")
async def get_professional_data(request: Request):
    """
    Get professional profile data for vault owner.
    
    Requires VAULT_OWNER consent token.
    Returns encrypted professional data from vault.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")
        
        # Use service layer (validates consent internally)
        service = VaultDBService()
        try:
            encrypted_fields = await service.get_encrypted_fields(
                user_id=user_id,
                domain="professional",
                consent_token=consent_token,
                field_names=None  # Get all fields
            )
        except ConsentValidationError as e:
            raise HTTPException(
                status_code=401 if e.reason in ["missing_token", "invalid_token"] else 403,
                detail=str(e)
            )
        
        # Convert EncryptedPayload objects to dict format
        preferences = {}
        for field_name, payload in encrypted_fields.items():
            preferences[field_name] = {
                "ciphertext": payload.ciphertext,
                "iv": payload.iv,
                "tag": payload.tag,
                "algorithm": payload.algorithm,
                "encoding": payload.encoding
            }
        
        if not preferences:
            logger.info(f"No professional data found for {user_id}")
            return {
                "domain": "professional",
                "preferences": None
            }
        
        logger.info(f"✅ Professional data retrieved for {user_id}")
        
        return {
            "domain": "professional",
            "preferences": preferences
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching professional data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preferences/store")
async def store_professional_data(request: Request):
    """
    Store professional profile data for vault owner.
    
    Requires VAULT_OWNER consent token with write permissions.
    Stores encrypted professional data to vault.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")
        field_name = body.get("fieldName")
        ciphertext = body.get("ciphertext")
        iv = body.get("iv")
        tag = body.get("tag")
        
        if not all([user_id, field_name, ciphertext, iv, tag]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: userId, fieldName, ciphertext, iv, tag"
            )
        
        # Use service layer (validates consent internally)
        service = VaultDBService()
        try:
            payload = EncryptedPayload(
                ciphertext=ciphertext,
                iv=iv,
                tag=tag,
                algorithm="aes-256-gcm",
                encoding="base64"
            )
            
            await service.store_encrypted_field(
                user_id=user_id,
                domain="professional",
                field_name=field_name,
                payload=payload,
                consent_token=consent_token
            )
        except ConsentValidationError as e:
            raise HTTPException(
                status_code=401 if e.reason in ["missing_token", "invalid_token"] else 403,
                detail=str(e)
            )
        
        logger.info(f"✅ Professional field '{field_name}' stored for {user_id}")
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error storing professional data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
