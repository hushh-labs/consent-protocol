"""
Kai Losers Analysis API Route

Provides a portfolio-level losers analysis using:
- Renaissance investable universe (tiers + thesis)
- Renaissance avoid list (direct + extended)
- Renaissance screening criteria rubric (criteria-first prompting)

Authentication:
- Requires VAULT_OWNER token (consent-first architecture)
"""

import asyncio
import json
import logging
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.middleware import require_vault_owner_token
from api.routes.kai._streaming import (
    DEFAULT_STREAM_TIMEOUT_SECONDS,
    HEARTBEAT_INTERVAL_SECONDS,
    CanonicalSSEStream,
    parse_json_with_single_repair,
)
from hushh_mcp.services.renaissance_service import get_renaissance_service

logger = logging.getLogger(__name__)

router = APIRouter()


class PortfolioLoser(BaseModel):
    symbol: str = Field(..., description="Ticker symbol")
    name: Optional[str] = None
    gain_loss_pct: Optional[float] = Field(
        None, description="Unrealized P/L percent (negative for losers)"
    )
    gain_loss: Optional[float] = Field(None, description="Unrealized P/L amount")
    market_value: Optional[float] = None


class PortfolioHolding(BaseModel):
    """Full-position snapshot for Optimize Portfolio (not only losers)."""

    symbol: str = Field(..., description="Ticker symbol")
    name: Optional[str] = None
    gain_loss_pct: Optional[float] = Field(None, description="Unrealized P/L percent")
    gain_loss: Optional[float] = Field(None, description="Unrealized P/L amount")
    market_value: Optional[float] = Field(None, description="Current market value of the position")
    sector: Optional[str] = Field(None, description="Sector or industry label if available")
    asset_type: Optional[str] = Field(
        None, description="High-level asset type (equity, cash, ETF, etc.)"
    )


class AnalyzeLosersRequest(BaseModel):
    user_id: str
    losers: list[PortfolioLoser] = Field(default_factory=list)
    threshold_pct: float = Field(-5.0, description="Only analyze losers at or below this %")
    max_positions: int = Field(
        10, ge=1, le=50, description="Max number of loser positions to analyze"
    )
    holdings: list[PortfolioHolding] = Field(
        default_factory=list,
        description="Optional full holdings snapshot for Optimize Portfolio.",
    )
    force_optimize: bool = Field(
        False,
        description=(
            "If true and losers do not meet the threshold, treat holdings as the "
            "optimization universe instead of returning an error."
        ),
    )


class AnalyzeLosersResponse(BaseModel):
    criteria_context: str
    summary: dict
    losers: list[dict]
    portfolio_level_takeaways: list[str]
    analytics: Optional[dict] = Field(None, description="Radar and sector distribution metrics")


