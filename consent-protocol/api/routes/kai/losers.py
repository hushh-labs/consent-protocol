"""
Kai Losers Analysis API Route

Provides a portfolio-level losers analysis using:
- Renaissance investable universe (tiers + thesis)
- Renaissance avoid list (direct + extended)
- Renaissance screening criteria rubric (criteria-first prompting)

Authentication:
- Requires VAULT_OWNER token (consent-first architecture)
"""

import json
import logging
import re
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.middleware import require_vault_owner_token
from hushh_mcp.services.renaissance_service import get_renaissance_service

logger = logging.getLogger(__name__)

router = APIRouter()


class PortfolioLoser(BaseModel):
    symbol: str = Field(..., description="Ticker symbol")
    name: Optional[str] = None
    gain_loss_pct: Optional[float] = Field(
        None, description="Unrealized P/L percent (negative for losers)"
    )
    gain_loss: Optional[float] = Field(
        None, description="Unrealized P/L amount"
    )
    market_value: Optional[float] = None


class PortfolioHolding(BaseModel):
    """Full-position snapshot for Optimize Portfolio (not only losers)."""

    symbol: str = Field(..., description="Ticker symbol")
    name: Optional[str] = None
    gain_loss_pct: Optional[float] = Field(
        None, description="Unrealized P/L percent"
    )
    gain_loss: Optional[float] = Field(
        None, description="Unrealized P/L amount"
    )
    market_value: Optional[float] = Field(
        None, description="Current market value of the position"
    )
    sector: Optional[str] = Field(
        None, description="Sector or industry label if available"
    )
    asset_type: Optional[str] = Field(
        None, description="High-level asset type (equity, cash, ETF, etc.)"
    )


class AnalyzeLosersRequest(BaseModel):
    user_id: str
    losers: list[PortfolioLoser] = Field(default_factory=list)
    threshold_pct: float = Field(-5.0, description="Only analyze losers at or below this %")
    max_positions: int = Field(10, ge=1, le=50, description="Max number of loser positions to analyze")
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


def _extract_json_object(text: str) -> dict[str, Any]:
    """Extract the first JSON object from a model response."""
    s = text.strip()
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in LLM output")
    return json.loads(s[start : end + 1])


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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")

    losers_in = request.losers or []
    holdings_in = request.holdings or []

    # ------------------------------------------------------------------
    # Build optimization universe:
    # - Prefer explicit losers that meet the threshold.
    # - If none and force_optimize + holdings, fall back to top holdings.
    # ------------------------------------------------------------------
    losers_filtered: list[PortfolioLoser] = []
    for l in losers_in:
        pct = l.gain_loss_pct
        if pct is None or pct <= request.threshold_pct:
            losers_filtered.append(l)
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

    # Build investable replacement candidates by sector (best-effort)
    sectors = {((l.name or "").strip(),) for l in losers_filtered}  # placeholder; sector not reliably provided
    # We primarily give LLM a global pool + per-ticker Renaissance context
    ace_pool = await renaissance.get_by_tier("ACE")
    king_pool = await renaissance.get_by_tier("KING")
    replacement_pool = [
        {"ticker": s.ticker, "tier": s.tier, "sector": s.sector, "thesis": s.investment_thesis}
        for s in (ace_pool[:15] + king_pool[:15])
    ]

    # Per-position Renaissance context (optimization universe)
    total_mv = sum((l.market_value or 0.0) for l in losers_filtered) or 0.0
    per_loser_context: list[dict[str, Any]] = []
    for l in losers_filtered:
        ticker = l.symbol.upper().strip()
        ren_ctx = await renaissance.get_analysis_context(ticker)
        weight_pct = (
            (l.market_value or 0.0) / total_mv * 100.0 if total_mv > 0 else None
        )
        per_loser_context.append(
            {
                "symbol": ticker,
                "name": l.name,
                "gain_loss_pct": l.gain_loss_pct,
                "gain_loss": l.gain_loss,
                "market_value": l.market_value,
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
    "health_score": number,                     // 0–100 overall portfolio health score
    "health_reasons": [string],                 // bullets explaining the score
    "portfolio_diagnostics": {{
      "total_losers_value": number,             // sum of losers market_value
      "avoid_weight_estimate_pct": number,      // approximate % of losers value in avoid names
      "investable_weight_estimate_pct": number, // approximate % of losers value in ACE/KING
      "concentration_notes": [string]
    }},
    "plans": {{
      "minimal": {{ "actions": [ /* PlanAction */ ] }},
      "standard": {{ "actions": [ /* PlanAction */ ] }},
      "maximal": {{ "actions": [ /* PlanAction */ ] }}
    }}
  }},
  "losers": [
    {{
      "symbol": string,
      "renaissance_status": "investable_tier" | "avoid" | "neither",
      "tier": string | null,
      "avoid_category": string | null,
      "criteria_flags": [string],
      "needs_more_data": boolean,
      "likely_driver": "fundamental" | "sentiment" | "macro_rates" | "idiosyncratic" | "unknown",
      "confidence": number,
      "recommended_action": "hold" | "add" | "trim" | "exit" | "rotate",
      "why": string,
      "replacement_candidates": [{{ "ticker": string, "tier": string, "why": string }}],
      "current_weight_estimate_pct": number | null,
      "target_weight_delta": number | null
    }}
  ],
  "portfolio_level_takeaways": [string]
}}
""".strip()

    try:
        config = genai_types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=4096,
        )
        resp = await client.aio.models.generate_content(
            model=model_to_use,
            contents=prompt,
            config=config,
        )
        raw = (resp.text or "").strip()
        payload = _extract_json_object(raw)
    except Exception as e:
        logger.error(f"Losers analysis LLM failed: {e}")
        raise HTTPException(status_code=500, detail="Losers analysis failed")

    # Ensure criteria_context is always present for UI (fallback to rubric)
    payload.setdefault("criteria_context", criteria_context)
    return AnalyzeLosersResponse(**payload)

