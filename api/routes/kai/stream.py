# api/routes/kai/stream.py
"""
Kai SSE Streaming — Real-time Debate Analysis

Streams agent analysis and debate rounds to the frontend via Server-Sent Events.
Enables real-time visualization of the multi-agent debate process.
"""

import asyncio
import contextvars
import json
import logging
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from api.routes.kai._streaming import (
    STOCK_ANALYZE_TIMEOUT_SECONDS,
    CanonicalSSEStream,
)
from hushh_mcp.agents.kai.debate_engine import DebateEngine
from hushh_mcp.agents.kai.fundamental_agent import FundamentalAgent
from hushh_mcp.agents.kai.sentiment_agent import SentimentAgent
from hushh_mcp.agents.kai.valuation_agent import ValuationAgent
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.operons.kai.fetchers import RealtimeDataUnavailable
from hushh_mcp.operons.kai.llm import (
    get_gemini_unavailable_reason,
    is_gemini_ready,
    stream_gemini_response,
    synthesize_debate_recommendation_card,
)
from hushh_mcp.services.consent_db import ConsentDBService
from hushh_mcp.services.renaissance_service import get_renaissance_service
from hushh_mcp.services.world_model_service import get_world_model_service

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
# SSE EVENT HELPERS (sse_starlette format)
# ============================================================================

_stream_ctx: contextvars.ContextVar[CanonicalSSEStream | None] = contextvars.ContextVar(
    "kai_stream_ctx",
    default=None,
)


def create_event(event_type: str, data: dict, *, terminal: bool = False) -> dict[str, str]:
    """Create one canonical SSE event frame."""
    ctx = _stream_ctx.get()
    if ctx is None:
        ctx = CanonicalSSEStream("stock_analyze")
        _stream_ctx.set(ctx)
    return ctx.event(event_type, data, terminal=terminal)


def _safe_round(value: Any, fallback: int) -> int:
    if isinstance(value, int) and value in (1, 2):
        return value
    if isinstance(value, str) and value.isdigit() and int(value) in (1, 2):
        return int(value)
    return fallback


def _normalize_analyze_event_payload(
    event_name: str,
    payload: dict[str, Any],
    *,
    default_round: int,
    default_phase: str,
) -> dict[str, Any]:
    """Attach explicit round/phase metadata so frontend never infers state."""
    normalized = dict(payload)
    if event_name in {"agent_start", "agent_token", "agent_complete", "agent_error"}:
        round_value = _safe_round(normalized.get("round"), default_round)
        phase_value = normalized.get("phase")
        if not isinstance(phase_value, str) or not phase_value:
            phase_value = "debate" if round_value == 2 else "analysis"
        normalized["round"] = round_value
        normalized["phase"] = phase_value
    elif event_name in {"debate_round", "round_start"}:
        fallback_round = default_round if event_name == "round_start" else 2
        round_value = _safe_round(normalized.get("round"), fallback_round)
        normalized["round"] = round_value
        normalized.setdefault("phase", "debate" if round_value == 2 else "analysis")
    elif event_name == "kai_thinking":
        normalized.setdefault("phase", default_phase)
        normalized.setdefault("round", default_round)
    elif event_name == "insight_extracted":
        normalized.setdefault("phase", default_phase)
        normalized.setdefault("round", default_round)
    return normalized


def _is_retryable_rate_limit_error(error: Exception | str) -> bool:
    message = str(error).lower()
    markers = (
        "429",
        "too many requests",
        "rate limit",
        "resource_exhausted",
        "quota",
    )
    return any(marker in message for marker in markers)


