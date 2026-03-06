"""RIA onboarding, request, and workspace routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.middleware import require_firebase_auth
from hushh_mcp.services.ria_iam_service import RIAIAMPolicyError, RIAIAMService

router = APIRouter(prefix="/api/ria", tags=["RIA"])


class RIAOnboardingSubmitRequest(BaseModel):
    display_name: str = Field(..., min_length=1)
    legal_name: str | None = None
    finra_crd: str | None = None
    sec_iard: str | None = None
    bio: str | None = None
    strategy: str | None = None
    disclosures_url: str | None = None
    primary_firm_name: str | None = None
    primary_firm_role: str | None = None


class RIAConsentRequestCreate(BaseModel):
    subject_user_id: str = Field(..., min_length=1)
    requester_actor_type: str = Field(default="ria")
    subject_actor_type: str = Field(default="investor")
    scope_template_id: str = Field(..., min_length=1)
    selected_scope: str | None = None
    duration_mode: str = Field(default="preset")
    duration_hours: int | None = None
    firm_id: str | None = None
    reason: str | None = None


@router.post("/onboarding/submit")
async def submit_onboarding(
    payload: RIAOnboardingSubmitRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.submit_ria_onboarding(
            firebase_uid,
            display_name=payload.display_name,
            legal_name=payload.legal_name,
            finra_crd=payload.finra_crd,
            sec_iard=payload.sec_iard,
            bio=payload.bio,
            strategy=payload.strategy,
            disclosures_url=payload.disclosures_url,
            primary_firm_name=payload.primary_firm_name,
            primary_firm_role=payload.primary_firm_role,
        )
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/onboarding/status")
async def onboarding_status(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    return await service.get_ria_onboarding_status(firebase_uid)


@router.get("/firms")
async def ria_firms(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    return {"items": await service.list_ria_firms(firebase_uid)}


@router.get("/clients")
async def ria_clients(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    return {"items": await service.list_ria_clients(firebase_uid)}


@router.get("/requests")
async def ria_requests(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    return {"items": await service.list_ria_requests(firebase_uid)}


@router.post("/requests")
async def create_ria_request(
    payload: RIAConsentRequestCreate,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.create_ria_consent_request(
            firebase_uid,
            subject_user_id=payload.subject_user_id,
            requester_actor_type=payload.requester_actor_type,
            subject_actor_type=payload.subject_actor_type,
            scope_template_id=payload.scope_template_id,
            selected_scope=payload.selected_scope,
            duration_mode=payload.duration_mode,
            duration_hours=payload.duration_hours,
            firm_id=payload.firm_id,
            reason=payload.reason,
        )
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/workspace/{investor_user_id}")
async def ria_workspace(
    investor_user_id: str,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.get_ria_workspace(firebase_uid, investor_user_id)
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
