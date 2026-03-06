"""IAM routes for dual persona management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.middleware import require_firebase_auth
from hushh_mcp.services.ria_iam_service import RIAIAMPolicyError, RIAIAMService

router = APIRouter(prefix="/api/iam", tags=["IAM"])


class PersonaSwitchRequest(BaseModel):
    persona: str = Field(..., description="Target persona: investor | ria")


class MarketplaceOptInRequest(BaseModel):
    enabled: bool


@router.get("/persona")
async def get_persona(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    return await service.get_persona_state(firebase_uid)


@router.post("/persona/switch")
async def switch_persona(
    payload: PersonaSwitchRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.switch_persona(firebase_uid, payload.persona)
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/marketplace/opt-in")
async def update_marketplace_opt_in(
    payload: MarketplaceOptInRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    return await service.set_marketplace_opt_in(firebase_uid, payload.enabled)
