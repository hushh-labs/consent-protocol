from fastapi import APIRouter, HTTPException, Body, Header
from pydantic import BaseModel
from typing import Dict, Any

from hushh_mcp.agents.fundamental import FundamentalAgent, AnalysisReport, MarketMetrics
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

router = APIRouter(prefix="/api/analysis", tags=["Fundamental Analysis"])

# Initialize Agent (Singleton ideally, or per request)
agent = FundamentalAgent()

class AnalysisRequestPayload(BaseModel):
    ticker: str
    context: Dict[str, Any] # Decrypted user profile data

@router.post("/analyze", response_model=AnalysisReport)
async def analyze_stock(
    payload: AnalysisRequestPayload,
    authorization: str = Header(..., description="Bearer Consent Token")
):
    """
    Perform deep fundamental analysis on a stock personalized to the user's context.
    
    The 'context' must be the DECRYPTED user_investor_profile.
    This preserves privacy: the server processes the data in memory and discards it.
    
    REQUIRES: Consent Token with 'agent.kai.analyze' or 'vault.owner' scope.
    """
    # 1. Enforcement / Vault Guard
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header configuration")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Validate token signature and expiration
        is_valid, error_msg, payload_token = validate_token(token)
        
        if not is_valid or not payload_token:
            raise Exception(error_msg or "Invalid token")
        
        # Scope Check
        allowed_scopes = [ConsentScope.AGENT_KAI_ANALYZE.value, ConsentScope.VAULT_OWNER.value]
        if payload_token.scope not in allowed_scopes:
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient consent. Required one of: {allowed_scopes}"
            )
            
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Consent validation failed: {str(e)}")

    # 2. Agent Execution
    try:
        report = await agent.analyze(payload.ticker, payload.context)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
