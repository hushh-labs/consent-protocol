# api/routes/kai/decisions.py
"""
Kai Decision Endpoints — reads from world_model_index_v2.domain_summaries.

The legacy vault_kai table has been dropped.  All decision history is now
stored in domain_summaries["kai_decisions"] inside world_model_index_v2.

Write operations (store/delete) are handled client-side via the generic
POST /api/world-model/store-domain endpoint with domain="kai_decisions".
"""

import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.middleware import require_vault_owner_token
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class DecisionHistoryResponse(BaseModel):
    decisions: List[Dict]
    total: int


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/decisions/{user_id}", response_model=DecisionHistoryResponse)
async def get_decision_history(
    user_id: str,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Get decision history from domain_summaries.

    Reads from world_model_index_v2.domain_summaries.kai_decisions.
    REQUIRES: VAULT_OWNER consent token.
    """
    if token_data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id",
        )

    world_model = get_world_model_service()
    index = await world_model.get_index_v2(user_id)

    decisions: list[dict] = []
    if index and "kai_decisions" in (index.domain_summaries or {}):
        raw = index.domain_summaries["kai_decisions"]
        # domain_summaries.kai_decisions is expected to be a list or
        # a dict with a "decisions" key
        if isinstance(raw, list):
            decisions = raw
        elif isinstance(raw, dict):
            decisions = raw.get("decisions", [])

    # Pagination
    total = len(decisions)
    decisions = decisions[offset : offset + limit]

    return DecisionHistoryResponse(decisions=decisions, total=total)


@router.post("/decision/store", status_code=status.HTTP_410_GONE)
async def store_decision_gone():
    """
    GONE — use POST /api/world-model/store-domain with domain='kai_decisions'.
    """
    raise HTTPException(
        status_code=410,
        detail="Gone. Use POST /api/world-model/store-domain with domain='kai_decisions'.",
    )


@router.get("/decision/{decision_id}", status_code=status.HTTP_410_GONE)
async def get_decision_detail_gone(decision_id: int):
    """
    GONE — individual decision lookup is no longer supported.
    Use GET /api/kai/decisions/{user_id} to list all decisions.
    """
    raise HTTPException(
        status_code=410,
        detail="Gone. Use GET /api/kai/decisions/{user_id} instead.",
    )


@router.delete("/decision/{decision_id}", status_code=status.HTTP_410_GONE)
async def delete_decision_gone(decision_id: int):
    """
    GONE — use POST /api/world-model/store-domain to overwrite decisions.
    """
    raise HTTPException(
        status_code=410,
        detail="Gone. Use POST /api/world-model/store-domain with domain='kai_decisions'.",
    )