def _convert_decimals(obj: Any) -> Any:
    """Recursively convert Decimal objects to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    return obj


@router.post("/portfolio/analyze-losers", response_model=AnalyzeLosersResponse)
async def analyze_portfolio_losers(
    request: AnalyzeLosersRequest,
    token_data: dict = Depends(require_vault_owner_token),
) -> AnalyzeLosersResponse:
    """
    Analyze portfolio losers against Renaissance investable/avoid lists + criteria rubric.

    IMPORTANT: BYOK constraints mean the backend does not persist a user’s full holdings.
    The caller must provide the loser positions (symbol + P/L context).
    """
    if token_data["user_id"] != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    losers_in = request.losers or []
    holdings_in = request.holdings or []

    # ------------------------------------------------------------------
    # Build optimization universe:
    # - Prefer explicit losers that meet the threshold.
    # - If none and force_optimize + holdings, fall back to top holdings.
    # ------------------------------------------------------------------
    losers_filtered: list[PortfolioLoser] = []
    for loser in losers_in:
        pct = loser.gain_loss_pct
        if pct is None or pct <= request.threshold_pct:
            losers_filtered.append(loser)
    losers_filtered = losers_filtered[: request.max_positions]

    optimize_from_losers = bool(losers_filtered)

    if not optimize_from_losers:
        if request.force_optimize and holdings_in:
            sorted_holdings = sorted(
                holdings_in,
                key=lambda h: h.market_value or 0.0,
                reverse=True,
            )[: request.max_positions]
            losers_filtered = [
                PortfolioLoser(
                    symbol=h.symbol,
                    name=h.name,
                    gain_loss_pct=h.gain_loss_pct,
                    gain_loss=h.gain_loss,
                    market_value=h.market_value,
                )
                for h in sorted_holdings
            ]
            optimize_from_losers = False
        else:
            # Preserve legacy error behaviour when we truly have no input.
            if not losers_in:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No losers provided. Provide loser positions from the client portfolio.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No losers met the threshold. Lower threshold_pct or provide more losers.",
            )

    renaissance = get_renaissance_service()
    criteria_context = await renaissance.get_screening_context()
    criteria_rows = await renaissance.get_screening_criteria()

    # Build investable replacement candidates: fetch EVERY investable stock
    all_investable = await renaissance.get_all_investable()
    replacement_pool = [
        {
            "ticker": s.ticker,
            "tier": s.tier,
            "sector": s.sector,
            "thesis": s.investment_thesis,
            "name": s.company_name,
        }
        for s in all_investable
    ]

    # Per-position Renaissance context (optimization universe)
    total_mv = sum((loser.market_value or 0.0) for loser in losers_filtered) or 0.0
    per_loser_context: list[dict[str, Any]] = []
    for loser in losers_filtered:
        ticker = loser.symbol.upper().strip()
        ren_ctx = await renaissance.get_analysis_context(ticker)
        weight_pct = (loser.market_value or 0.0) / total_mv * 100.0 if total_mv > 0 else None
        per_loser_context.append(
            {
                "symbol": ticker,
                "name": loser.name,
                "gain_loss_pct": loser.gain_loss_pct,
                "gain_loss": loser.gain_loss,
                "market_value": loser.market_value,
                "weight_pct": weight_pct,
                "renaissance": {
                    "is_investable": ren_ctx.get("is_investable", False),
                    "tier": ren_ctx.get("tier"),
                    "tier_description": ren_ctx.get("tier_description"),
                    "investment_thesis": ren_ctx.get("investment_thesis"),
                    "fcf_billions": ren_ctx.get("fcf_billions"),
                    "conviction_weight": ren_ctx.get("conviction_weight"),
                    "is_avoid": ren_ctx.get("is_avoid", False),
                    "avoid_category": ren_ctx.get("avoid_category"),
                    "avoid_reason": ren_ctx.get("avoid_reason"),
                    "avoid_source": ren_ctx.get("avoid_source"),
                },
            }
        )

    # LLM synthesis (Optimize Portfolio: criteria-first, JSON-only output)
    # SDK auto-configures from GOOGLE_API_KEY and GOOGLE_GENAI_USE_VERTEXAI env vars
    from google import genai
    from google.genai import types as genai_types
    from google.genai.types import HttpOptions

    from hushh_mcp.constants import GEMINI_MODEL

    client = genai.Client(http_options=HttpOptions(api_version="v1"))
    model_to_use = GEMINI_MODEL
    logger.info(f"Optimize Portfolio: Using Vertex AI with model {model_to_use}")

    portfolio_snapshot = {
        "threshold_pct": request.threshold_pct,
        "max_positions": request.max_positions,
        "mode": "losers" if optimize_from_losers else "full_portfolio",
        "total_positions_market_value": total_mv,
        "positions": per_loser_context,
    }

    prompt = f"""
You are Kai's **Optimize Portfolio** investment committee.

ROLE AND CONSTRAINTS
--------------------
- You apply the Renaissance screening rubric, tiers, and avoid rules to optimize a REAL portfolio.
- BYOK / consent-first: you NEVER place trades. You only propose illustrative, auditable rebalancing plans.
- You must act like a cautious CIO:
  - No leverage, margin, derivatives, or shorting.
  - No market timing or price targets. Focus on allocation quality and risk.
