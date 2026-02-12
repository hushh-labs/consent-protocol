"""
Onboarding API Routes
=====================

Endpoints for managing user onboarding tour completion status.

Routes:
    GET  /api/onboarding/status?userId={uid}  - Check if user completed onboarding
    POST /api/onboarding/complete             - Mark onboarding as complete
"""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from hushh_mcp.services.vault_keys_service import VaultKeysService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class CompleteOnboardingRequest(BaseModel):
    """Request to mark onboarding as complete."""
    userId: str


@router.get("/status")
async def get_onboarding_status(userId: str = Query(..., description="User ID")):
    """
    Check if user has completed onboarding tour.
    
    Args:
        userId: The user ID to check
        
    Returns:
        { "completed": boolean }
    """
    try:
        service = VaultKeysService()
        completed = await service.get_onboarding_status(userId)
        
        return {"completed": completed}
        
    except Exception as e:
        logger.error(f"Failed to get onboarding status for {userId}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete")
async def complete_onboarding(request: CompleteOnboardingRequest):
    """
    Mark user's onboarding as complete.
    
    Args:
        request: Contains userId
        
    Returns:
        { "success": boolean }
    """
    try:
        service = VaultKeysService()
        success = await service.complete_onboarding(request.userId)
        
        logger.info(f"✅ Onboarding completed for user {request.userId[:8]}...")
        
        return {"success": success}
        
    except Exception as e:
        logger.error(f"Failed to complete onboarding for {request.userId}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
