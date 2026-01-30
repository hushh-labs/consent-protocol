# api/routes/kai/consent.py
"""
Kai Consent Endpoints

Handles Kai-specific consent grants for analysis operations.
"""

import logging
import uuid
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.services.consent_db import ConsentDBService

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
    service = ConsentDBService()
    
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
            
            # Log to consent_audit using service layer
            await service.insert_event(
                user_id=request.user_id,
                agent_id="agent_kai",
                scope=scope_str,
                action="CONSENT_GRANTED",  # Use standard action name
                token_id=token.token[:32],  # Store truncated token ID
                expires_at=token.expires_at,
                issued_at=token.issued_at
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