- Prefer **moving capital from avoid / low-quality names into ACE/KING investable names**.
- Respect diversification: avoid extreme concentration in any single name or sector.
- REAL DATA: Use the actual `market_value` and `weight_pct` provided. Propose real, data-driven weight changes.
- NO MOCK DATA: Do not use placeholders. If you lack data, say so, but utilize everything you have.

DATA YOU HAVE
-------------
<<RENAISSANCE_RUBRIC>>
{criteria_context}

<<RENAISSANCE_CRITERIA_TABLE>>
{json.dumps(_convert_decimals(criteria_rows), ensure_ascii=False)}

<<RENAISSANCE_TIERS>>
ACE: conviction_weight 1.0  — highest quality, very rare, default bias STRONG_BUY.
KING: conviction_weight 0.85 — high quality, bias BUY.
QUEEN: conviction_weight 0.70 — solid but with more questions, bias HOLD_TO_BUY.
JACK: conviction_weight 0.55 — acceptable but lower quality, bias HOLD.
Any ticker not in the investable universe has conviction_weight 0.0.
If a ticker is in the Renaissance avoid list, conviction_weight is effectively NEGATIVE regardless of tier.

<<REPLACEMENT_POOL>>
{json.dumps(_convert_decimals(replacement_pool), ensure_ascii=False)}

<<USER_PORTFOLIO_SNAPSHOT>>
Depending on mode, this is either:
- Mode \"losers\": positions currently losing beyond the given threshold.
- Mode \"full_portfolio\": top positions by market value to optimize around.
Use their market values and weight_pct fields to reason about risk and concentration.
{json.dumps(_convert_decimals(portfolio_snapshot), ensure_ascii=False)}

INSTRUCTIONS
------------
1) Diagnose portfolio health focusing on these losers:
   - Classify each loser as one of: "core_keep", "trim", "exit", "rotate", "watchlist".
   - Compute how much risk is in:
     * Renaissance AVOID names.
     * Non-investable names (neither investable nor avoid).
     * ACE/KING investable names.
   - Comment on concentration and drawdowns using the data available (do NOT invent missing holdings).

2) Design target allocations (conceptual, not exact trading instructions):
   - For each loser, propose a **target_weight_delta** (relative importance) and an `action`:
     * "HOLD", "ADD", "TRIM", "EXIT", or "ROTATE".
   - When suggesting EXIT or ROTATE, pick 1–3 candidates from the replacement pool that better fit the Renaissance rubric.
   - Keep plans self-funded: assume sells in losers finance buys in higher-quality names.

3) Build three plan flavours:
   - \"minimal\": only obvious, high-conviction changes (e.g., exit avoid names, small trims).
   - \"standard\": reasonable diversification and risk clean-up.
   - \"maximal\": aggressively apply the Renaissance funnel, accepting more turnover (still no leverage).

RULES
-----
- Ground EVERY claim in the provided data (loser inputs + Renaissance context + criteria table + replacement pool).
- If you lack key data, set `needs_more_data=true` and say exactly what is missing.
- If a stock is in the avoid list, treat it as a **hard negative prior** and explain why (avoid_category + avoid_reason).
- If a stock is ACE/KING, treat it as a **quality prior**; consider trimming rather than exiting unless the position is extremely large or breaks diversification rules.
- Use the screening criteria rubric to justify recommendations. Whenever possible, reference specific criteria IDs or titles.
- NEVER recommend options, margin, or shorting. NEVER guarantee outcomes.