async def stream_agent_thinking(
    agent_name: str,
    ticker: str,
    prompt_context: str,
    request: Request,
    *,
    round_number: int,
    phase: str,
) -> AsyncGenerator[dict, None]:
    """
    Stream Gemini 3 thinking tokens for an agent analysis.
    Yields agent_token events that the frontend can display in real-time.
    """
    logger.info(f"[Kai Stream] Starting stream_agent_thinking for {agent_name}")
    token_count = 0
    stream_error_message: Optional[str] = None
    try:
        async for event in stream_gemini_response(
            prompt=f"""You are a {agent_name} analyst. Briefly think through your analysis approach for {ticker}.
            
Context: {prompt_context}

Think step by step in 2-3 sentences about what you'll analyze and why it matters.""",
            agent_name=agent_name.lower(),
        ):
            if event.get("type") == "token":
                token_count += 1
                logger.info(
                    f"[Kai Stream] Token #{token_count} for {agent_name}: {event.get('text', '')[:30]}..."
                )
                yield create_event(
                    "agent_token",
                    {
                        "agent": agent_name.lower(),
                        "text": event.get("text", ""),
                        "type": "token",
                        "round": round_number,
                        "phase": phase,
                    },
                )
            elif event.get("type") == "error":
                stream_error_message = str(event.get("message") or "unknown stream error")
                logger.error(f"[Kai Stream] Gemini error for {agent_name}: {stream_error_message}")
            elif event.get("type") == "complete":
                logger.info(
                    f"[Kai Stream] Streaming complete for {agent_name}, total tokens: {token_count}"
                )

            # Check if client disconnected after each token
            if await request.is_disconnected():
                logger.info(
                    f"[Kai Stream] Client disconnected during {agent_name} streaming, stopping..."
                )
                return

        if token_count == 0 and stream_error_message:
            fallback_text = (
                f"Live stream unavailable ({stream_error_message}). "
                "Proceeding with deterministic analysis so results still complete."
            )
            fallback_words = fallback_text.split()
            for idx, word in enumerate(fallback_words):
                token_text = f"{word} " if idx < len(fallback_words) - 1 else word
                yield create_event(
                    "agent_token",
                    {
                        "agent": agent_name.lower(),
                        "text": token_text,
                        "type": "token",
                        "round": round_number,
                        "phase": phase,
                    },
                )
                if await request.is_disconnected():
                    return
                await asyncio.sleep(0.01)
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
    request: Request,
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

    # Create disconnection event to signal DebateEngine when client disconnects
    disconnection_event = asyncio.Event()

    async def check_disconnected() -> bool:
        """Check if client disconnected and log for debugging."""
        is_disconnected = await request.is_disconnected()
        if is_disconnected:
            logger.info("[Kai Stream] Client disconnected, stopping processing...")
            disconnection_event.set()  # Signal DebateEngine to stop
        return is_disconnected

    logger.info(f"[Kai Stream] Starting analysis for {ticker} - user {user_id}")

    stream_token = _stream_ctx.set(CanonicalSSEStream("stock_analyze"))
    loop = asyncio.get_running_loop()
    stream_started_at = loop.time()

    def remaining_timeout() -> float:
        elapsed = loop.time() - stream_started_at
        remaining = STOCK_ANALYZE_TIMEOUT_SECONDS - elapsed
        if remaining <= 0:
            raise asyncio.TimeoutError(
                f"Analyze stream timed out after {STOCK_ANALYZE_TIMEOUT_SECONDS}s"
            )
        return remaining

    try:
        yield create_event(
            "start",
            {
                "phase": "analysis",
                "round": 1,
                "progress_pct": 1,
                "message": f"Starting Kai analysis stream for {ticker}.",
            },
        )
        yield create_event(
            "kai_thinking",
            {
                "phase": "analysis",
                "round": 1,
                "message": "Preparing world model context and Renaissance universe signals...",
                "tokens": ["Connecting", "to", "context", "layers", "and", "screening", "data."],
            },
        )
        if not is_gemini_ready():
            yield create_event(
                "warning",
                {
                    "phase": "analysis",
                    "round": 1,
                    "code": "LLM_STREAM_UNAVAILABLE",
                    "retryable": False,
                    "message": get_gemini_unavailable_reason()
                    or "Gemini streaming unavailable. Continuing with deterministic fallback.",
                },
            )

        # =========================================================================
        # 1. FETCH FULL CONTEXT (The Omniscient Backend)
        # =========================================================================

        # A + B. Pull Renaissance + world model context in parallel.
        renaissance_service = get_renaissance_service()
        world_model = get_world_model_service()
        context_results = await asyncio.wait_for(
            asyncio.gather(
                renaissance_service.get_analysis_context(ticker),
                world_model.get_index_v2(user_id),
                return_exceptions=True,
            ),
            timeout=remaining_timeout(),
        )
        renaissance_result, wm_result = context_results

        if isinstance(renaissance_result, Exception):
            logger.warning(
                "[Kai Stream] Renaissance context lookup failed for %s: %s",
                ticker,
                renaissance_result,
            )
            renaissance_context: Dict[str, Any] = {
                "is_investable": False,
                "tier": None,
                "tier_description": "Unavailable",
                "conviction_weight": 0.0,
                "investment_thesis": "",
                "sector_peers": [],
                "recommendation_bias": "NEUTRAL",
            }
        else:
            renaissance_context = renaissance_result or {}

        if isinstance(wm_result, Exception):
            logger.warning("[Kai Stream] World model fetch failed for %s: %s", user_id, wm_result)
            wm_index = None
        else:
            wm_index = wm_result

        request_context: Dict[str, Any] = context if isinstance(context, dict) else {}
        full_user_context: Dict[str, Any] = {
            "risk_profile": risk_profile,
            "holdings_summary": [],
            "goals": [],
            "learned_attributes": [],
            "preferences": {},
            "user_name": request_context.get("name")
            or request_context.get("display_name")
            or request_context.get("user_name")
            or "Investor",
            "request_context": request_context,
        }

        if wm_index and wm_index.domain_summaries:
            # Extract Financial Context
            fin_summary = wm_index.domain_summaries.get("financial", {})
            full_user_context["holdings_summary"] = fin_summary.get("holdings", [])
            full_user_context["portfolio_allocation"] = {
                "equities": fin_summary.get("equities_pct", 0),
                "cash": fin_summary.get("cash_pct", 0),
            }
            full_user_context["financial_summary"] = fin_summary

            # Extract Kai profile summary flags (stored from onboarding preferences flow)
            kai_profile_summary = wm_index.domain_summaries.get("kai_profile", {})
            if isinstance(kai_profile_summary, dict):
                full_user_context["kai_profile_summary"] = kai_profile_summary

            # Extract Learned Attributes (across all domains)
            # In a real implementation, we might filter for relevant ones
            # For now, we pass the raw domain summaries
            full_user_context["domain_summaries"] = wm_index.domain_summaries

        # Merge frontend-provided preference hints (decrypted client-side context where available).
        preference_container = {}
        if isinstance(request_context.get("preferences"), dict):
            preference_container.update(request_context.get("preferences", {}))
        if isinstance(request_context.get("kai_profile"), dict):
            profile = request_context.get("kai_profile", {})
            preference_container.update(
                {
                    "investment_horizon": profile.get("investment_horizon"),
                    "investment_style": profile.get("investment_style"),
                }
            )
        if "investment_horizon" in request_context:
            preference_container["investment_horizon"] = request_context.get("investment_horizon")
        if "investment_style" in request_context:
            preference_container["investment_style"] = request_context.get("investment_style")
        full_user_context["preferences"] = {
            key: value for key, value in preference_container.items() if value not in (None, "")
        }

        # Yield thinking event about context retrieval
        yield create_event(
            "kai_thinking",
            {
                "text": f"Analyzing {ticker} with {renaissance_context.get('tier', 'Standard')} Tier context...",
                "phase": "analysis",
                "round": 1,
            },
        )

        # =========================================================================
        # 2. INITIALIZE ENGINE WITH INJECTED DATA
        # =========================================================================

        # Normalize risk_profile to lowercase for DebateEngine config
        normalized_risk_profile = risk_profile.lower() if risk_profile else "balanced"

        debate_engine = DebateEngine(
            risk_profile=normalized_risk_profile,
            disconnection_event=disconnection_event,
            user_context=full_user_context,
            renaissance_context=renaissance_context,
        )

        # =========================================================================
        # 3. STREAM AGENT THOUGHTS (Round 1 Pre-computation)
        # =========================================================================

        # Initialize agents
        fundamental_agent = FundamentalAgent(processing_mode="hybrid")
        sentiment_agent = SentimentAgent(processing_mode="hybrid")
        valuation_agent = ValuationAgent(processing_mode="hybrid")

        # =====================================================================
        # PHASE 1: Parallel Agent Analysis
        # =====================================================================

        # Kai thinking - orchestration reasoning
        yield create_event(
            "kai_thinking",
            {
                "phase": "analysis",
                "round": 1,
                "message": f"🧠 Initializing analysis pipeline for {ticker}...",
                "tokens": [
                    "Activating",
                    "three",
                    "specialist",
                    "agents:",
                    "Fundamental,",
                    "Sentiment,",
                    "and",
                    "Valuation.",
                ],
            },
        )
        await asyncio.sleep(0.05)

        yield create_event(
            "kai_thinking",
            {
                "phase": "analysis",
                "round": 1,
                "message": "📊 Each agent will perform deep analysis using specialized tools and data sources...",
                "tokens": [
                    "Fundamental:",
                    "SEC",
                    "filings,",
                    "financial",
                    "ratios.",
                    "Sentiment:",
                    "news,",
                    "catalysts.",
                    "Valuation:",
                    "P/E,",
                    "DCF",
                    "models.",
                ],
            },
        )
        await asyncio.sleep(0.05)

        # Signal start of fundamental analysis
        yield create_event(
            "agent_start",
            {
                "agent": "fundamental",
                "agent_name": "Fundamental Agent",
                "color": "#3b82f6",
                "message": f"Analyzing SEC filings for {ticker}...",
                "round": 1,
                "phase": "analysis",
            },
        )

        # Stream Gemini thinking tokens for fundamental analysis
        async for token_event in stream_agent_thinking(
            agent_name="Fundamental",
            ticker=ticker,
            prompt_context="Analyze SEC filings, revenue trends, cash flow, and business moat.",
            request=request,
            round_number=1,
            phase="analysis",
        ):
            _ = remaining_timeout()
            yield token_event

            # Check for disconnection after each token
            if await check_disconnected():
                logger.info(
                    "[Kai Stream] Client disconnected during fundamental streaming, stopping..."
                )
                return

        # Run actual fundamental analysis (this gets the structured data)
        try:
            max_agent_attempts = 3
            fundamental_insight = None
            fundamental_last_error: Optional[Exception] = None
            for attempt in range(1, max_agent_attempts + 1):
                try:
                    fundamental_insight = await asyncio.wait_for(
                        fundamental_agent.analyze(
                            ticker=ticker,
                            user_id=user_id,
                            consent_token=consent_token,
                            context=context,
                        ),
                        timeout=remaining_timeout(),
                    )
                    fundamental_last_error = None
                    break
                except Exception as agent_err:
                    fundamental_last_error = agent_err
                    if _is_retryable_rate_limit_error(agent_err) and attempt < max_agent_attempts:
                        retry_delay = min(8, 2**attempt)
                        yield create_event(
                            "warning",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "agent": "fundamental",
                                "code": "AGENT_RATE_LIMIT_RETRY",
                                "retryable": True,
                                "retry_in_seconds": retry_delay,
                                "message": (
                                    "Fundamental agent hit provider rate limits. "
                                    f"Retrying from the same step in {retry_delay}s."
                                ),
                            },
                        )
                        yield create_event(
                            "kai_thinking",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "message": (
                                    "Fundamental agent throttled by provider. "
                                    f"Retrying in {retry_delay}s without restarting debate."
                                ),
                            },
                        )
                        await asyncio.sleep(retry_delay)
                        continue
                    break
            if fundamental_last_error is not None or fundamental_insight is None:
                raise fundamental_last_error or RuntimeError("Fundamental agent returned no output")
            yield create_event(
                "agent_complete",
                {
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
                    "sources": fundamental_insight.sources,
                    "round": 1,
                    "phase": "analysis",
                },
            )
        except Exception as e:
            logger.error(f"[Kai Stream] Fundamental agent error: {e}")
            yield create_event(
                "agent_error",
                {"agent": "fundamental", "error": str(e), "round": 1, "phase": "analysis"},
            )
            if isinstance(e, RealtimeDataUnavailable):
                yield create_event(
                    "error",
                    {
                        "code": e.code,
                        "message": (
                            "Required realtime market inputs are unavailable. "
                            "Retry when providers are reachable."
                        ),
                        "dependency": e.source,
                        "retryable": e.retryable,
                    },
                    terminal=True,
                )
                return
            yield create_event(
                "error",
                {
                    "code": "ANALYZE_AGENT_FAILED",
                    "message": "Fundamental analysis failed before debate could start.",
                    "agent": "fundamental",
                    "retryable": True,
                },
                terminal=True,
            )
            return

        # Check if client disconnected
        if await request.is_disconnected():
            return

        # Signal start of sentiment analysis
        yield create_event(
            "agent_start",
            {
                "agent": "sentiment",
                "agent_name": "Sentiment Agent",
                "color": "#8b5cf6",
                "message": f"Analyzing market sentiment for {ticker}...",
                "round": 1,
                "phase": "analysis",
            },
        )

        # Stream Gemini thinking tokens for sentiment analysis
        async for token_event in stream_agent_thinking(
            agent_name="Sentiment",
            ticker=ticker,
            prompt_context="Analyze news sentiment, market catalysts, and momentum signals.",
            request=request,
            round_number=1,
            phase="analysis",
        ):
            _ = remaining_timeout()
            yield token_event

            # Check for disconnection after each token
            if await check_disconnected():
                logger.info(
                    "[Kai Stream] Client disconnected during sentiment streaming, stopping..."
                )
                return

        # Run actual sentiment analysis
        try:
            max_agent_attempts = 3
            sentiment_insight = None
            sentiment_last_error: Optional[Exception] = None
            for attempt in range(1, max_agent_attempts + 1):
                try:
                    sentiment_insight = await asyncio.wait_for(
                        sentiment_agent.analyze(
                            ticker=ticker,
                            user_id=user_id,
                            consent_token=consent_token,
                            context=context,
                        ),
                        timeout=remaining_timeout(),
                    )
                    sentiment_last_error = None
                    break
                except Exception as agent_err:
                    sentiment_last_error = agent_err
                    if _is_retryable_rate_limit_error(agent_err) and attempt < max_agent_attempts:
                        retry_delay = min(8, 2**attempt)
                        yield create_event(
                            "warning",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "agent": "sentiment",
                                "code": "AGENT_RATE_LIMIT_RETRY",
                                "retryable": True,
                                "retry_in_seconds": retry_delay,
                                "message": (
                                    "Sentiment agent hit provider rate limits. "
                                    f"Retrying from the same step in {retry_delay}s."
                                ),
                            },
                        )
                        yield create_event(
                            "kai_thinking",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "message": (
                                    "Sentiment agent throttled by provider. "
                                    f"Retrying in {retry_delay}s without restarting debate."
                                ),
                            },
                        )
                        await asyncio.sleep(retry_delay)
                        continue
                    break
            if sentiment_last_error is not None or sentiment_insight is None:
                raise sentiment_last_error or RuntimeError("Sentiment agent returned no output")
            yield create_event(
                "agent_complete",
                {
                    "agent": "sentiment",
                    "summary": sentiment_insight.summary,
                    "recommendation": sentiment_insight.recommendation,
                    "confidence": sentiment_insight.confidence,
                    "sentiment_score": sentiment_insight.sentiment_score,
                    "key_catalysts": sentiment_insight.key_catalysts,
                    "sources": sentiment_insight.sources,
                    "round": 1,
                    "phase": "analysis",
                },
            )
        except Exception as e:
            logger.error(f"[Kai Stream] Sentiment agent error: {e}")
            yield create_event(
                "agent_error",
                {"agent": "sentiment", "error": str(e), "round": 1, "phase": "analysis"},
            )
            if isinstance(e, RealtimeDataUnavailable):
                yield create_event(
                    "error",
                    {
                        "code": e.code,
                        "message": (
                            "Required realtime market inputs are unavailable. "
                            "Retry when providers are reachable."
                        ),
                        "dependency": e.source,
                        "retryable": e.retryable,
                    },
                    terminal=True,
                )
                return
            yield create_event(
                "error",
                {
                    "code": "ANALYZE_AGENT_FAILED",
                    "message": "Sentiment analysis failed before debate could start.",
                    "agent": "sentiment",
                    "retryable": True,
                },
                terminal=True,
            )
            return

        if await request.is_disconnected():
            return

        # Signal start of valuation analysis
        yield create_event(
            "agent_start",
            {
                "agent": "valuation",
                "agent_name": "Valuation Agent",
                "color": "#10b981",
                "message": f"Calculating valuation metrics for {ticker}...",
                "round": 1,
                "phase": "analysis",
            },
        )

        # Stream Gemini thinking tokens for valuation analysis
        async for token_event in stream_agent_thinking(
            agent_name="Valuation",
            ticker=ticker,
            prompt_context="Analyze P/E multiples, DCF valuation, and peer comparisons.",
            request=request,
            round_number=1,
            phase="analysis",
        ):
            _ = remaining_timeout()
            yield token_event

            # Check for disconnection after each token
            if await check_disconnected():
                logger.info(
                    "[Kai Stream] Client disconnected during valuation streaming, stopping..."
                )
                return

        # Run actual valuation analysis
        try:
            max_agent_attempts = 3
            valuation_insight = None
            valuation_last_error: Optional[Exception] = None
            for attempt in range(1, max_agent_attempts + 1):
                try:
                    valuation_insight = await asyncio.wait_for(
                        valuation_agent.analyze(
                            ticker=ticker,
                            user_id=user_id,
                            consent_token=consent_token,
                            context=context,
                        ),
                        timeout=remaining_timeout(),
                    )
                    valuation_last_error = None
                    break
                except Exception as agent_err:
                    valuation_last_error = agent_err
                    if _is_retryable_rate_limit_error(agent_err) and attempt < max_agent_attempts:
                        retry_delay = min(8, 2**attempt)
                        yield create_event(
                            "warning",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "agent": "valuation",
                                "code": "AGENT_RATE_LIMIT_RETRY",
                                "retryable": True,
                                "retry_in_seconds": retry_delay,
                                "message": (
                                    "Valuation agent hit provider rate limits. "
                                    f"Retrying from the same step in {retry_delay}s."
                                ),
                            },
                        )
                        yield create_event(
                            "kai_thinking",
                            {
                                "phase": "analysis",
                                "round": 1,
                                "message": (
                                    "Valuation agent throttled by provider. "
                                    f"Retrying in {retry_delay}s without restarting debate."
                                ),
                            },
                        )
                        await asyncio.sleep(retry_delay)
                        continue
                    break
            if valuation_last_error is not None or valuation_insight is None:
                raise valuation_last_error or RuntimeError("Valuation agent returned no output")
            yield create_event(
                "agent_complete",
                {
                    "agent": "valuation",
                    "summary": valuation_insight.summary,
                    "recommendation": valuation_insight.recommendation,
                    "confidence": valuation_insight.confidence,
                    "valuation_metrics": valuation_insight.valuation_metrics,
                    "peer_comparison": valuation_insight.peer_comparison,
                    "price_targets": valuation_insight.price_targets,
                    "sources": valuation_insight.sources,
                    "round": 1,
                    "phase": "analysis",
                },
            )
        except Exception as e:
            logger.error(f"[Kai Stream] Valuation agent error: {e}")
            yield create_event(
                "agent_error",
                {"agent": "valuation", "error": str(e), "round": 1, "phase": "analysis"},
            )
            if isinstance(e, RealtimeDataUnavailable):
                yield create_event(
                    "error",
                    {
                        "code": e.code,
                        "message": (
                            "Required realtime market inputs are unavailable. "
                            "Retry when providers are reachable."
                        ),
                        "dependency": e.source,
                        "retryable": e.retryable,
                    },
                    terminal=True,
                )
                return
            yield create_event(
                "error",
                {
                    "code": "ANALYZE_AGENT_FAILED",
                    "message": "Valuation analysis failed before debate could start.",
                    "agent": "valuation",
                    "retryable": True,
                },
                terminal=True,
            )
            return

        if await request.is_disconnected():
            return

        # =====================================================================
        # PHASE 2 & 3: Debate & Decision (Streaming)
        # =====================================================================

        # Kai thinking - starting debate
        yield create_event(
            "kai_thinking",
            {
                "phase": "round1",
                "round": 1,
                "message": "⚖️ Now orchestrating multi-agent debate to reach consensus...",
                "tokens": [
                    "Each",
                    "agent",
                    "will",
                    "present",
                    "their",
                    "position",
                    "in",
                    "two",
                    "rounds.",
                    "Dissent",
                    "will",
                    "be",
                    "captured.",
                ],
            },
        )

        # NOTE: DebateEngine now handles all intermediate streaming (kai_thinking, agent_token, debate_round)
        # We pipeline its generator directly to the output.

        debate_result = None
        current_round = 1
        current_phase = "analysis"
        debate_highlights: list[dict[str, Any]] = []

        async for event in debate_engine.orchestrate_debate_stream(
            fundamental_insight=fundamental_insight,
            sentiment_insight=sentiment_insight,
            valuation_insight=valuation_insight,
            user_context=full_user_context,  # Redundant but keeps signature clean
        ):
            # If client disconnected, stop yielding
            if await check_disconnected():
                return
            _ = remaining_timeout()
            event_name = event.get("event", "message")
            event_payload = event.get("data", {})
            if isinstance(event_payload, str):
                try:
                    event_payload = json.loads(event_payload)
                except json.JSONDecodeError:
                    event_payload = {"message": event_payload}
            elif not isinstance(event_payload, dict):
                event_payload = {"value": event_payload}
            normalized_payload = _normalize_analyze_event_payload(
                event_name,
                event_payload,
                default_round=current_round,
                default_phase=current_phase,
            )
            if event_name in {"debate_round", "round_start"}:
                current_round = _safe_round(normalized_payload.get("round"), current_round)
                current_phase = str(
                    normalized_payload.get("phase")
                    or ("debate" if current_round == 2 else "analysis")
                )
            elif event_name in {"agent_start", "agent_token", "agent_complete", "agent_error"}:
                current_round = _safe_round(normalized_payload.get("round"), current_round)
                current_phase = str(normalized_payload.get("phase") or current_phase)
            elif event_name == "insight_extracted":
                if len(debate_highlights) < 36:
                    debate_highlights.append(
                        {
                            "type": normalized_payload.get("type"),
                            "agent": normalized_payload.get("agent"),
                            "content": str(normalized_payload.get("content") or "")[:360],
                            "classification": normalized_payload.get("classification"),
                            "confidence": normalized_payload.get("confidence"),
                            "magnitude": normalized_payload.get("magnitude"),
                            "score": normalized_payload.get("score"),
                            "source": normalized_payload.get("source"),
                        }
                    )
            yield create_event(event_name, normalized_payload)

            # Check for disconnection after each event
            if await check_disconnected():
                logger.info("[Kai Stream] Client disconnected during debate streaming, stopping...")
                return

        # Access the final result from the engine state (cleaner than return value hacking)
        # We need to reconstruct it or expose it.
        # Let's assume for now we can rebuild the decision card from the stored rounds in the engine or similar.
        # Actually, let's look at DebateEngine again.

        # RE-READING my DebateEngine implementation:
        # It calculates "result" at the end and returns it.
        # To get this "result" object out of `async for`, we can't easily.
        # BETTER APPROACH: Do the logic here.

        # Wait, I can just recalculate it effectively or trust the engine to yield the "decision" event?
        # My DebateEngine implementation DOES NOT yield "decision". It yields "debate_round", etc.
        # So I need to calculate the decision here or add it to the engine.

        # Let's use the engine's internal state to build the final card.
        # Or better: call _build_consensus manually again? No, that's wasteful.

        # Let's do this:
        # The DebateEngine logic I wrote runs `_build_consensus` at the end.
        # I will call that here to get the final object for the "decision" event.

        debate_result = await asyncio.wait_for(
            debate_engine._build_consensus(
                fundamental_insight, sentiment_insight, valuation_insight
            ),
            timeout=remaining_timeout(),
        )
        # Note: debate_engine.rounds is populated by the generator run!
        debate_result.rounds = debate_engine.rounds

        # =====================================================================
        # FINAL DECISION EVENT
        # =====================================================================

        # Kai thinking - final reasoning
        yield create_event(
            "kai_thinking",
            {
                "phase": "decision",
                "round": 2,
                "message": "🎯 Synthesizing final recommendation from debate outcomes...",
                "tokens": [
                    "Weighting",
                    "agent",
                    "votes",
                    "by",
                    risk_profile,
                    "risk",
                    "profile.",
                    "Calculating",
                    "confidence",
                    "score.",
                ],
            },
        )
        await asyncio.sleep(0.3)

        if debate_result.consensus_reached:
            yield create_event(
                "kai_thinking",
                {
                    "phase": "decision",
                    "round": 2,
                    "message": "✅ Consensus reached. All agents agree on the recommendation.",
                    "tokens": ["Unanimous", "agreement:", debate_result.decision.upper()],
                },
            )
        else:
            yield create_event(
                "kai_thinking",
                {
                    "phase": "decision",
                    "round": 2,
                    "message": f"⚠️ Majority decision with {len(debate_result.dissenting_opinions)} dissenting opinion(s).",
                    "tokens": [
                        "Majority",
                        "recommends:",
                        debate_result.decision.upper(),
                        "with",
                        "dissent",
                        "noted.",
                    ],
                },
            )
        await asyncio.sleep(0.2)

        synthesis_payload = await asyncio.wait_for(
            synthesize_debate_recommendation_card(
                ticker=ticker,
                risk_profile=risk_profile,
                user_context=full_user_context,
                renaissance_context=renaissance_context,
                fundamental_payload={
                    "summary": fundamental_insight.summary,
                    "recommendation": fundamental_insight.recommendation,
                    "confidence": fundamental_insight.confidence,
                    "business_moat": fundamental_insight.business_moat,
                    "financial_resilience": fundamental_insight.financial_resilience,
                    "growth_efficiency": fundamental_insight.growth_efficiency,
                    "bull_case": fundamental_insight.bull_case,
                    "bear_case": fundamental_insight.bear_case,
                    "key_metrics": fundamental_insight.key_metrics,
                    "quant_metrics": fundamental_insight.quant_metrics,
                },
                sentiment_payload={
                    "summary": sentiment_insight.summary,
                    "recommendation": sentiment_insight.recommendation,
                    "confidence": sentiment_insight.confidence,
                    "sentiment_score": sentiment_insight.sentiment_score,
                    "key_catalysts": sentiment_insight.key_catalysts,
                },
                valuation_payload={
                    "summary": valuation_insight.summary,
                    "recommendation": valuation_insight.recommendation,
                    "confidence": valuation_insight.confidence,
                    "valuation_metrics": valuation_insight.valuation_metrics,
                    "peer_comparison": valuation_insight.peer_comparison,
                    "price_targets": valuation_insight.price_targets,
                },
                debate_payload={
                    "decision": debate_result.decision,
                    "confidence": debate_result.confidence,
                    "consensus_reached": debate_result.consensus_reached,
                    "agent_votes": debate_result.agent_votes,
                    "dissenting_opinions": debate_result.dissenting_opinions,
                    "final_statement": debate_result.final_statement,
                },
                highlights=debate_highlights,
            ),
            timeout=min(remaining_timeout(), 30.0),
        )

        world_model_context = {
            "risk_profile": full_user_context.get("risk_profile"),
            "preferences": full_user_context.get("preferences", {}),
            "holdings_count": len(full_user_context.get("holdings_summary", []) or []),
            "portfolio_allocation": full_user_context.get("portfolio_allocation", {}),
            "has_domain_summaries": bool(full_user_context.get("domain_summaries")),
        }

        # Build raw_card structure
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
                    "catalyst_count": len(sentiment_insight.key_catalysts)
                    if sentiment_insight.key_catalysts
                    else 0,
                },
                "valuation": valuation_insight.valuation_metrics,
            },
            "price_targets": valuation_insight.price_targets,
            "all_sources": list(
                set(
                    fundamental_insight.sources
                    + sentiment_insight.sources
                    + valuation_insight.sources
                )
            ),
            "risk_persona_alignment": f"This {debate_result.decision.upper()} recommendation aligns with your {risk_profile} risk profile.",
            "debate_digest": debate_result.final_statement,
            "consensus_reached": debate_result.consensus_reached,
            "dissenting_opinions": debate_result.dissenting_opinions,
            "debate_highlights": debate_highlights[:20],
            "world_model_context": world_model_context,
            "renaissance_tier": renaissance_context.get("tier"),
            "renaissance_score": float(renaissance_context.get("conviction_weight", 0.0) or 0.0)
            * 100.0,
            "renaissance_context": {
                "tier": renaissance_context.get("tier"),
                "tier_description": renaissance_context.get("tier_description"),
                "conviction_weight": renaissance_context.get("conviction_weight"),
                "investment_thesis": renaissance_context.get("investment_thesis"),
                "fcf_billions": renaissance_context.get("fcf_billions"),
                "sector": renaissance_context.get("sector"),
                "sector_peers": renaissance_context.get("sector_peers", []),
                "recommendation_bias": renaissance_context.get("recommendation_bias"),
                "is_investable": renaissance_context.get("is_investable"),
                "is_avoid": renaissance_context.get("is_avoid"),
                "avoid_reason": renaissance_context.get("avoid_reason"),
                "screening_criteria": renaissance_context.get("screening_criteria"),
            },
            "alphaagents_trace": {
                "paper": "arXiv:2508.11152v1",
                "protocol": "round_robin_adversarial_debate",
                "rounds_executed": len(debate_engine.rounds),
                "turns_per_agent": 2,
                "consensus_method": "weighted_vote_by_risk_profile",
                "consensus_threshold": 0.70,
                "consensus_reached": debate_result.consensus_reached,
            },
            "llm_synthesis": synthesis_payload,
        }

        yield create_event(
            "decision",
            {
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
                "raw_card": raw_card,
                "round": 2,
                "phase": "decision",
            },
            terminal=True,
        )

        logger.info(f"[Kai Stream] Analysis complete for {ticker}: {debate_result.decision}")

    except asyncio.TimeoutError:
        logger.warning(
            "[Kai Stream] Hard timeout (%ss) reached for %s",
            STOCK_ANALYZE_TIMEOUT_SECONDS,
            ticker,
        )
        yield create_event(
            "error",
            {
                "code": "ANALYZE_TIMEOUT",
                "message": f"Analysis timed out after {STOCK_ANALYZE_TIMEOUT_SECONDS}s.",
                "ticker": ticker,
            },
            terminal=True,
        )
    except Exception as e:
        logger.exception(f"[Kai Stream] Error during analysis: {e}")
        yield create_event(
            "error",
            {"code": "ANALYZE_STREAM_FAILED", "message": str(e), "ticker": ticker},
            terminal=True,
        )
    finally:
        _stream_ctx.reset(stream_token)


