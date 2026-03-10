"""RIA onboarding, request, and workspace routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from api.middleware import require_firebase_auth
from hushh_mcp.services.ria_iam_service import (
    IAMSchemaNotReadyError,
    RIAIAMPolicyError,
    RIAIAMService,
)

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


class RIAInviteTarget(BaseModel):
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    investor_user_id: str | None = None
    source: str | None = None
    delivery_channel: str | None = None


class RIAInviteCreateRequest(BaseModel):
    scope_template_id: str = Field(..., min_length=1)
    duration_mode: str = Field(default="preset")
    duration_hours: int | None = None
    firm_id: str | None = None
    reason: str | None = None
    targets: list[RIAInviteTarget] = Field(default_factory=list)


class RIAMarketplaceDiscoverabilityRequest(BaseModel):
    enabled: bool
    headline: str | None = None
    strategy_summary: str | None = None


def _iam_schema_not_ready_response(message: str | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": message or "IAM schema is not ready",
            "code": "IAM_SCHEMA_NOT_READY",
            "hint": "Run `python db/migrate.py --iam` and `python scripts/verify_iam_schema.py`.",
        },
    )


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
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/onboarding/status")
async def onboarding_status(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    try:
        return await service.get_ria_onboarding_status(firebase_uid)
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))


@router.get("/firms")
async def ria_firms(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    try:
        return {"items": await service.list_ria_firms(firebase_uid)}
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))


@router.get("/clients")
async def ria_clients(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    try:
        return {"items": await service.list_ria_clients(firebase_uid)}
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))


@router.get("/requests")
async def ria_requests(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    try:
        return {"items": await service.list_ria_requests(firebase_uid)}
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))


@router.get("/invites")
async def ria_invites(firebase_uid: str = Depends(require_firebase_auth)):
    service = RIAIAMService()
    try:
        return {"items": await service.list_ria_invites(firebase_uid)}
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))


@router.post("/invites")
async def create_ria_invites(
    payload: RIAInviteCreateRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.create_ria_invites(
            firebase_uid,
            scope_template_id=payload.scope_template_id,
            duration_mode=payload.duration_mode,
            duration_hours=payload.duration_hours,
            firm_id=payload.firm_id,
            reason=payload.reason,
            targets=[target.model_dump() for target in payload.targets],
        )
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/marketplace/discoverability")
async def update_ria_marketplace_discoverability(
    payload: RIAMarketplaceDiscoverabilityRequest,
    firebase_uid: str = Depends(require_firebase_auth),
):
    service = RIAIAMService()
    try:
        return await service.set_ria_marketplace_discoverability(
            firebase_uid,
            enabled=payload.enabled,
            headline=payload.headline,
            strategy_summary=payload.strategy_summary,
        )
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


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
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))
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
    except IAMSchemaNotReadyError as exc:
        return _iam_schema_not_ready_response(str(exc))
    except RIAIAMPolicyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