OUTPUT FORMAT
-------------
Return ONLY valid JSON with this shape (no prose, no markdown):
{{
  "criteria_context": string,
  "summary": {{
    "health_score": number,                     // 0–100 current portfolio health score
    "projected_health_score": number,           // 0–100 PROJECTED health score after plans are executed
    "health_reasons": [string],                 // bullets explaining the score
    "portfolio_diagnostics": {{
      "total_losers_value": number,             // sum of losers market_value
      "avoid_weight_estimate_pct": number,      // approximate % of losers value in avoid names
      "investable_weight_estimate_pct": number, // approximate % of losers value in ACE/KING
      "concentration_notes": [string]
    }},
    "plans": {{
      "minimal": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }},
      "standard": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }},
      "maximal": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }}
    }}
  }},
  "losers": [
    {{
      "symbol": string,
      "name": string,
      "renaissance_tier": string | null,
      "avoid_category": string | null,
      "criteria_flags": [string],
      "needs_more_data": boolean,
      "likely_driver": "fundamental" | "sentiment" | "macro_rates" | "idiosyncratic" | "unknown",
      "confidence": number,
      "action": "hold" | "add" | "trim" | "exit" | "rotate",
      "rationale": string,
      "replacement_candidates": [{{ "ticker": string, "tier": string, "why": string }}],
      "current_weight_pct": number | null,
      "target_weight_pct": number | null
    }}
  ],
  "portfolio_level_takeaways": [string],
  "analytics": {{
    "health_radar": {{
      "current": {{ "Growth": number, "Moat": number, "Quality": number, "Income": number, "Resilience": number, "Diversification": number }},
      "optimized": {{ "Growth": number, "Moat": number, "Quality": number, "Income": number, "Resilience": number, "Diversification": number }}
    }},
    "sector_shift": [
      {{ "sector": string, "before_pct": number, "after_pct": number }}
    ]
  }}
}}
""".strip()

    try:
        config = genai_types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
        resp = await client.aio.models.generate_content(
            model=model_to_use,
            contents=prompt,
            config=config,
        )
        raw = (resp.text or "").strip()
        payload, _ = parse_json_with_single_repair(
            raw,
            required_keys={"summary", "losers", "portfolio_level_takeaways"},
        )
    except Exception as e:
        logger.error(f"Losers analysis LLM failed: {e}")
        raise HTTPException(status_code=500, detail="Losers analysis failed")

    # Ensure criteria_context is always present for UI (fallback to rubric)
    payload.setdefault("criteria_context", criteria_context)
    return AnalyzeLosersResponse(**payload)


async def _build_optimization_context(
    request: AnalyzeLosersRequest,
) -> tuple[list[PortfolioLoser], str, list[dict], list[dict], list[dict], bool, float]:
    """
    Build the optimization context (shared between streaming and non-streaming endpoints).

    Returns:
        Tuple of (losers_filtered, criteria_context, criteria_rows, replacement_pool,
                  per_loser_context, optimize_from_losers, total_mv)
    """
    losers_in = request.losers or []
    holdings_in = request.holdings or []

    # Build optimization universe
    losers_filtered: list[PortfolioLoser] = []
    for loser in losers_in:
        pct = loser.gain_loss_pct
        if pct is None or pct <= request.threshold_pct:
            losers_filtered.append(loser)
    losers_filtered = losers_filtered[: request.max_positions]

    optimize_from_losers = bool(losers_filtered)

    if not optimize_from_losers:
        if request.force_optimize and holdings_in:
            sorted_holdings = sorted(
                holdings_in,
                key=lambda h: h.market_value or 0.0,
                reverse=True,
            )[: request.max_positions]
            losers_filtered = [
                PortfolioLoser(
                    symbol=h.symbol,
                    name=h.name,
                    gain_loss_pct=h.gain_loss_pct,
                    gain_loss=h.gain_loss,
                    market_value=h.market_value,
                )
                for h in sorted_holdings
            ]
            optimize_from_losers = False
        else:
            if not losers_in:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No losers provided. Provide loser positions from the client portfolio.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No losers met the threshold. Lower threshold_pct or provide more losers.",
            )

    renaissance = get_renaissance_service()
    criteria_context = await renaissance.get_screening_context()
    criteria_rows = await renaissance.get_screening_criteria()

    # Build investable replacement candidates: fetch EVERY investable stock
    all_investable = await renaissance.get_all_investable()
    replacement_pool = [
        {
            "ticker": s.ticker,
            "tier": s.tier,
            "sector": s.sector,
            "thesis": s.investment_thesis,
            "name": s.company_name,
        }
        for s in all_investable
    ]

    total_mv = sum((loser.market_value or 0.0) for loser in losers_filtered) or 0.0
    per_loser_context: list[dict[str, Any]] = []
    for loser in losers_filtered:
        ticker = loser.symbol.upper().strip()
        ren_ctx = await renaissance.get_analysis_context(ticker)
        weight_pct = (loser.market_value or 0.0) / total_mv * 100.0 if total_mv > 0 else None
        per_loser_context.append(
            {
                "symbol": ticker,
                "name": loser.name,
                "gain_loss_pct": loser.gain_loss_pct,
                "gain_loss": loser.gain_loss,
                "market_value": loser.market_value,
                "weight_pct": weight_pct,
                "renaissance": {
                    "is_investable": ren_ctx.get("is_investable", False),
                    "tier": ren_ctx.get("tier"),
                    "tier_description": ren_ctx.get("tier_description"),
                    "investment_thesis": ren_ctx.get("investment_thesis"),
                    "fcf_billions": ren_ctx.get("fcf_billions"),
                    "conviction_weight": ren_ctx.get("conviction_weight"),
                    "is_avoid": ren_ctx.get("is_avoid", False),
                    "avoid_category": ren_ctx.get("avoid_category"),
                    "avoid_reason": ren_ctx.get("avoid_reason"),
                    "avoid_source": ren_ctx.get("avoid_source"),
                },
            }
        )

    return (
        losers_filtered,
        criteria_context,
        criteria_rows,
        replacement_pool,
        per_loser_context,
        optimize_from_losers,
        total_mv,
    )


def _build_optimization_prompt(
    criteria_context: str,
    criteria_rows: list[dict],
    replacement_pool: list[dict],
    portfolio_snapshot: dict,
) -> str:
    """Build the LLM prompt for portfolio optimization."""
    return f"""
