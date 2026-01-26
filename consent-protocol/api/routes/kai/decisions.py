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

from db.connection import get_pool
from db.consent import log_operation
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
    await log_operation(
        user_id=request.user_id,
        operation="kai.decision.store",
        target=request.ticker,
        metadata={"decision_type": request.decision_type, "confidence": request.confidence_score}
    )
    
    pool = await get_pool()
    
    try:
        await pool.execute(
            """
            INSERT INTO vault_kai (
                user_id, ticker, decision_type,
                decision_ciphertext, iv, tag, 
                confidence_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
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
    await log_operation(
        user_id=user_id,
        operation="kai.decisions.read",
        metadata={"limit": limit, "offset": offset}
    )
    
    pool = await get_pool()
    
    # Get total count
    count_row = await pool.fetchrow(
        "SELECT COUNT(*) as total FROM vault_kai WHERE user_id = $1",
        user_id
    )
    total = count_row["total"]
    
    rows = await pool.fetch(
        """
        SELECT id, ticker, decision_type, confidence_score, created_at
        FROM vault_kai
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        user_id, limit, offset
    )
    
    decisions = []
    for row in rows:
        decisions.append({
            "id": row["id"],
            "ticker": row["ticker"],
            "decision": row["decision_type"],
            "confidence": float(row["confidence_score"]) if row["confidence_score"] else 0.0,
            "created_at": row["created_at"].isoformat(),
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
    pool = await get_pool()
    
    row = await pool.fetchrow(
        "SELECT * FROM vault_kai WHERE id = $1",
        decision_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    # Validate that token owner matches decision owner
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing consent token")
    token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(token, ConsentScope.VAULT_OWNER)
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    if payload.user_id != row["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this decision")
    
    # Log operation for audit trail
    await log_operation(
        user_id=payload.user_id,
        operation="kai.decision.read",
        target=row["ticker"],
        metadata={"decision_id": decision_id}
    )
    
    return EncryptedDecisionResponse(
        id=row["id"],
        decision_ciphertext=row["decision_ciphertext"],
        iv=row["iv"],
        tag=row["tag"] or "",
        created_at=row["created_at"].isoformat(),
        user_id=row["user_id"],
        ticker=row["ticker"]
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
    await log_operation(
        user_id=user_id,
        operation="kai.decision.delete",
        metadata={"decision_id": decision_id}
    )
    
    pool = await get_pool()
    
    result = await pool.execute(
        "DELETE FROM vault_kai WHERE id = $1 AND user_id = $2",
        decision_id, user_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Decision not found or not authorized")
    
    return {"success": True, "deleted_id": decision_id}
