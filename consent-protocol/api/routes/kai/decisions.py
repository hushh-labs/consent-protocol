# api/routes/kai/decisions.py
"""
Kai Decision Storage Endpoints

Handles encrypted decision storage and retrieval.
"""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.kai_decisions_service import KaiDecisionsService

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# HELPERS
# ============================================================================

async def validate_vault_owner(authorization: str, expected_user_id: str) -> None:
    """
    Validate VAULT_OWNER token and ensure user_id matches.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Missing consent token. Call /api/consent/owner-token first."
        )
    
    token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(token, ConsentScope.VAULT_OWNER)
    
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    if payload.user_id != expected_user_id:
        raise HTTPException(
            status_code=403, 
            detail="Token user does not match requested user"
        )
    
    logger.info(f"[Kai] VAULT_OWNER validated for {expected_user_id}")


# ============================================================================
# MODELS
# ============================================================================

class StoreDecisionRequest(BaseModel):
    """Request to store an already-encrypted decision."""
    user_id: str
    ticker: str
    decision_type: str  # 'buy', 'hold', 'reduce' (Plaintext metadata)
    confidence_score: float
    
    # Encrypted Payload
    decision_ciphertext: str
    iv: str
    tag: Optional[str] = ""


class DecisionHistoryResponse(BaseModel):
    decisions: List[Dict]
    total: int


class EncryptedDecisionResponse(BaseModel):
    """Encrypted decision returned to Client for local decryption."""
    id: int
    decision_ciphertext: str
    iv: str
    tag: str
    created_at: str
    user_id: str
    ticker: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/decision/store")
async def store_decision(
    request: StoreDecisionRequest,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Step 2: Store Encrypted Decision.
    
    REQUIRES: VAULT_OWNER consent token.
    """
    await validate_vault_owner(authorization, request.user_id)
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=request.user_id,
        operation="kai.decision.store",
        target=request.ticker,
        metadata={"decision_type": request.decision_type, "confidence": request.confidence_score}
    )
    
    # Use KaiDecisionsService for encrypted decision storage
    token = authorization.replace("Bearer ", "")
    decisions_service = KaiDecisionsService()
    
    try:
        await decisions_service.store_decision(
            user_id=request.user_id,
            consent_token=token,
            ticker=request.ticker,
            decision_type=request.decision_type,
            payload_ciphertext=request.decision_ciphertext,
            payload_iv=request.iv,
            payload_tag=request.tag or "",
            metadata={"confidence_score": request.confidence_score}
        )
        
        logger.info(f"[Kai] Decision stored encrypted for {request.ticker}")
        return {"success": True, "ticker": request.ticker}
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"[Kai] Failed to store decision: {e}")
        raise HTTPException(status_code=500, detail="Failed to store decision")


@router.get("/decisions/{user_id}", response_model=DecisionHistoryResponse)
async def get_decision_history(
    user_id: str,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Get decision history (metadata only).
    
    REQUIRES: VAULT_OWNER consent token.
    """
    await validate_vault_owner(authorization, user_id)
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.decisions.read",
        metadata={"limit": limit, "offset": offset}
    )
    
    # Use KaiDecisionsService for reading decisions
    token = authorization.replace("Bearer ", "")
    decisions_service = KaiDecisionsService()
    
    try:
        decisions = await decisions_service.get_decisions(
            user_id=user_id,
            consent_token=token,
            limit=limit,
        )
        
        # Format response
        formatted = []
        for d in decisions:
            formatted.append({
                "id": d["id"],
                "ticker": d["ticker"],
                "decision": d["decision_type"],
                "confidence": float(d.get("confidence_score", 0)),
                "created_at": d.get("created_at", "")
            })
        
        return DecisionHistoryResponse(decisions=formatted, total=len(decisions))
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/decision/{decision_id}", response_model=EncryptedDecisionResponse)
async def get_decision_detail(
    decision_id: int,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Get FULL Encrypted Decision Blob.
    
    REQUIRES: VAULT_OWNER consent token.
    Client must download this and decrypt locally using Vault Key.
    """
    # Validate token first
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing consent token")
    token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(token, ConsentScope.VAULT_OWNER)
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    # Use KaiDecisionsService to get decision by ID
    decisions_service = KaiDecisionsService()
    
    try:
        decision = await decisions_service.get_decision_by_id(
            decision_id=decision_id,
            consent_token=token,
            user_id=payload.user_id
        )
        
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        
        # Log operation for audit trail
        consent_service = ConsentDBService()
        await consent_service.log_operation(
            user_id=payload.user_id,
            operation="kai.decision.read",
            target=decision.get("ticker"),
            metadata={"decision_id": decision_id}
        )
        
        return EncryptedDecisionResponse(
            id=decision["id"],
            decision_ciphertext=decision["payload"]["ciphertext"],
            iv=decision["payload"]["iv"],
            tag=decision["payload"].get("tag", ""),
            created_at=decision.get("createdAt", ""),
            user_id=payload.user_id,
            ticker=decision["ticker"]
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.delete("/decision/{decision_id}")
async def delete_decision(
    decision_id: int, 
    user_id: str = Query(...),
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    Delete a decision.
    
    REQUIRES: VAULT_OWNER consent token.
    """
    await validate_vault_owner(authorization, user_id)
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.decision.delete",
        metadata={"decision_id": decision_id}
    )
    
    # Use KaiDecisionsService for deletion
    token = authorization.replace("Bearer ", "")
    decisions_service = KaiDecisionsService()
    
    try:
        success = await decisions_service.delete_decision(
            decision_id=decision_id,
            consent_token=token,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Decision not found or not authorized")
        
        return {"success": True, "deleted_id": decision_id}
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