You are Kai's **Optimize Portfolio** investment committee.

ROLE AND CONSTRAINTS
--------------------
- You apply the Renaissance screening rubric, tiers, and avoid rules to optimize a REAL portfolio.
- BYOK / consent-first: you NEVER place trades. You only propose illustrative, auditable rebalancing plans.
- You must act like a senior CIO/Portfolio Manager for HNWI clients:
  - No leverage, margin, derivatives, or shorting.
  - No market timing or price targets. Focus on allocation quality and risk.
  - Prefer **tax-efficient rotation from losers into high-conviction ACE/KING names**.
  - Respect diversification: avoid >15% concentration in any single name.
  - REAL DATA: Use the actual `market_value` and `weight_pct` provided. Propose real, data-driven trades.
  - NO MOCK DATA: Never use placeholders like '0' or 'N/A' if reasoning can be derived.

DATA YOU HAVE
-------------
<<RENAISSANCE_RUBRIC>>
{criteria_context}

<<RENAISSANCE_CRITERIA_TABLE>>
{json.dumps(_convert_decimals(criteria_rows), ensure_ascii=False)}

<<RENAISSANCE_TIERS>>
ACE: conviction_weight 1.0  — highest quality, very rare, default bias STRONG_BUY.
KING: conviction_weight 0.85 — high quality, bias BUY.
QUEEN: conviction_weight 0.70 — solid but with more questions, bias HOLD_TO_BUY.
JACK: conviction_weight 0.55 — acceptable but lower quality, bias HOLD.
Any ticker not in the investable universe has conviction_weight 0.0.
If a ticker is in the Renaissance avoid list, conviction_weight is effectively NEGATIVE regardless of tier.

<<REPLACEMENT_POOL>>
{json.dumps(_convert_decimals(replacement_pool), ensure_ascii=False)}

