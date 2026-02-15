# consent-protocol/api/routes/kai/portfolio.py
"""
Kai Portfolio API Route - Portfolio import and analysis endpoints.

Handles:
- File upload (CSV/PDF) for brokerage statements
- Portfolio summary retrieval
- KPI derivation and world model integration
- SSE streaming for real-time parsing progress

Authentication:
- All endpoints require VAULT_OWNER token (consent-first architecture)
- Token contains user_id, proving both identity and consent
- Firebase is only used for bootstrap (issuing VAULT_OWNER token)
"""

import asyncio
import logging
import math
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.middleware import require_vault_owner_token
from api.routes.kai._streaming import (
    DEFAULT_STREAM_TIMEOUT_SECONDS,
    HEARTBEAT_INTERVAL_SECONDS,
    CanonicalSSEStream,
    parse_json_with_single_repair,
)
from hushh_mcp.services.portfolio_import_service import (
    ImportResult,
    get_portfolio_import_service,
)
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()

_NUMERIC_STRIP_RE = re.compile(r"[$,\s]")


def _coerce_optional_number(value: Any) -> Optional[float]:
    """Parse currency-like values to float; return None for blanks/invalid numbers."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if math.isfinite(num) else None

    text = str(value).strip()
    if not text or text.lower() in {"n/a", "na", "null", "none", "--", "-"}:
        return None

    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    text = _NUMERIC_STRIP_RE.sub("", text).replace("%", "")
    if negative:
        text = f"-{text}"

    try:
        num = float(text)
        return num if math.isfinite(num) else None
    except ValueError:
        return None


def _reconcile_holding_numeric_fields(
    holding: dict[str, Any], tolerance: float = 0.10
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply deterministic market-value-first reconciliation for holding numeric fields."""
    normalized = dict(holding)
    reconciled_fields: list[str] = []
    mismatch_detected = False

    qty = _coerce_optional_number(normalized.get("quantity"))
    price = _coerce_optional_number(normalized.get("price"))
    market_value = _coerce_optional_number(normalized.get("market_value"))
    has_qty = qty is not None and qty != 0.0

    # Fill missing market value when quantity and price are available.
    if market_value is None and has_qty and price is not None:
        qty_value = qty if qty is not None else 0.0
        market_value = qty_value * price
        reconciled_fields.append("market_value")

    # Market value is authoritative: derive/recompute price when possible.
    if has_qty and market_value is not None:
        qty_value = qty if qty is not None else 1.0
        derived_price = market_value / qty_value
        if price is None:
            price = derived_price
            reconciled_fields.append("price")
        elif derived_price != 0:
            rel_delta = abs(price - derived_price) / abs(derived_price)
            if rel_delta > tolerance:
                mismatch_detected = True
                price = derived_price
                reconciled_fields.append("price")

    if qty is not None and price is not None and market_value is not None and market_value != 0:
        expected_market_value = qty * price
        rel_delta = abs(expected_market_value - market_value) / abs(market_value)
        if rel_delta > tolerance:
            mismatch_detected = True

    normalized["quantity"] = qty
    normalized["price"] = price
    normalized["price_per_unit"] = price
    normalized["market_value"] = market_value
    normalized["cost_basis"] = _coerce_optional_number(normalized.get("cost_basis"))
    normalized["unrealized_gain_loss"] = _coerce_optional_number(
        normalized.get("unrealized_gain_loss")
    )
    normalized["unrealized_gain_loss_pct"] = _coerce_optional_number(
        normalized.get("unrealized_gain_loss_pct")
    )
    normalized["estimated_annual_income"] = _coerce_optional_number(
        normalized.get("estimated_annual_income")
    )
    normalized["est_yield"] = _coerce_optional_number(normalized.get("est_yield"))

    return normalized, {
        "reconciled_fields": sorted(set(reconciled_fields)),
        "mismatch_detected": mismatch_detected,
    }


class PortfolioImportResponse(BaseModel):
    """Response from portfolio import endpoint."""

    success: bool
    holdings_count: int = 0
    total_value: float = 0.0
    losers: list[dict] = Field(default_factory=list)
    winners: list[dict] = Field(default_factory=list)
    kpis_stored: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    source: str = "unknown"
    # Comprehensive financial data (LLM-extracted)
    portfolio_data: Optional[dict] = None
    account_info: Optional[dict] = None
    account_summary: Optional[dict] = None
    asset_allocation: Optional[dict] = None
    income_summary: Optional[dict] = None
    realized_gain_loss: Optional[dict] = None
    transactions: Optional[list] = None
    cash_balance: float = 0.0


