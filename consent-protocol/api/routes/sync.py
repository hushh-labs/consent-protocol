# consent-protocol/api/routes/sync.py
"""
Sync API Routes
===============

Endpoints for data synchronization between client and server.
Supports HushhSyncPlugin.

Routes:
    POST /api/sync/vault - Trigger vault sync (placeholder)
    POST /api/sync/batch - Push batch of changes
    GET  /api/sync/pull  - Pull changes since timestamp
    
Security:
    ALL routes require VAULT_OWNER token.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Header, HTTPException, Depends, Query, Body
from pydantic import BaseModel

from api.middleware import require_vault_owner_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["Sync"])

# ==================== Models ====================

class SyncItem(BaseModel):
    id: int
    tableName: str
    operation: str
    userId: str
    data: str
    createdAt: int

class SyncBatchRequest(BaseModel):
    items: List[SyncItem]

# ==================== Routes ====================

@router.post("/vault")
async def sync_vault(
    user_id: str = Body(..., embed=True, alias="userId"),
    token_data: dict = Depends(require_vault_owner_token)
):
    """
    Trigger vault sync.
    Current implementation is a placeholder that returns success to satisfy the plugin.
    Real sync happens via specific domain services (WorldModel, etc).
    """
    # Verify user_id matches token
    if user_id != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
        
    return {"success": True, "message": "Vault sync received"}

@router.post("/batch")
async def sync_batch(
    request: SyncBatchRequest,
    token_data: dict = Depends(require_vault_owner_token)
):
    """
    Receive batch of changes from client.
    """
    # Ensure all items belong to the authenticated user
    for item in request.items:
        if item.userId != token_data["user_id"]:
             raise HTTPException(status_code=403, detail=f"User ID mismatch in sync item {item.id}")
    
    # TODO: Implement actual data merging logic here
    # For now, we acknowledge receipt so client clears pending queue
    
    synced_ids = [item.id for item in request.items]
    
    logger.info(f"🔄 Sync batch received: {len(synced_ids)} items for {token_data['user_id']}")
    
    return {
        "success": True, 
        "syncedIds": synced_ids
    }

@router.get("/pull")
async def pull_changes(
    userId: str = Query(...),
    since: int = Query(0),
    token_data: dict = Depends(require_vault_owner_token)
):
    """
    Get changes since timestamp.
    """
    if userId != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
        
    # TODO: Implement pull logic
    
    return {
        "changes": [],
        "timestamp": 0
    }