<<USER_PORTFOLIO_SNAPSHOT>>
Depending on mode, this is either:
- Mode "losers": positions currently losing beyond the given threshold.
- Mode "full_portfolio": top positions by market value to optimize around.
Use their market values and weight_pct fields to reason about risk and concentration.
{json.dumps(_convert_decimals(portfolio_snapshot), ensure_ascii=False)}

INSTRUCTIONS
------------
1) Diagnose portfolio health focusing on these losers:
   - Classify each loser as one of: "core_keep", "trim", "exit", "rotate", "watchlist".
   - Compute how much risk is in:
     * Renaissance AVOID names.
     * Non-investable names (neither investable nor avoid).
     * ACE/KING investable names.
   - Comment on concentration and drawdowns using the data available (do NOT invent missing holdings).

2) Design target allocations (conceptual, not exact trading instructions):
   - For each loser, propose a **target_weight_delta** (relative importance) and an `action`:
     * "HOLD", "ADD", "TRIM", "EXIT", or "ROTATE".
   - When suggesting EXIT or ROTATE, pick 1–3 candidates from the replacement pool that better fit the Renaissance rubric.
   - Keep plans self-funded: assume sells in losers finance buys in higher-quality names.

3) Build three plan flavours:
   - "minimal": only obvious, high-conviction changes (e.g., exit avoid names, small trims).
   - "standard": reasonable diversification and risk clean-up.
   - "maximal": aggressively apply the Renaissance funnel, accepting more turnover (still no leverage).

RULES
-----
- Ground EVERY claim in the provided data (loser inputs + Renaissance context + criteria table + replacement pool).
- If you lack key data, set `needs_more_data=true` and say exactly what is missing.
- If a stock is in the avoid list, treat it as a **hard negative prior** and explain why (avoid_category + avoid_reason).
- If a stock is ACE/KING, treat it as a **quality prior**; consider trimming rather than exiting unless the position is extremely large or breaks diversification rules.
- Use the screening criteria rubric to justify recommendations. Whenever possible, reference specific criteria IDs or titles.
- NEVER recommend options, margin, or shorting. NEVER guarantee outcomes.

