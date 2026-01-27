# api/routes/kai/decisions.py
"""
Kai Decision Storage Endpoints

Handles encrypted decision storage and retrieval.
"""

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import logging

from hushh_mcp.services.vault_db import VaultDBService, ConsentValidationError
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.types import EncryptedPayload
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

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
    
    # vault_kai has a different structure - it has plaintext metadata (ticker, decision_type, confidence_score)
    # and encrypted decision_ciphertext. We need a special handler.
    # Use service layer to access Supabase (service validates consent via token validation above)
    service = VaultDBService()
    supabase = service.get_supabase()
    
    try:
        data = {
            "user_id": request.user_id,
            "ticker": request.ticker,
            "decision_type": request.decision_type,
            "decision_ciphertext": request.decision_ciphertext,
            "iv": request.iv,
            "tag": request.tag or "",
            "confidence_score": request.confidence_score,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("vault_kai").insert(data).execute()
            request.user_id,
            request.ticker,
            request.decision_type,
            request.decision_ciphertext,
            request.iv,
            request.tag,
            request.confidence_score,
            datetime.utcnow(),
        )
        
        logger.info(f"[Kai] Decision stored encrypted for {request.ticker}")
        return {"success": True, "ticker": request.ticker}
        
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
    
    # Use service layer to access Supabase
    service = VaultDBService()
    supabase = service.get_supabase()
    
    # Get total count
    count_response = supabase.table("vault_kai")\
        .select("id", count="exact")\
        .eq("user_id", user_id)\
        .limit(0)\
        .execute()
    
    total = 0
    if hasattr(count_response, 'count') and count_response.count is not None:
        total = count_response.count
    
    # Get paginated results
    response = supabase.table("vault_kai")\
        .select("id,ticker,decision_type,confidence_score,created_at")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .range(offset, offset + limit - 1)\
        .execute()
    
    rows = response.data or []
    
    decisions = []
    for row in rows:
        # Handle created_at - might be string or datetime
        created_at = row.get("created_at")
        if isinstance(created_at, str):
            created_at_str = created_at
        else:
            created_at_str = created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
        
        decisions.append({
            "id": row.get("id"),
            "ticker": row.get("ticker"),
            "decision": row.get("decision_type"),
            "confidence": float(row.get("confidence_score", 0)) if row.get("confidence_score") else 0.0,
            "created_at": created_at_str,
        })
    
    return DecisionHistoryResponse(decisions=decisions, total=total)


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
    
    # Use service layer to access Supabase
    service = VaultDBService()
    supabase = service.get_supabase()
    
    response = supabase.table("vault_kai")\
        .select("*")\
        .eq("id", decision_id)\
        .limit(1)\
        .execute()
    
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    row = response.data[0]
    
    # Validate that token owner matches decision owner
    if payload.user_id != row.get("user_id"):
        raise HTTPException(status_code=403, detail="Not authorized to access this decision")
    
    # Log operation for audit trail
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=payload.user_id,
        operation="kai.decision.read",
        target=row.get("ticker"),
        metadata={"decision_id": decision_id}
    )
    
    # Handle created_at format
    created_at = row.get("created_at")
    if isinstance(created_at, str):
        created_at_str = created_at
    else:
        created_at_str = created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
    
    return EncryptedDecisionResponse(
        id=row.get("id"),
        decision_ciphertext=row.get("decision_ciphertext"),
        iv=row.get("iv"),
        tag=row.get("tag") or "",
        created_at=created_at_str,
        user_id=row.get("user_id"),
        ticker=row.get("ticker")
    )


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
    
    # Use service layer to access Supabase
    service = VaultDBService()
    supabase = service.get_supabase()
    
    response = supabase.table("vault_kai")\
        .delete()\
        .eq("id", decision_id)\
        .eq("user_id", user_id)\
        .execute()
    
    # Check if anything was deleted
    deleted_count = len(response.data) if response.data else 0
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Decision not found or not authorized")
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Decision not found or not authorized")
    
    return {"success": True, "deleted_id": decision_id}
