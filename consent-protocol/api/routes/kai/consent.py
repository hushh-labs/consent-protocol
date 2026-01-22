# api/routes/kai/consent.py
"""
Kai Consent Endpoints

Handles Kai-specific consent grants for analysis operations.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import uuid
import logging

from db.connection import get_pool
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class GrantConsentRequest(BaseModel):
    user_id: str
    scopes: List[str] = [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze",
    ]


class GrantConsentResponse(BaseModel):
    consent_id: str
    tokens: Dict[str, str]
    expires_at: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/consent/grant", response_model=GrantConsentResponse)
async def grant_consent(request: GrantConsentRequest):
    """
    Grant consent for Kai data access.
    
    Stateless: Issues tokens for the requested user_id and scopes.
    Does not rely on a pre-existing session.
    """
    pool = await get_pool()
    
    tokens = {}
    consent_id = f"kai_consent_{uuid.uuid4().hex[:16]}"
    last_token_issued = None
    
    for scope_str in request.scopes:
        try:
            scope = ConsentScope(scope_str)
            token = issue_token(
                user_id=request.user_id,
                agent_id="agent_kai",
                scope=scope
            )
            tokens[scope_str] = token.token
            last_token_issued = token
            
            # Log to consent_audit
            await pool.execute(
                """
                INSERT INTO consent_audit (
                    token_id, user_id, agent_id, scope, action, issued_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                token.token[:32],
                request.user_id,
                "agent_kai",
                scope_str,
                "granted",
                token.issued_at,
                token.expires_at,
            )
            
        except Exception as e:
            logger.error(f"Failed to issue token for scope {scope_str}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scope: {scope_str}"
            )
    
    if not tokens:
        raise HTTPException(status_code=400, detail="No valid scopes provided")
    
    logger.info(f"[Kai] Consent granted for user: {request.user_id}")
    
    return GrantConsentResponse(
        consent_id=consent_id,
        tokens=tokens,
        expires_at=str(last_token_issued.expires_at) if last_token_issued else ""
    )