OUTPUT FORMAT
-------------
Return ONLY valid JSON with this shape (no prose, no markdown):
{{
  "criteria_context": string,
  "summary": {{
    "health_score": number,                     // 0–100 current portfolio health score
    "projected_health_score": number,           // 0–100 PROJECTED health score after plans are executed
    "health_reasons": [string],                 // bullets explaining the score
    "portfolio_diagnostics": {{
      "total_losers_value": number,             // sum of losers market_value
      "avoid_weight_estimate_pct": number,      // approximate % of losers value in avoid names
      "investable_weight_estimate_pct": number, // approximate % of losers value in ACE/KING
      "concentration_notes": [string]
    }},
    "plans": {{
      "minimal": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }},
      "standard": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }},
      "maximal": {{ "actions": [ {{ "symbol": string, "name": string, "action": string, "rationale": string, "current_weight_pct": number, "target_weight_pct": number }} ] }}
    }}
  }},
  "losers": [
    {{
      "symbol": string,
      "name": string,
      "renaissance_tier": string | null,
      "avoid_category": string | null,
      "criteria_flags": [string],
      "needs_more_data": boolean,
      "likely_driver": "fundamental" | "sentiment" | "macro_rates" | "idiosyncratic" | "unknown",
      "confidence": number,
      "action": "hold" | "add" | "trim" | "exit" | "rotate",
      "rationale": string,
      "replacement_candidates": [{{ "ticker": string, "tier": string, "why": string }}],
      "current_weight_pct": number | null,
      "target_weight_pct": number | null
    }}
  ],
  "portfolio_level_takeaways": [string],
  "analytics": {{
    "health_radar": {{
      "current": {{ "Growth": number, "Moat": number, "Quality": number, "Income": number, "Resilience": number, "Diversification": number }},
      "optimized": {{ "Growth": number, "Moat": number, "Quality": number, "Income": number, "Resilience": number, "Diversification": number }}
    }},
    "sector_shift": [
      {{ "sector": string, "before_pct": number, "after_pct": number }}
    ]
  }}
}}
""".strip()


@router.post("/portfolio/analyze-losers/stream")
async def analyze_portfolio_losers_stream(
    request: AnalyzeLosersRequest,
    raw_request: Request,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Streaming version of portfolio losers analysis with AI reasoning.

    Uses SSE to stream:
    - 'thinking' events: AI reasoning/thought summaries
    - 'chunk' events: Partial response text
    - 'complete' events: Final parsed JSON result
    - 'error' events: Error messages

    **Disconnection Handling (Production-Grade)**:
    - Layer 1: sse_starlette ping every 15s detects dead connections (app crash, force-close)
    - Layer 2: asyncio.timeout(120) hard ceiling prevents runaway LLM calls
    - Layer 3: backend heartbeats every 3-5s while waiting for model output
    - Layer 4: raw_request.is_disconnected() checked per-chunk for fast cleanup
    """
    if token_data["user_id"] != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    async def generate():
        HARD_TIMEOUT_SECONDS = DEFAULT_STREAM_TIMEOUT_SECONDS
        stream = CanonicalSSEStream("portfolio_optimize")

        try:
            async with asyncio.timeout(HARD_TIMEOUT_SECONDS):
                # Stage 1: Building context
                yield stream.event(
                    "stage",
                    {"stage": "analyzing", "message": "Analyzing portfolio positions..."},
                )

                (
                    losers_filtered,
                    criteria_context,
                    criteria_rows,
                    replacement_pool,
                    per_loser_context,
                    optimize_from_losers,
                    total_mv,
                ) = await _build_optimization_context(request)

                portfolio_snapshot = {
                    "threshold_pct": request.threshold_pct,
                    "max_positions": request.max_positions,
                    "mode": "losers" if optimize_from_losers else "full_portfolio",
                    "total_positions_market_value": total_mv,
                    "positions": per_loser_context,
                }

                prompt = _build_optimization_prompt(
                    criteria_context, criteria_rows, replacement_pool, portfolio_snapshot
                )

                # Stage 2: LLM reasoning
                yield stream.event(
                    "stage",
                    {"stage": "thinking", "message": "AI reasoning about portfolio health..."},
                )

                from google import genai
                from google.genai import types as genai_types
                from google.genai.types import HttpOptions

                from hushh_mcp.constants import GEMINI_MODEL

                client = genai.Client(http_options=HttpOptions(api_version="v1"))
                model_to_use = GEMINI_MODEL
                logger.info(f"Optimize Portfolio Stream: Using Vertex AI with model {model_to_use}")

                # Configure for deterministic JSON reliability.
                config = genai_types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "summary": {"type": "OBJECT"},
                            "losers": {"type": "ARRAY"},
                            "portfolio_level_takeaways": {"type": "ARRAY"},
                            "analytics": {"type": "OBJECT"},
                        },
                        "required": ["summary", "losers", "portfolio_level_takeaways"],
                    },
                    thinking_config=genai_types.ThinkingConfig(
                        include_thoughts=True,
                        thinking_level=genai_types.ThinkingLevel.MEDIUM,
                    ),
                )

                # Stream the response
                full_response = ""
                thought_count = 0
                chunk_count = 0
                stream_started_at = asyncio.get_running_loop().time()

                # Get the stream object first (must await the coroutine)
                gen_stream = await client.aio.models.generate_content_stream(
                    model=model_to_use,
                    contents=prompt,
                    config=config,
                )

                client_disconnected = False

                # Then iterate over the stream with heartbeat-safe polling
                stream_iter = gen_stream.__aiter__()
                while True:
                    # Check if client disconnected
                    if await raw_request.is_disconnected():
                        logger.info(
                            "[Losers Analysis] Client disconnected, stopping streaming — saving compute"
                        )
                        client_disconnected = True
                        break

                    try:
                        chunk = await asyncio.wait_for(
                            stream_iter.__anext__(),
                            timeout=HEARTBEAT_INTERVAL_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        elapsed = int(asyncio.get_running_loop().time() - stream_started_at)
                        yield stream.event(
                            "stage",
                            {
                                "stage": "thinking",
                                "message": "Still analyzing portfolio optimization options...",
                                "heartbeat": True,
                                "elapsed_seconds": elapsed,
                                "chunk_count": chunk_count,
                                "total_chars": len(full_response),
                            },
                        )
                        continue
                    except StopAsyncIteration:
                        break

                    # Check for thought summaries (Gemini thinking mode)
                    if hasattr(chunk, "candidates") and chunk.candidates:
                        for candidate in chunk.candidates:
                            if hasattr(candidate, "content") and candidate.content:
                                for part in candidate.content.parts:
                                    # Check for thought content
                                    if hasattr(part, "thought") and part.thought:
                                        thought_count += 1
                                        yield stream.event(
                                            "thinking",
                                            {"thought": part.text, "count": thought_count},
                                        )
                                    # Regular text content
                                    elif hasattr(part, "text") and part.text:
                                        chunk_count += 1
                                        full_response += part.text
                                        yield stream.event(
                                            "chunk",
                                            {"text": part.text, "chunk_count": chunk_count},
                                        )
                    elif getattr(chunk, "text", None):
                        chunk_count += 1
                        full_response += str(chunk.text)
                        yield stream.event(
                            "chunk",
                            {"text": str(chunk.text), "chunk_count": chunk_count},
                        )

                # Skip all post-processing if client disconnected — no point parsing for nobody
                if client_disconnected:
                    logger.info(
                        "[Losers Analysis] Skipping post-processing, client gone — LLM compute saved"
                    )
                    return

                # Stage 3: Extracting results
                yield stream.event(
                    "stage",
                    {
                        "stage": "extracting",
                        "message": "Extracting optimization recommendations...",
                    },
                )

                # Parse the final JSON
                try:
                    payload, diagnostics = parse_json_with_single_repair(
                        full_response,
                        required_keys={"summary", "losers", "portfolio_level_takeaways"},
                    )
                    payload.setdefault("criteria_context", criteria_context)
                    payload["parse_report"] = {
                        "repair_applied": diagnostics.get("repair_applied", False),
                        "repair_actions": diagnostics.get("repair_actions", []),
                    }

                    yield stream.event("complete", payload, terminal=True)
                except Exception as parse_error:
                    logger.error(f"Failed to parse LLM response: {parse_error}")
                    yield stream.event(
                        "error",
                        {
                            "code": "OPTIMIZE_PARSE_FAILED",
                            "message": "Failed to parse AI response after deterministic repair",
                            "diagnostics": {
                                "response_chars": len(full_response),
                                "chunk_count": chunk_count,
                            },
                        },
                        terminal=True,
                    )

            # end of asyncio.timeout context

        except asyncio.TimeoutError:
            logger.warning(
                f"[Losers Analysis] Hard timeout ({HARD_TIMEOUT_SECONDS}s) reached, stopping LLM"
            )
            yield stream.event(
                "error",
                {
                    "code": "OPTIMIZE_TIMEOUT",
                    "message": f"Analysis timed out after {HARD_TIMEOUT_SECONDS}s. Please try again.",
                },
                terminal=True,
            )
        except HTTPException as http_err:
            detail = (
                http_err.detail
                if isinstance(http_err.detail, dict)
                else {"message": http_err.detail}
            )
            yield stream.event(
                "error",
                {"code": "OPTIMIZE_HTTP_ERROR", **detail},
                terminal=True,
            )
        except Exception as e:
            logger.error(f"Streaming losers analysis failed: {e}")
            yield stream.event(
                "error",
                {"code": "OPTIMIZE_STREAM_FAILED", "message": str(e)},
                terminal=True,
            )

    return EventSourceResponse(
        generate(),
        ping=15,  # Send ping every 15s — detects dead connections (app crash, force-close, network drop)
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
