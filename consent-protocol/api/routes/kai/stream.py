# api/routes/kai/stream.py
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
from hushh_mcp.operons.kai.llm import stream_gemini_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Kai Streaming"])


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


async def stream_agent_thinking(
    agent_name: str,
    ticker: str,
    prompt_context: str,
) -> AsyncGenerator[dict, None]:
    """
    Stream Gemini 3 thinking tokens for an agent analysis.
    Yields agent_token events that the frontend can display in real-time.
    """
    logger.info(f"[Kai Stream] Starting stream_agent_thinking for {agent_name}")
    token_count = 0
    try:
        async for event in stream_gemini_response(
            prompt=f"""You are a {agent_name} analyst. Briefly think through your analysis approach for {ticker}.
            
Context: {prompt_context}

Think step by step in 2-3 sentences about what you'll analyze and why it matters.""",
            agent_name=agent_name.lower(),
        ):
            if event.get("type") == "token":
                token_count += 1
                logger.info(f"[Kai Stream] Token #{token_count} for {agent_name}: {event.get('text', '')[:30]}...")
                yield create_event("agent_token", {
                    "agent": agent_name.lower(),
                    "text": event.get("text", ""),
                    "type": "token"
                })
            elif event.get("type") == "error":
                logger.error(f"[Kai Stream] Gemini error for {agent_name}: {event.get('message')}")
            elif event.get("type") == "complete":
                logger.info(f"[Kai Stream] Streaming complete for {agent_name}, total tokens: {token_count}")
    except Exception as e:
        logger.error(f"[Kai Stream] Streaming error for {agent_name}: {e}", exc_info=True)
        # Non-fatal - analysis will continue without streaming


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
    - kai_thinking: Streaming tokens showing Kai's reasoning
    - agent_start: Agent begins analysis
    - agent_complete: Agent finished with insight
    - round_start: Debate round begins
    - debate_round: Each round of debate with agent statements
    - decision: Final decision card
    - error: Any errors
    """
    
    # Initialize agents
    fundamental_agent = FundamentalAgent(processing_mode="hybrid")
    sentiment_agent = SentimentAgent(processing_mode="hybrid")
    valuation_agent = ValuationAgent(processing_mode="hybrid")
    
    # Normalize risk_profile to lowercase for DebateEngine config
    normalized_risk_profile = risk_profile.lower() if risk_profile else "balanced"
    debate_engine = DebateEngine(risk_profile=normalized_risk_profile)
    
    logger.info(f"[Kai Stream] Starting analysis for {ticker} - user {user_id}")
    
    try:
        # =====================================================================
        # PHASE 1: Parallel Agent Analysis
        # =====================================================================
        
        # Kai thinking - orchestration reasoning
        yield create_event("kai_thinking", {
            "phase": "analysis",
            "message": f"🧠 Initializing analysis pipeline for {ticker}...",
            "tokens": ["Activating", "three", "specialist", "agents:", "Fundamental,", "Sentiment,", "and", "Valuation."]
        })
        await asyncio.sleep(0.05)
        
        yield create_event("kai_thinking", {
            "phase": "analysis",
            "message": f"📊 Each agent will perform deep analysis using specialized tools and data sources...",
            "tokens": ["Fundamental:", "SEC", "filings,", "financial", "ratios.", "Sentiment:", "news,", "catalysts.", "Valuation:", "P/E,", "DCF", "models."]
        })
        await asyncio.sleep(0.05)
        
        # Signal start of fundamental analysis
        yield create_event("agent_start", {
            "agent": "fundamental",
            "agent_name": "Fundamental Agent",
            "color": "#3b82f6",
            "message": f"Analyzing SEC filings for {ticker}..."
        })
        
        # Stream Gemini thinking tokens for fundamental analysis
        async for token_event in stream_agent_thinking(
            agent_name="Fundamental",
            ticker=ticker,
            prompt_context="Analyze SEC filings, revenue trends, cash flow, and business moat."
        ):
            yield token_event
        
        # Run actual fundamental analysis (this gets the structured data)
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
                "key_metrics": fundamental_insight.key_metrics,
                "quant_metrics": fundamental_insight.quant_metrics,
                "business_moat": fundamental_insight.business_moat,
                "financial_resilience": fundamental_insight.financial_resilience,
                "growth_efficiency": fundamental_insight.growth_efficiency,
                "bull_case": fundamental_insight.bull_case,
                "bear_case": fundamental_insight.bear_case,
                "sources": fundamental_insight.sources
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
        
        # Stream Gemini thinking tokens for sentiment analysis
        async for token_event in stream_agent_thinking(
            agent_name="Sentiment",
            ticker=ticker,
            prompt_context="Analyze news sentiment, market catalysts, and momentum signals."
        ):
            yield token_event
        
        # Run actual sentiment analysis
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
                "sentiment_score": sentiment_insight.sentiment_score,
                "key_catalysts": sentiment_insight.key_catalysts,
                "sources": sentiment_insight.sources
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
        
        # Stream Gemini thinking tokens for valuation analysis
        async for token_event in stream_agent_thinking(
            agent_name="Valuation",
            ticker=ticker,
            prompt_context="Analyze P/E multiples, DCF valuation, and peer comparisons."
        ):
            yield token_event
        
        # Run actual valuation analysis
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
                "valuation_metrics": valuation_insight.valuation_metrics,
                "peer_comparison": valuation_insight.peer_comparison,
                "price_targets": valuation_insight.price_targets,
                "sources": valuation_insight.sources
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
        
        # Kai thinking - starting debate
        yield create_event("kai_thinking", {
            "phase": "debate",
            "message": "⚖️ Now orchestrating multi-agent debate to reach consensus...",
            "tokens": ["Each", "agent", "will", "present", "their", "position", "in", "two", "rounds.", "Dissent", "will", "be", "captured."]
        })
        await asyncio.sleep(0.3)
        
        yield create_event("debate_start", {
            "message": "Starting multi-agent debate...",
            "agents": ["fundamental", "sentiment", "valuation"],
            "total_rounds": 2
        })
        
        # Run debate (async method)
        debate_result = await debate_engine.orchestrate_debate(
            fundamental_insight=fundamental_insight,
            sentiment_insight=sentiment_insight,
            valuation_insight=valuation_insight
        )
        
        # Stream each debate round with round_start events
        for i, round_data in enumerate(debate_result.rounds):
            round_num = round_data.round_number
            
            # Signal round start
            round_context = "presenting initial findings" if round_num == 1 else "challenging and refining positions"
            yield create_event("round_start", {
                "round": round_num,
                "description": f"Round {round_num}: Agents are {round_context}",
                "is_final_round": round_num == len(debate_result.rounds)
            })
            await asyncio.sleep(0.2)
            
            # Kai thinking for this round
            yield create_event("kai_thinking", {
                "phase": f"round{round_num}",
                "message": f"🔄 Processing Round {round_num} statements...",
                "tokens": ["Evaluating", "fundamental", "argument...", "Evaluating", "sentiment", "argument...", "Evaluating", "valuation", "argument..."]
            })
            await asyncio.sleep(0.2)
            
            # Stream the debate round with enhanced data
            yield create_event("debate_round", {
                "round": round_num,
                "statements": round_data.agent_statements,
                "context": round_context,
                "is_final_round": round_num == len(debate_result.rounds)
            })
            await asyncio.sleep(0.4)  # Delay for UI effect
        
        if await request.is_disconnected():
            return
        
        # =====================================================================
        # PHASE 3: Final Decision
        # =====================================================================
        
        # Kai thinking - final reasoning
        yield create_event("kai_thinking", {
            "phase": "decision",
            "message": "🎯 Synthesizing final recommendation from debate outcomes...",
            "tokens": ["Weighting", "agent", "votes", "by", risk_profile, "risk", "profile.", "Calculating", "confidence", "score."]
        })
        await asyncio.sleep(0.3)
        
        if debate_result.consensus_reached:
            yield create_event("kai_thinking", {
                "phase": "decision",
                "message": "✅ Consensus reached. All agents agree on the recommendation.",
                "tokens": ["Unanimous", "agreement:", debate_result.decision.upper()]
            })
        else:
            yield create_event("kai_thinking", {
                "phase": "decision",
                "message": f"⚠️ Majority decision with {len(debate_result.dissenting_opinions)} dissenting opinion(s).",
                "tokens": ["Majority", "recommends:", debate_result.decision.upper(), "with", "dissent", "noted."]
            })
        await asyncio.sleep(0.2)
        
        # Build raw_card structure matching DecisionCard from decision_generator.py
        raw_card = {
            "fundamental_insight": {
                "summary": fundamental_insight.summary,
                "business_moat": fundamental_insight.business_moat,
                "financial_resilience": fundamental_insight.financial_resilience,
                "growth_efficiency": fundamental_insight.growth_efficiency,
                "bull_case": fundamental_insight.bull_case,
                "bear_case": fundamental_insight.bear_case,
            },
            "quant_metrics": fundamental_insight.quant_metrics,
            "key_metrics": {
                "fundamental": fundamental_insight.key_metrics,
                "sentiment": {
                    "sentiment_score": sentiment_insight.sentiment_score,
                    "catalyst_count": len(sentiment_insight.key_catalysts) if sentiment_insight.key_catalysts else 0,
                },
                "valuation": valuation_insight.valuation_metrics,
            },
            "all_sources": list(set(
                fundamental_insight.sources + 
                sentiment_insight.sources + 
                valuation_insight.sources
            )),
            "risk_persona_alignment": f"This {debate_result.decision.upper()} recommendation aligns with your {risk_profile} risk profile.",
            "debate_digest": debate_result.final_statement,
            "consensus_reached": debate_result.consensus_reached,
            "dissenting_opinions": debate_result.dissenting_opinions,
        }
        
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
            "valuation_summary": valuation_insight.summary,
            "raw_card": raw_card
        })
        
        logger.info(f"[Kai Stream] Analysis complete for {ticker}: {debate_result.decision}")
        
    except Exception as e:
        logger.exception(f"[Kai Stream] Error during analysis: {e}")
        yield create_event("error", {
            "message": str(e),
            "ticker": ticker
        })


# ============================================================================
# SSE ENDPOINTS
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
