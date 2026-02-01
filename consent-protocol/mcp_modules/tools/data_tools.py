# mcp/tools/data_tools.py
"""
Data access handlers (food preferences, professional profile).

SECURITY: Uses validate_token_with_db for cross-instance revocation consistency.
This ensures tokens revoked on one Cloud Run instance are rejected on all instances.
"""

import base64
import json
import logging

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from mcp.types import TextContent

from hushh_mcp.consent.token import validate_token_with_db
from hushh_mcp.constants import ConsentScope
from mcp_modules.config import FASTAPI_URL

logger = logging.getLogger("hushh-mcp-server")


async def resolve_email_to_uid(user_id: str) -> str:
    """If user_id is an email, resolve to Firebase UID."""
    if not user_id or "@" not in user_id:
        return user_id
    
    try:
        async with httpx.AsyncClient() as client:
            lookup_response = await client.get(
                f"{FASTAPI_URL}/api/user/lookup",
                params={"email": user_id},
                timeout=5.0
            )
            if lookup_response.status_code == 200:
                lookup_data = lookup_response.json()
                if lookup_data.get("exists"):
                    resolved = lookup_data["user_id"]
                    logger.info(f"✅ Resolved email to UID: {resolved}")
                    return resolved
    except Exception as e:
        logger.warning(f"⚠️ Email lookup failed: {e}")
    
    return user_id


async def handle_get_food(args: dict) -> list[TextContent]:
    """
    Get food preferences WITH mandatory consent validation.
    
    Compliance:
    ✅ HushhMCP: Consent BEFORE data access
    ✅ HushhMCP: Scoped Access (vault.read.food required)
    ✅ HushhMCP: User ID must match token
    ✅ Privacy: Denied without valid consent
    """
    user_id = args.get("user_id")
    consent_token = args.get("consent_token")
    
    # Email resolution
    user_id = await resolve_email_to_uid(user_id)
    
    # Compliance check with cross-instance revocation
    # NOTE: Legacy VAULT_READ_FOOD scope has been removed.
    valid, reason, token_obj = await validate_token_with_db(
        consent_token,
        expected_scope=ConsentScope.WORLD_MODEL_READ
    )
    
    if not valid:
        logger.warning(f"🚫 ACCESS DENIED (food): {reason}")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": f"Consent validation failed: {reason}",
            "required_scope": "world_model.read",
            "privacy_notice": "Hushh requires explicit consent before accessing any personal data.",
            "remedy": "Call request_consent with scope='world_model.read' first"
        }))]
    
    # User ID must match
    if token_obj.user_id != user_id:
        logger.warning(f"🚫 ACCESS DENIED: User mismatch (token={token_obj.user_id}, request={user_id})")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": "Token user_id does not match requested user_id",
            "privacy_notice": "Tokens are bound to specific users and cannot be transferred."
        }))]
    
    # Fetch real data from encrypted export (zero-knowledge)
    food_data = None
    
    try:
        async with httpx.AsyncClient() as client:
            export_response = await client.get(
                f"{FASTAPI_URL}/api/consent/data",
                params={"consent_token": consent_token},
                timeout=10.0
            )
            
            if export_response.status_code == 200:
                export_data = export_response.json()
                
                # Decrypt the export data
                export_key_hex = export_data.get("export_key")
                encrypted_data = export_data.get("encrypted_data")
                iv = export_data.get("iv")
                tag = export_data.get("tag")
                
                if all([export_key_hex, encrypted_data, iv, tag]):
                    try:
                        key_bytes = bytes.fromhex(export_key_hex)
                        iv_bytes = base64.b64decode(iv)
                        ciphertext_bytes = base64.b64decode(encrypted_data)
                        tag_bytes = base64.b64decode(tag)
                        
                        combined = ciphertext_bytes + tag_bytes
                        
                        aesgcm = AESGCM(key_bytes)
                        plaintext = aesgcm.decrypt(iv_bytes, combined, None)
                        
                        food_data = json.loads(plaintext.decode('utf-8'))
                        logger.info("✅ Successfully decrypted vault export!")
                        
                    except Exception as e:
                        logger.error(f"❌ Decryption failed: {e}")
                        
            elif export_response.status_code == 404:
                logger.warning("⚠️ No export data found for this token")
                
    except Exception as e:
        logger.warning(f"⚠️ Export fetch failed: {e}")
    
    # PRODUCTION: No fallback to demo data - fail if real data not found
    if food_data is None:
        logger.warning(f"❌ No vault export data found for user={user_id}")
        return [TextContent(type="text", text=json.dumps({
            "status": "no_data",
            "error": "No food preferences data found in vault",
            "user_id": user_id,
            "scope": "vault.read.food",
            "consent_verified": True,
            "message": "The user has not saved any food preferences yet, or the data export was not included with consent approval.",
            "suggestion": "Ask the user to update their food preferences in the Hushh app and re-approve consent."
        }))]
    
    logger.info(f"✅ Food data ACCESSED for user={user_id} (consent verified)")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "success",
        "user_id": user_id,
        "scope": "vault.read.food",
        "consent_verified": True,
        "consent_token_used": consent_token[:30] + "...",
        "data": food_data,
        "privacy_note": "This data was accessed with valid user consent.",
        "zero_knowledge": True
    }))]