# ============================================================================
# SSE ENDPOINTS
# ============================================================================


@router.get("/analyze/stream")
async def analyze_stream(
    request: Request,
    ticker: str,
    user_id: str,
    risk_profile: str = "balanced",
    authorization: Optional[str] = Header(None, description="Bearer VAULT_OWNER consent token"),
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
            status_code=401, detail="Missing consent token. Call /api/consent/owner-token first."
        )

    consent_token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)

    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")

    if payload.user_id != user_id:
        raise HTTPException(status_code=403, detail="Token user mismatch")

    # Log operation for audit trail (shows what vault.owner token was used for)
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=user_id,
        operation="kai.analyze",
        target=ticker,
        metadata={"risk_profile": risk_profile, "endpoint": "stream/analyze"},
    )

    logger.info(f"[Kai Stream] SSE connection opened for {ticker} - user {user_id}")

    return EventSourceResponse(
        analyze_stream_generator(
            ticker=ticker,
            user_id=user_id,
            consent_token=consent_token,
            risk_profile=risk_profile,
            context=None,
            request=request,
        ),
        ping=15,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/analyze/stream")
async def analyze_stream_post(
    request: Request,
    body: StreamAnalyzeRequest,
    authorization: Optional[str] = Header(None, description="Bearer VAULT_OWNER consent token"),
):
    """
    POST version of streaming analysis (allows context in body).
    """

    # Validate consent token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing consent token. Call /api/consent/owner-token first."
        )

    consent_token = authorization.replace("Bearer ", "")
    valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)

    if not valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")

    if payload.user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Token user mismatch")

    # Log operation for audit trail (shows what vault.owner token was used for)
    consent_service = ConsentDBService()
    await consent_service.log_operation(
        user_id=body.user_id,
        operation="kai.analyze",
        target=body.ticker,
        metadata={
            "risk_profile": body.risk_profile,
            "endpoint": "stream/analyze",
            "has_context": body.context is not None,
        },
    )

    return EventSourceResponse(
        analyze_stream_generator(
            ticker=body.ticker,
            user_id=body.user_id,
            consent_token=consent_token,
            risk_profile=body.risk_profile,
            context=body.context,
            request=request,
        ),
        ping=15,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
