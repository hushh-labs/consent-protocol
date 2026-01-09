# api/routes/professional.py
"""
Professional Agent - Modular Backend with VAULT_OWNER Token Validation

CONSENT-FIRST ARCHITECTURE:
- All endpoints require VAULT_OWNER consent token
- No authentication bypasses
- Uniform validation across all agents
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Request

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
import consent_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/professional", tags=["Professional Agent"])


async def get_pool():
    """Get database connection pool."""
    return await consent_db.get_pool()


def validate_vault_owner_token(consent_token: str, user_id: str) -> None:
    """
    Validate VAULT_OWNER consent token.
    
    Checks:
    1. Token is valid (signature, expiry)
    2. Token has VAULT_OWNER scope
    3. Token userId matches requested userId
    
    Raises HTTPException if validation fails.
    """
    if not consent_token:
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Vault owner must provide VAULT_OWNER token."
        )
    
    # Validate token
    valid, reason, token_obj = validate_token(consent_token)
    
    if not valid:
        logger.warning(f"Invalid consent token: {reason}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid consent token: {reason}"
        )
    
    # Check scope is VAULT_OWNER
    if token_obj.scope != ConsentScope.VAULT_OWNER.value:
        logger.warning(
            f"Insufficient scope: {token_obj.scope} (requires {ConsentScope.VAULT_OWNER.value})"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient scope: {token_obj.scope}. VAULT_OWNER scope required."
        )
    
    # Check userId matches
    if token_obj.user_id != user_id:
        logger.warning(
            f"Token userId mismatch: {token_obj.user_id} != {user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Token userId does not match requested userId"
        )
    
    logger.info(f"✅ VAULT_OWNER token validated for {user_id}")


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
        
        # Validate VAULT_OWNER token
        validate_vault_owner_token(consent_token, user_id)
        
        # Fetch encrypted preferences from database
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT domain, preferences 
                FROM vault_encrypted 
                WHERE user_id = $1 AND domain = 'professional'
                """,
                user_id
            )
        
        if not row:
            logger.info(f"No professional data found for {user_id}")
            return {
                "domain": "professional",
                "preferences": None
            }
        
        logger.info(f"✅ Professional data retrieved for {user_id}")
        
        return {
            "domain": row["domain"],
            "preferences": row["preferences"]  # JSONB with encrypted fields
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
        
        # Validate VAULT_OWNER token
        validate_vault_owner_token(consent_token, user_id)
        
        # Store encrypted preference in database
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Upsert: update if exists, insert if not
            await conn.execute(
                """
                INSERT INTO vault_encrypted (user_id, domain, preferences)
                VALUES ($1, 'professional', jsonb_build_object($2, jsonb_build_object(
                    'ciphertext', $3,
                    'iv', $4,
                    'tag', $5,
                    'encoding', 'base64',
                    'algorithm', 'aes-256-gcm'
                )))
                ON CONFLICT (user_id, domain)
                DO UPDATE SET preferences = vault_encrypted.preferences || jsonb_build_object($2, jsonb_build_object(
                    'ciphertext', $3,
                    'iv', $4,
                    'tag', $5,
                    'encoding', 'base64',
                    'algorithm', 'aes-256-gcm'
                ))
                """,
                user_id, field_name, ciphertext, iv, tag
            )
        
        logger.info(f"✅ Professional field '{field_name}' stored for {user_id}")
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error storing professional data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