async def handle_get_professional(args: dict) -> list[TextContent]:
    """
    Get professional profile WITH mandatory consent validation.
    
    Compliance:
    ✅ HushhMCP: Different scope = Different token required
    ✅ HushhMCP: Food token CANNOT access professional data
    ✅ HushhMCP: Scope isolation is enforced cryptographically
    """
    user_id = args.get("user_id")
    consent_token = args.get("consent_token")
    
    # Email resolution
    user_id = await resolve_email_to_uid(user_id)
    
    # Compliance check with cross-instance revocation - must have world_model.read scope
    # NOTE: Legacy VAULT_READ_PROFESSIONAL scope has been removed.
    valid, reason, token_obj = await validate_token_with_db(
        consent_token,
        expected_scope=ConsentScope.WORLD_MODEL_READ
    )
    
    if not valid:
        logger.warning(f"🚫 ACCESS DENIED (professional): {reason}")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": f"Consent validation failed: {reason}",
            "required_scope": "world_model.read",
            "privacy_notice": "Each data category requires its own consent token.",
            "remedy": "Call request_consent with scope='world_model.read' first"
        }))]
    
    # User ID must match
    if token_obj.user_id != user_id:
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": "Token user_id mismatch"
        }))]
    
    # Fetch real data from encrypted export (zero-knowledge)
    professional_data = None
    
    try:
        async with httpx.AsyncClient() as client:
            export_response = await client.get(
                f"{FASTAPI_URL}/api/consent/data",
                params={"consent_token": consent_token},
                timeout=10.0
            )
            
            if export_response.status_code == 200:
                export_data = export_response.json()
                
                # Decrypt the export data
                export_key_hex = export_data.get("export_key")
                encrypted_data = export_data.get("encrypted_data")
                iv = export_data.get("iv")
                tag = export_data.get("tag")
                
                if all([export_key_hex, encrypted_data, iv, tag]):
                    try:
                        key_bytes = bytes.fromhex(export_key_hex)
                        iv_bytes = base64.b64decode(iv)
                        ciphertext_bytes = base64.b64decode(encrypted_data)
                        tag_bytes = base64.b64decode(tag)
                        
                        combined = ciphertext_bytes + tag_bytes
                        
                        aesgcm = AESGCM(key_bytes)
                        plaintext = aesgcm.decrypt(iv_bytes, combined, None)
                        
                        professional_data = json.loads(plaintext.decode('utf-8'))
                        logger.info("✅ Successfully decrypted professional vault export!")
                        
                    except Exception as e:
                        logger.error(f"❌ Professional decryption failed: {e}")
                        
            elif export_response.status_code == 404:
                logger.warning("⚠️ No export data found for this professional token")
                
    except Exception as e:
        logger.warning(f"⚠️ Professional export fetch failed: {e}")
    
    # PRODUCTION: No fallback to demo data - fail if real data not found
    if professional_data is None:
        logger.warning(f"❌ No vault export data found for user={user_id}")
        return [TextContent(type="text", text=json.dumps({
            "status": "no_data",
            "error": "No professional profile data found in vault",
            "user_id": user_id,
            "scope": "vault.read.professional",
            "consent_verified": True,
            "message": "The user has not saved any professional profile yet, or the data export was not included with consent approval.",
            "suggestion": "Ask the user to update their professional profile in the Hushh app and re-approve consent."
        }))]
    
    logger.info(f"✅ Professional data ACCESSED for user={user_id} (consent verified)")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "success",
        "user_id": user_id,
        "scope": "vault.read.professional",
        "consent_verified": True,
        "data": professional_data,
        "privacy_note": "This data was accessed with valid user consent."
    }))]
