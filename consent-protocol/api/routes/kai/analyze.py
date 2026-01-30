# api/routes/kai/analyze.py
"""
Kai Analysis Endpoint (Non-Streaming)

Performs 3-agent investment analysis and returns complete DecisionCard.
"""

import logging
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class AnalyzeRequest(BaseModel):
    user_id: str
    ticker: str
    consent_token: Optional[str] = None
    # Client provides context explicitly (Stateless)
    risk_profile: Literal["conservative", "balanced", "aggressive"] = "balanced"
    processing_mode: Literal["on_device", "hybrid"] = "hybrid"
    context: Optional[Dict[str, Any]] = None  # Decrypted user profile context


class AnalyzeResponse(BaseModel):
    """
    Plaintext decision returned to Client.
    Client MUST encrypt this before storing.
    """
    decision_id: str
    ticker: str
    decision: Literal["buy", "hold", "reduce"]
    confidence: float
    headline: str
    processing_mode: str
    created_at: str
    # Full data for client to encrypt
    raw_card: Dict


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ticker(
    request: AnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Step 1: Perform 3-agent investment analysis.
    
    Return PLAINTEXT result.
    Client provides `risk_profile` directly (Stateless).
    """
    from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
    
    try:
        # Initialize orchestrator with Client-provided context
        orchestrator = KaiOrchestrator(
            user_id=request.user_id,
            risk_profile=request.risk_profile,
            processing_mode=request.processing_mode,
        )
        
        # Validate Consent (Explicit or Implicit)
        token_to_use = request.consent_token
        
        if not token_to_use:
            # Try Implicit Consent (Same-User Session)
            if not authorization or not authorization.startswith("Bearer "):
                 raise HTTPException(status_code=401, detail="Missing consent token or valid session")
            
            try:
                import firebase_admin
                from firebase_admin import auth, credentials
                try:
                    firebase_admin.get_app()
                except ValueError:
                    firebase_admin.initialize_app(credentials.ApplicationDefault())
                
                id_token = authorization.split("Bearer ")[1]
                decoded = auth.verify_id_token(id_token)
                
                if decoded["uid"] != request.user_id:
                    raise HTTPException(status_code=403, detail="Session user mismatch")
                
                logger.info(f"[Kai] Implicit consent granted for owner: {request.user_id}")
                
                # ISSUE REAL EPHEMERAL TOKEN (30s)
                scope = ConsentScope("vault.owner")
                token_obj = issue_token(
                    user_id=request.user_id,
                    agent_id="self",
                    scope=scope,
                    expires_in_ms=30000 
                )
                token_to_use = token_obj.token
                
            except Exception as e:
                logger.warning(f"[Kai] Implicit auth failed: {e}")
                raise HTTPException(status_code=401, detail="Invalid session credentials")

        # Run analysis (Generates Plaintext)
        decision_card = await orchestrator.analyze(
            ticker=request.ticker,
            consent_token=token_to_use,
            context=request.context
        )
        
        # Convert to dictionary for response
        raw_card = orchestrator.decision_generator.to_json(decision_card)
        import json
        raw_dict = json.loads(raw_card)
        
        logger.info(f"[Kai] Generated analysis for {request.ticker} ({request.risk_profile})")
        
        return AnalyzeResponse(
            decision_id=decision_card.decision_id,
            ticker=decision_card.ticker,
            decision=decision_card.decision,
            confidence=decision_card.confidence,
            headline=decision_card.headline,
            processing_mode=decision_card.processing_mode,
            created_at=decision_card.timestamp.isoformat(),
            raw_card=raw_dict  # Plaintext
        )
        
    except ValueError as e:
        logger.error(f"[Kai] Analysis failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("[Kai] Unexpected error during analysis")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