class PortfolioSummaryResponse(BaseModel):
    """Response for portfolio summary endpoint."""

    user_id: str
    has_portfolio: bool
    holdings_count: Optional[int] = None
    portfolio_value_bucket: Optional[str] = None
    risk_bucket: Optional[str] = None
    losers_count: Optional[int] = None
    winners_count: Optional[int] = None
    total_gain_loss_pct: Optional[float] = None


@router.post("/portfolio/import", response_model=PortfolioImportResponse)
async def import_portfolio(
    file: UploadFile,
    user_id: str = Form(..., description="User's ID"),
    token_data: dict = Depends(require_vault_owner_token),
) -> PortfolioImportResponse:
    """
    Import a brokerage statement and analyze the portfolio.

    Accepts CSV or PDF files from major brokerages:
    - Charles Schwab
    - Fidelity
    - Robinhood
    - Generic CSV format

    **Process**:
    1. Parse the file to extract holdings
    2. Derive KPIs (risk bucket, sector allocation, etc.)
    3. Store KPIs in user's world model
    4. Return summary with losers and winners

    **Authentication**: Requires valid VAULT_OWNER token.
    The token proves both identity (user_id) and consent (vault unlocked).

    **Example Response**:
    ```json
    {
        "success": true,
        "holdings_count": 15,
        "total_value": 125000.00,
        "losers": [
            {"symbol": "NFLX", "name": "Netflix", "gain_loss_pct": -15.5, "gain_loss": -2500.00}
        ],
        "winners": [
            {"symbol": "NVDA", "name": "NVIDIA", "gain_loss_pct": 45.2, "gain_loss": 8500.00}
        ],
        "kpis_stored": ["holdings_count", "risk_bucket", "sector_allocation"],
        "source": "schwab"
    }
    ```
    """
    # Verify user_id matches token (consent-first: token contains user_id)
    if token_data["user_id"] != user_id:
        logger.warning(f"User ID mismatch: token={token_data['user_id']}, request={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Check file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Import portfolio
    service = get_portfolio_import_service()
    result: ImportResult = await service.import_file(
        user_id=user_id,
        file_content=content,
        filename=file.filename,
    )

    return PortfolioImportResponse(
        success=result.success,
        holdings_count=result.holdings_count,
        total_value=result.total_value,
        losers=result.losers,
        winners=result.winners,
        kpis_stored=result.kpis_stored,
        error=result.error,
        source=result.source,
        # Comprehensive financial data
        portfolio_data=result.portfolio_data,
        account_info=result.account_info,
        account_summary=result.account_summary,
        asset_allocation=result.asset_allocation,
        income_summary=result.income_summary,
        realized_gain_loss=result.realized_gain_loss,
        transactions=result.transactions,
        cash_balance=result.cash_balance,
    )


@router.get("/portfolio/summary/{user_id}", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    user_id: str,
    token_data: dict = Depends(require_vault_owner_token),
) -> PortfolioSummaryResponse:
    """
    Get portfolio summary from world model (without decrypting holdings).

    Returns KPIs derived from the user's imported portfolio.

    **Authentication**: Requires valid VAULT_OWNER token matching user_id.
    """
    # Verify user_id matches token (consent-first: token contains user_id)
    if token_data["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Get portfolio summary from world_model_index_v2 (no decryption)
    world_model = get_world_model_service()
    index = await world_model.get_index_v2(user_id)
    if index is None or "financial" not in index.available_domains:
        return PortfolioSummaryResponse(
            user_id=user_id,
            has_portfolio=False,
        )
    summary = index.domain_summaries.get("financial") or {}
    has_portfolio = summary.get("has_portfolio", False)
    if isinstance(has_portfolio, str):
        has_portfolio = has_portfolio == "true" or has_portfolio == "1"
    holdings_count = summary.get("holdings_count")
    if holdings_count is not None:
        holdings_count = int(holdings_count)
    losers_count = summary.get("losers_count")
    if losers_count is not None:
        losers_count = int(losers_count)
    winners_count = summary.get("winners_count")
    if winners_count is not None:
        winners_count = int(winners_count)
    total_gain_loss_pct = summary.get("total_gain_loss_pct")
    if total_gain_loss_pct is not None:
        total_gain_loss_pct = float(total_gain_loss_pct)
    return PortfolioSummaryResponse(
        user_id=user_id,
        has_portfolio=bool(has_portfolio),
        holdings_count=holdings_count,
        portfolio_value_bucket=summary.get("portfolio_value_bucket"),
        risk_bucket=summary.get("risk_bucket"),
        losers_count=losers_count,
        winners_count=winners_count,
        total_gain_loss_pct=total_gain_loss_pct,
    )


@router.post("/portfolio/import/stream")
async def import_portfolio_stream(
    request: Request,
    file: UploadFile,
    user_id: str = Form(..., description="User's ID"),
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    SSE streaming endpoint for portfolio import with real-time progress.

    Streams Gemini parsing progress as Server-Sent Events (SSE).
    Uses Gemini 3 Flash thinking mode for visible AI reasoning.

    **Event Types (canonical)**:
    - `stage`: Current processing stage + heartbeat metadata
    - `thinking`: Best-effort thought summaries
    - `chunk`: Streamed JSON text chunks from extraction
    - `complete`: Final parsed portfolio payload
    - `error`: Structured terminal error payload

    **Authentication**: Requires valid VAULT_OWNER token.

    **Disconnection Handling (Production-Grade)**:
    - Layer 1: sse_starlette ping every 15s detects dead connections (app crash, force-close)
    - Layer 2: asyncio.timeout(120) hard ceiling prevents runaway LLM calls
    - Layer 3: backend heartbeats every 3-5s while waiting for model output
    - Layer 4: request.is_disconnected() checked per-chunk for fast cleanup
    """
    # Verify user_id matches token
    if token_data["user_id"] != user_id:
        logger.warning(f"User ID mismatch: token={token_data['user_id']}, request={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Read file content
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    async def event_generator():
        """Generate SSE events for streaming portfolio parsing with Gemini thinking."""
        import base64

        HARD_TIMEOUT_SECONDS = DEFAULT_STREAM_TIMEOUT_SECONDS
        stream = CanonicalSSEStream("portfolio_import")

        from google import genai
        from google.genai import types
        from google.genai.types import HttpOptions

        from hushh_mcp.constants import GEMINI_MODEL

        thinking_enabled = True  # Flag to track if thinking is available

        try:
            async with asyncio.timeout(HARD_TIMEOUT_SECONDS):
                # Stage 1: Uploading
                yield stream.event(
                    "stage",
                    {"stage": "uploading", "message": "Processing uploaded file..."},
                )
                await asyncio.sleep(0.1)  # Small delay for UI feedback

                # SDK auto-configures from GOOGLE_API_KEY and GOOGLE_GENAI_USE_VERTEXAI env vars
                client = genai.Client(http_options=HttpOptions(api_version="v1"))
                model_to_use = GEMINI_MODEL
                logger.info(f"SSE: Using Vertex AI with model {model_to_use}")

                # Stage 2: Analyzing
                yield stream.event(
                    "stage",
                    {"stage": "analyzing", "message": "AI analyzing document..."},
                )

                # Encode PDF as base64
                pdf_base64 = base64.b64encode(content).decode("utf-8")

                # Keep extraction schema focused for deterministic, <=120s parse/runtime behavior.
                prompt = """Extract the uploaded brokerage statement into ONE valid JSON object.

Rules:
- Return JSON only. No markdown.
- Use null for missing/unreadable fields.
- Do not invent ticker symbols.
- Preserve numbers exactly from the statement (currency, commas, negatives in parentheses).

Required top-level fields:
{
  "account_metadata": {
    "institution_name": string|null,
    "account_holder": string|null,
    "account_number": string|null,
    "statement_period_start": string|null,
    "statement_period_end": string|null,
    "account_type": string|null
  },
  "portfolio_summary": {
    "beginning_value": number|null,
    "ending_value": number|null,
    "total_change": number|null,
    "net_deposits_withdrawals": number|null,
    "investment_gain_loss": number|null
  },
  "asset_allocation": [
    {"category": string|null, "market_value": number|null, "percentage": number|null}
  ],
  "detailed_holdings": [
    {
      "asset_class": string|null,
      "description": string|null,
      "symbol_cusip": string|null,
      "quantity": number|null,
      "price": number|null,
      "market_value": number|null,
      "cost_basis": number|null,
      "unrealized_gain_loss": number|null,
      "unrealized_gain_loss_pct": number|null,
      "acquisition_date": string|null,
      "estimated_annual_income": number|null,
      "est_yield": number|null
    }
  ],
  "income_summary": object|null,
  "realized_gain_loss": object|null,
  "activity_and_transactions": array|null,
  "cash_balance": number|null,
  "total_value": number|null
}"""

                # Create content with PDF
                contents = [
                    prompt,
                    types.Part(
                        inline_data=types.Blob(mime_type="application/pdf", data=pdf_base64)
                    ),
                ]

                response_schema = {
                    "type": "OBJECT",
                    "properties": {
                        "account_metadata": {"type": "OBJECT"},
                        "portfolio_summary": {"type": "OBJECT"},
                        "asset_allocation": {"type": "ARRAY"},
                        "detailed_holdings": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "description": {"type": "STRING"},
                                    "symbol_cusip": {"type": "STRING"},
                                    "quantity": {"type": "NUMBER"},
                                    "price": {"type": "NUMBER"},
                                    "market_value": {"type": "NUMBER"},
                                },
                            },
                        },
                        "income_summary": {"type": "OBJECT"},
                        "realized_gain_loss": {"type": "OBJECT"},
                        "activity_and_transactions": {"type": "ARRAY"},
                        "cash_balance": {"type": "NUMBER"},
                        "total_value": {"type": "NUMBER"},
                    },
                    "required": ["detailed_holdings"],
                }

                # Configure with thinking enabled for Gemini 3 Flash
                try:
                    config = types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=12288,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        thinking_config=types.ThinkingConfig(
                            include_thoughts=True,
                            thinking_level=types.ThinkingLevel.MEDIUM,
                        ),
                    )
                    logger.info("SSE: Thinking mode enabled with level=MEDIUM")
                except Exception as thinking_error:
                    # Fallback if thinking config not supported
                    logger.warning(
                        f"SSE: Thinking config not supported, falling back: {thinking_error}"
                    )
                    thinking_enabled = False
                    config = types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=12288,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                    )

                # Stage 3: Thinking/Streaming
                if thinking_enabled:
                    yield stream.event(
                        "stage",
                        {
                            "stage": "thinking",
                            "message": "AI reasoning about document structure...",
                        },
                    )
                else:
                    yield stream.event(
                        "stage",
                        {"stage": "extracting", "message": "Extracting financial data..."},
                    )

                full_response = ""
                chunk_count = 0
                thought_count = 0
                in_extraction_phase = False
                stream_started_at = asyncio.get_running_loop().time()

                # Use official Gemini streaming API with thinking support
                gen_stream = await client.aio.models.generate_content_stream(
                    model=model_to_use,
                    contents=contents,
                    config=config,
                )

                client_disconnected = False

                stream_iter = gen_stream.__aiter__()
                while True:
                    # Check for disconnection after each chunk
                    if await request.is_disconnected():
                        logger.info(
                            "[Portfolio Import] Client disconnected, stopping streaming — saving compute"
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
                        heartbeat_stage = (
                            "extracting"
                            if in_extraction_phase
                            else ("thinking" if thinking_enabled else "analyzing")
                        )
                        heartbeat_message = (
                            "Still extracting structured data..."
                            if in_extraction_phase
                            else "Still processing statement..."
                        )
                        yield stream.event(
                            "stage",
                            {
                                "stage": heartbeat_stage,
                                "message": heartbeat_message,
                                "heartbeat": True,
                                "elapsed_seconds": elapsed,
                                "chunk_count": chunk_count,
                                "total_chars": len(full_response),
                            },
                        )
                        continue
                    except StopAsyncIteration:
                        break

                    # Handle chunks with thinking support
                    if hasattr(chunk, "candidates") and chunk.candidates:
                        candidate = chunk.candidates[0]
                        if hasattr(candidate, "content") and candidate.content:
                            for part in candidate.content.parts:
                                if not hasattr(part, "text") or not part.text:
                                    continue

                                # Check if this is a thought (reasoning) or actual response
                                is_thought = hasattr(part, "thought") and part.thought

                                if is_thought:
                                    # Stream thought summary to frontend
                                    thought_count += 1
                                    yield stream.event(
                                        "thinking",
                                        {"thought": part.text, "count": thought_count},
                                    )
                                else:
                                    # This is the actual JSON response
                                    if not in_extraction_phase:
                                        in_extraction_phase = True
                                        yield stream.event(
                                            "stage",
                                            {
                                                "stage": "extracting",
                                                "message": "Extracting structured data...",
                                            },
                                        )

                                    full_response += part.text
                                    chunk_count += 1

                                    # Stream extraction progress
                                    yield stream.event(
                                        "chunk",
                                        {
                                            "text": part.text,
                                            "total_chars": len(full_response),
                                            "chunk_count": chunk_count,
                                        },
                                    )
                    else:
                        # Fallback for non-thinking response format
                        if chunk.text:
                            full_response += chunk.text
                            chunk_count += 1
                            yield stream.event(
                                "chunk",
                                {
                                    "text": chunk.text,
                                    "total_chars": len(full_response),
                                    "chunk_count": chunk_count,
                                },
                            )

                # Skip all post-processing if client disconnected — no point parsing for nobody
                if client_disconnected:
                    logger.info(
                        "[Portfolio Import] Skipping post-processing, client gone — LLM compute saved"
                    )
                    return

                # Final extraction complete
                yield stream.event(
                    "stage",
                    {
                        "stage": "extracting",
                        "message": "Extraction stream complete",
                        "total_chars": len(full_response),
                        "chunk_count": chunk_count,
                        "thought_count": thought_count,
                    },
                )

                # Stage 4: Parsing
                yield stream.event(
                    "stage",
                    {"stage": "parsing", "message": "Processing extracted data..."},
                )

                # Parse JSON from response
                try:
                    parsed_data, parse_diagnostics = parse_json_with_single_repair(
                        full_response,
                        required_keys={"detailed_holdings"},
                    )

                    # Transform Gemini response to match frontend expected structure
                    account_metadata = parsed_data.get("account_metadata", {})
                    account_info = {
                        "holder_name": account_metadata.get("account_holder"),
                        "account_number": account_metadata.get("account_number"),
                        "account_type": account_metadata.get("account_type"),
                        "brokerage_name": account_metadata.get("institution_name"),
                        "statement_period_start": account_metadata.get("statement_period_start"),
                        "statement_period_end": account_metadata.get("statement_period_end"),
                    }

                    portfolio_summary = parsed_data.get("portfolio_summary", {})
                    account_summary = {
                        "beginning_value": _coerce_optional_number(
                            portfolio_summary.get("beginning_value")
                        ),
                        "ending_value": _coerce_optional_number(
                            portfolio_summary.get("ending_value")
                        ),
                        "change_in_value": _coerce_optional_number(
                            portfolio_summary.get("total_change")
                        ),
                        "cash_balance": _coerce_optional_number(parsed_data.get("cash_balance"))
                        or 0.0,
                        "net_deposits_withdrawals": _coerce_optional_number(
                            portfolio_summary.get("net_deposits_withdrawals")
                        ),
                        "investment_gain_loss": _coerce_optional_number(
                            portfolio_summary.get("investment_gain_loss")
                        ),
                    }

                    detailed_holdings = parsed_data.get("detailed_holdings", [])
                    holdings = []
                    for h in detailed_holdings:
                        normalized, reconciliation = _reconcile_holding_numeric_fields(
                            {
                                "symbol": h.get("symbol_cusip", h.get("symbol")),
                                "name": h.get("description", h.get("name", "Unknown")),
                                "quantity": h.get("quantity"),
                                "price": h.get("price"),
                                "price_per_unit": h.get("price"),
                                "market_value": h.get("market_value"),
                                "cost_basis": h.get("cost_basis"),
                                "unrealized_gain_loss": h.get("unrealized_gain_loss"),
                                "unrealized_gain_loss_pct": h.get("unrealized_gain_loss_pct"),
                                "asset_type": h.get("asset_class"),
                                "acquisition_date": h.get("acquisition_date"),
                                "estimated_annual_income": h.get("estimated_annual_income"),
                                "est_yield": h.get("est_yield"),
                            }
                        )
                        if (
                            reconciliation["reconciled_fields"]
                            or reconciliation["mismatch_detected"]
                        ):
                            normalized["reconciliation"] = reconciliation
                        holdings.append(normalized)

                    # ---- Validation pass: reject hallucinated or incomplete entries ----
                    raw_count = len(holdings)
                    dropped_count = 0
                    reconciled_count = 0
                    mismatch_count = 0
                    validated_holdings = []
                    for h in holdings:
                        # Drop entries with no symbol at all
                        if not h.get("symbol"):
                            logger.warning(
                                f"[Portfolio Validation] Dropping holding with no symbol: {h.get('name', 'unnamed')}"
                            )
                            dropped_count += 1
                            continue
                        # Drop entries with all-null financials (nothing useful extracted)
                        if (
                            h.get("quantity") is None
                            and h.get("market_value") is None
                            and h.get("price") is None
                        ):
                            logger.warning(
                                f"[Portfolio Validation] Dropping holding with no financial data: {h['symbol']}"
                            )
                            dropped_count += 1
                            continue

                        reconciliation = h.get("reconciliation")
                        if isinstance(reconciliation, dict):
                            if reconciliation.get("reconciled_fields"):
                                reconciled_count += 1
                            if reconciliation.get("mismatch_detected"):
                                mismatch_count += 1

                        validated_holdings.append(h)
                    holdings = validated_holdings
                    logger.info(
                        f"[Portfolio Validation] Validated {len(holdings)}/{raw_count} holdings"
                    )

                    # Calculate total_value if not provided
                    total_value = _coerce_optional_number(parsed_data.get("total_value")) or 0.0
                    if not total_value and account_summary.get("ending_value"):
                        total_value = account_summary["ending_value"] or 0.0
                    if not total_value and holdings:
                        total_value = sum(
                            _coerce_optional_number(h.get("market_value")) or 0 for h in holdings
                        )

                    quality_report = {
                        "raw": raw_count,
                        "validated": len(holdings),
                        "dropped": dropped_count,
                        "reconciled": reconciled_count,
                        "mismatch_detected": mismatch_count,
                        "parse_repair_applied": parse_diagnostics.get("repair_applied", False),
                        "parse_repair_actions": parse_diagnostics.get("repair_actions", []),
                    }

                    # Build portfolio_data structure for frontend
                    portfolio_data = {
                        "account_info": account_info,
                        "account_summary": account_summary,
                        "asset_allocation": parsed_data.get("asset_allocation"),
                        "holdings": holdings,
                        "income_summary": parsed_data.get("income_summary"),
                        "realized_gain_loss": parsed_data.get("realized_gain_loss"),
                        "cash_flow": parsed_data.get("cash_flow"),
                        "cash_management": parsed_data.get("cash_management"),
                        "projections_and_mrd": parsed_data.get("projections_and_mrd"),
                        "historical_values": parsed_data.get("historical_values"),
                        "ytd_metrics": parsed_data.get("ytd_metrics"),
                        "legal_and_disclosures": parsed_data.get("legal_and_disclosures"),
                        "cash_balance": _coerce_optional_number(parsed_data.get("cash_balance"))
                        or 0.0,
                        "total_value": total_value,
                        "quality_report": quality_report,
                        "kpis": {
                            "holdings_count": len(holdings),
                            "total_value": total_value,
                        },
                    }

                    logger.info(
                        f"SSE: Transformed portfolio data - {len(holdings)} holdings, total_value={total_value}"
                    )

                    # Stage 5: Complete
                    yield stream.event(
                        "complete",
                        {
                            "portfolio_data": portfolio_data,
                            "success": True,
                            "thought_count": thought_count,
                        },
                        terminal=True,
                    )

                except Exception as parse_error:
                    logger.error(f"JSON parse error: {parse_error}")
                    yield stream.event(
                        "error",
                        {
                            "code": "IMPORT_PARSE_FAILED",
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
                f"[Portfolio Import] Hard timeout ({HARD_TIMEOUT_SECONDS}s) reached, stopping LLM"
            )
            yield stream.event(
                "error",
                {
                    "code": "IMPORT_TIMEOUT",
                    "message": (
                        f"Portfolio import timed out after {HARD_TIMEOUT_SECONDS}s. "
                        "Please try again with a smaller file."
                    ),
                },
                terminal=True,
            )
        except Exception as e:
            logger.error(f"SSE streaming error: {e}")
            import traceback

            logger.error(traceback.format_exc())
            yield stream.event(
                "error",
                {"code": "IMPORT_STREAM_FAILED", "message": str(e)},
                terminal=True,
            )

    return EventSourceResponse(
        event_generator(),
        ping=15,  # Send ping every 15s — detects dead connections (app crash, force-close, network drop)
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
