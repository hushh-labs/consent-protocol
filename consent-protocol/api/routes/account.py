# consent-protocol/api/routes/account.py
"""
Account API Routes
==================

Endpoints for account lifecycle management.

Routes:
    DELETE /api/account/delete - Delete account and all data
    
Security:
    ALL routes require VAULT_OWNER token.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from api.middleware import require_vault_owner_token
from hushh_mcp.services.account_service import AccountService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/account", tags=["Account"])

@router.delete("/delete")
async def delete_account(
    token_data: dict = Depends(require_vault_owner_token)
):
    """
    Delete logged-in user's account and ALL data.
    
    Requires VAULT_OWNER token (Unlock to Delete).
    This action is irreversible.
    """
    user_id = token_data["user_id"]
    logger.warning(f"⚠️ DELETE ACCOUNT REQUESTED for user {user_id}")
    
    service = AccountService()
    result = await service.delete_account(user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Deletion failed: {result.get('error')}")
        
    return result
