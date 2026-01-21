# api/routes/kai_stream.py
"""
Kai SSE Streaming — Real-time Debate Analysis

Streams agent analysis and debate rounds to the frontend via Server-Sent Events.
Enables real-time visualization of the multi-agent debate process.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, Header
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.agents.kai.fundamental_agent import FundamentalAgent
from hushh_mcp.agents.kai.sentiment_agent import SentimentAgent
from hushh_mcp.agents.kai.valuation_agent import ValuationAgent
from hushh_mcp.agents.kai.debate_engine import DebateEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kai", tags=["Kai Streaming"])


# ============================================================================
# MODELS
# ============================================================================

class StreamAnalyzeRequest(BaseModel):
    """Request for streaming analysis."""
    user_id: str
    ticker: str
    risk_profile: str = "balanced"
    context: Optional[Dict[str, Any]] = None


# ============================================================================
# SSE EVENT HELPERS
# ============================================================================

def create_event(event_type: str, data: dict) -> dict:
    """Create SSE event with consistent format."""
    return {
        "event": event_type,
        "data": json.dumps({
            **data,
            "timestamp": int(datetime.now().timestamp() * 1000)
        })
    }


# ============================================================================
# STREAMING GENERATOR
# ============================================================================

async def analyze_stream_generator(
    ticker: str,
    user_id: str,
    consent_token: str,
    risk_profile: str,
    context: Optional[Dict[str, Any]],
    request: Request
) -> AsyncGenerator[dict, None]:
    """
    Generator for streaming Kai analysis via SSE.
    
    Yields events:
    - agent_start: Agent begins analysis
    - agent_complete: Agent finished with insight
    - debate_round: Each round of debate
    - decision: Final decision card
    - error: Any errors
    """
    
    # Initialize agents
    fundamental_agent = FundamentalAgent(processing_mode="hybrid")
    sentiment_agent = SentimentAgent(processing_mode="hybrid")
    valuation_agent = ValuationAgent(processing_mode="hybrid")
    debate_engine = DebateEngine(risk_profile=risk_profile)
    
    logger.info(f"[Kai Stream] Starting analysis for {ticker} - user {user_id}")
    
    try:
        # =====================================================================
        # PHASE 1: Parallel Agent Analysis
        # =====================================================================
        
        # Signal start of fundamental analysis
        yield create_event("agent_start", {
            "agent": "fundamental",
            "agent_name": "Fundamental Agent",
            "color": "#3b82f6",
            "message": f"Analyzing SEC filings for {ticker}..."
        })
        
        # Run fundamental analysis
        try:
            fundamental_insight = await fundamental_agent.analyze(
                ticker=ticker,
                user_id=user_id,
                consent_token=consent_token,
                context=context
            )
            yield create_event("agent_complete", {
                "agent": "fundamental",
                "summary": fundamental_insight.summary,
                "recommendation": fundamental_insight.recommendation,
                "confidence": fundamental_insight.confidence,
                "key_metrics": fundamental_insight.key_metrics
            })
        except Exception as e:
            logger.error(f"[Kai Stream] Fundamental agent error: {e}")
            yield create_event("agent_error", {
                "agent": "fundamental",
                "error": str(e)
            })
            # Use mock data to continue
            fundamental_insight = await fundamental_agent._mock_analysis(ticker) if hasattr(fundamental_agent, '_mock_analysis') else None
            if not fundamental_insight:
                raise
        
        # Check if client disconnected
        if await request.is_disconnected():
            return
        
        # Signal start of sentiment analysis
        yield create_event("agent_start", {
            "agent": "sentiment",
            "agent_name": "Sentiment Agent",
            "color": "#8b5cf6",
            "message": f"Analyzing market sentiment for {ticker}..."
        })
        
        # Run sentiment analysis
        try:
            sentiment_insight = await sentiment_agent.analyze(
                ticker=ticker,
                user_id=user_id,
                consent_token=consent_token
            )
            yield create_event("agent_complete", {
                "agent": "sentiment",
                "summary": sentiment_insight.summary,
                "recommendation": sentiment_insight.recommendation,
                "confidence": sentiment_insight.confidence,
                "sentiment_score": sentiment_insight.sentiment_score
            })
        except Exception as e:
            logger.error(f"[Kai Stream] Sentiment agent error: {e}")
            yield create_event("agent_error", {
                "agent": "sentiment",
                "error": str(e)
            })
            sentiment_insight = await sentiment_agent._mock_analysis(ticker)
        
        if await request.is_disconnected():
            return
        
        # Signal start of valuation analysis
        yield create_event("agent_start", {
            "agent": "valuation",
            "agent_name": "Valuation Agent",
            "color": "#10b981",
            "message": f"Calculating valuation metrics for {ticker}..."
        })
        
        # Run valuation analysis
        try:
            valuation_insight = await valuation_agent.analyze(
                ticker=ticker,
                user_id=user_id,
                consent_token=consent_token
            )
            yield create_event("agent_complete", {
                "agent": "valuation",
                "summary": valuation_insight.summary,
                "recommendation": valuation_insight.recommendation,
                "confidence": valuation_insight.confidence,
                "valuation_metrics": valuation_insight.valuation_metrics
            })
        except Exception as e:
            logger.error(f"[Kai Stream] Valuation agent error: {e}")
            yield create_event("agent_error", {
                "agent": "valuation",
                "error": str(e)
            })
            valuation_insight = await valuation_agent._mock_analysis(ticker)
        
        if await request.is_disconnected():
            return
        
        # =====================================================================
        # PHASE 2: Debate
        # =====================================================================
        
        yield create_event("debate_start", {
            "message": "Starting multi-agent debate...",
            "agents": ["fundamental", "sentiment", "valuation"]
        })
        
        # Run debate
        debate_result = debate_engine.orchestrate_debate(
            fundamental_insight=fundamental_insight,
            sentiment_insight=sentiment_insight,
            valuation_insight=valuation_insight
        )
        
        # Stream each debate round
        for round_data in debate_result.rounds:
            yield create_event("debate_round", {
                "round": round_data.round_number,
                "statements": round_data.agent_statements
            })
            await asyncio.sleep(0.3)  # Small delay for UI effect
        
        if await request.is_disconnected():
            return
        
        # =====================================================================
        # PHASE 3: Final Decision
        # =====================================================================
        
        yield create_event("decision", {
            "ticker": ticker,
            "decision": debate_result.decision,
            "confidence": debate_result.confidence,
            "consensus_reached": debate_result.consensus_reached,
            "agent_votes": debate_result.agent_votes,
            "dissenting_opinions": debate_result.dissenting_opinions,
            "final_statement": debate_result.final_statement,
            "fundamental_summary": fundamental_insight.summary,
            "sentiment_summary": sentiment_insight.summary,
            "valuation_summary": valuation_insight.summary
        })
        
        logger.info(f"[Kai Stream] Analysis complete for {ticker}: {debate_result.decision}")
        
    except Exception as e:
        logger.exception(f"[Kai Stream] Error during analysis: {e}")
        yield create_event("error", {
            "message": str(e),
            "ticker": ticker
        })


# ============================================================================
# SSE ENDPOINT
# ============================================================================

@router.get("/analyze/stream")
async def analyze_stream(
    request: Request,
    ticker: str,
    user_id: str,
    risk_profile: str = "balanced",
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    SSE endpoint for streaming Kai analysis.
    
    Streams real-time updates as each agent completes analysis
    and during the multi-agent debate process.
    
    Events:
    - agent_start: Agent begins analysis
    - agent_complete: Agent finished with insight summary
    - agent_error: Agent encountered an error
    - debate_start: Debate phase begins
    - debate_round: Each round of agent debate
    - decision: Final decision card
    - error: Fatal error
    
    Example client usage:
    ```javascript
    const evtSource = new EventSource(
        '/api/kai/analyze/stream?ticker=AAPL&user_id=xxx',
        { headers: { 'Authorization': 'Bearer HCT:...' } }
    );
    
    evtSource.addEventListener('agent_complete', (e) => {
        const data = JSON.parse(e.data);
        console.log(`${data.agent} says: ${data.recommendation}`);
    });
    
    evtSource.addEventListener('decision', (e) => {
        const data = JSON.parse(e.data);
        console.log(`Final decision: ${data.decision}`);
        evtSource.close();
    });
    ```
    """
    
    # Validate consent token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Call /api/consent/owner-token first."
        )
    
    consent_token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)
    
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    if payload.user_id != user_id:
        raise HTTPException(status_code=403, detail="Token user mismatch")
    
    logger.info(f"[Kai Stream] SSE connection opened for {ticker} - user {user_id}")
    
    return EventSourceResponse(
        analyze_stream_generator(
            ticker=ticker,
            user_id=user_id,
            consent_token=consent_token,
            risk_profile=risk_profile,
            context=None,
            request=request
        ),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/analyze/stream")
async def analyze_stream_post(
    request: Request,
    body: StreamAnalyzeRequest,
    authorization: str = Header(..., description="Bearer VAULT_OWNER consent token")
):
    """
    POST version of streaming analysis (allows context in body).
    """
    
    # Validate consent token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Call /api/consent/owner-token first."
        )
    
    consent_token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)
    
    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    if payload.user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Token user mismatch")
    
    return EventSourceResponse(
        analyze_stream_generator(
            ticker=body.ticker,
            user_id=body.user_id,
            consent_token=consent_token,
            risk_profile=body.risk_profile,
            context=body.context,
            request=request
        ),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
