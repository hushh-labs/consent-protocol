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
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.middleware import require_vault_owner_token
from hushh_mcp.services.portfolio_import_service import (
    ImportResult,
    get_portfolio_import_service,
)
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()


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
        logger.warning(
            f"User ID mismatch: token={token_data['user_id']}, request={user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match token"
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match token"
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
    Uses Gemini 2.5 Flash thinking mode for visible AI reasoning.
    
    **Event Types**:
    - `stage`: Current processing stage (uploading, analyzing, thinking, extracting, parsing, complete)
    - `thought`: AI reasoning/thinking summary (visible to user)
    - `text`: Streamed text chunk from Gemini (JSON extraction)
    - `progress`: Character count and chunk count
    - `complete`: Final parsed portfolio data
    - `error`: Error message if parsing fails
    
    **Authentication**: Requires valid VAULT_OWNER token.
    
    **Disconnection Optimization**: 
    - Client disconnects → event.set() → LLM stops processing
    """
    # Verify user_id matches token
    if token_data["user_id"] != user_id:
        logger.warning(
            f"User ID mismatch: token={token_data['user_id']}, request={user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match token"
        )
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Read file content
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Create disconnection event to stop streaming when client disconnects
    disconnection_event = asyncio.Event()
    
    async def event_generator():
        """Generate SSE events for streaming portfolio parsing with Gemini thinking."""
        import base64

        from google import genai
        from google.genai import types
        from google.genai.types import HttpOptions

        from hushh_mcp.constants import GEMINI_MODEL
        
        thinking_enabled = True  # Flag to track if thinking is available
        
        try:
            # Stage 1: Uploading
            yield f"data: {json.dumps({'stage': 'uploading', 'message': 'Processing uploaded file...'})}\n\n"
            await asyncio.sleep(0.1)  # Small delay for UI feedback
            
            # SDK auto-configures from GOOGLE_API_KEY and GOOGLE_GENAI_USE_VERTEXAI env vars
            client = genai.Client(http_options=HttpOptions(api_version="v1"))
            model_to_use = GEMINI_MODEL
            logger.info(f"SSE: Using Vertex AI with model {model_to_use}")
            
            # Stage 2: Analyzing
            yield f"data: {json.dumps({'stage': 'analyzing', 'message': 'AI analyzing document...'})}\n\n"
            
            # Encode PDF as base64
            pdf_base64 = base64.b64encode(content).decode('utf-8')
            
            # Build prompt for comprehensive forensic extraction
            prompt = """Act as a forensic document parser. Your task is to extract every single piece of information from this financial statement into a structured JSON format.

### INSTRUCTIONS:
1. DO NOT SUMMARIZE. Extract all text, numbers, and dates verbatim.
2. CAPTURE ALL TABLES: If a table spans multiple pages, merge the rows into a single list in the JSON.
3. IGNORE LAYOUT: Do not provide coordinates, but preserve the logical grouping of data.
4. HANDLE NULLS: If a field is blank or "N/A", use null. Do not hallucinate values.
5. DISCLAIMERS & FOOTNOTES: Extract the full text of all legal messages, footnotes, and fine print.
6. Parse negative numbers correctly: (1,234.56) means -1234.56
7. Return ONLY valid JSON, no explanation or markdown.

### JSON STRUCTURE REQUIREMENTS:
Extract data into the following nested objects:

{
  "account_metadata": {
    "institution_name": "string - e.g., J.P. Morgan or Fidelity",
    "account_holder": "string - Full name and address",
    "account_number": "string - Full number (may be partially masked)",
    "statement_period_start": "string - Start date",
    "statement_period_end": "string - End date",
    "account_type": "string - e.g., Individual TOD, Traditional IRA, 401k"
  },

  "portfolio_summary": {
    "beginning_value": number,
    "ending_value": number,
    "total_change": number,
    "net_deposits_withdrawals": number,
    "investment_gain_loss": number
  },

  "asset_allocation": [
    { "category": "string - e.g., Equities, Bonds, Cash", "market_value": number, "percentage": number }
  ],

  "detailed_holdings": [
    {
      "asset_class": "string - e.g., Equities, Fixed Income, Cash",
      "description": "string - Full security name",
      "symbol_cusip": "string - Ticker symbol or CUSIP",
      "quantity": number,
      "price": number,
      "market_value": number,
      "cost_basis": number,
      "unrealized_gain_loss": number,
      "unrealized_gain_loss_pct": number,
      "acquisition_date": "string or null",
      "estimated_annual_income": number,
      "est_yield": number
    }
  ],

  "activity_and_transactions": [
    {
      "date": "string",
      "transaction_type": "string - e.g., Buy, Sell, Dividend, Reinvest, Transfer",
      "description": "string - Full text description",
      "quantity": number,
      "price": number,
      "amount": number,
      "realized_gain_loss": number or null
    }
  ],

  "cash_management": {
    "checking_activity": [
      { "date": "string", "check_number": "string", "payee": "string", "amount": number }
    ],
    "debit_card_activity": [
      { "date": "string", "merchant": "string", "amount": number }
    ],
    "deposits_and_withdrawals": [
      { "date": "string", "type": "string - ACH, Wire, Transfer", "description": "string", "amount": number }
    ]
  },

  "income_summary": {
    "taxable_dividends": number,
    "qualified_dividends": number,
    "tax_exempt_interest": number,
    "taxable_interest": number,
    "capital_gains_distributions": number,
    "total_income": number,
    "year_to_date_totals": {
      "dividends_ytd": number,
      "interest_ytd": number,
      "capital_gains_ytd": number,
      "total_income_ytd": number
    }
  },

  "realized_gain_loss": {
    "short_term_gain": number,
    "short_term_loss": number,
    "long_term_gain": number,
    "long_term_loss": number,
    "net_short_term": number,
    "net_long_term": number,
    "net_realized": number
  },

  "projections_and_mrd": {
    "estimated_cash_flow": [
      { "month": "string - e.g., Jan 2024", "projected_income": number }
    ],
    "mrd_estimate": {
      "year": number,
      "required_amount": number,
      "amount_taken": number,
      "remaining": number
    }
  },

  "historical_values": [
    { "date": "string - e.g., Mar 2020, Q1 2021", "value": number }
  ],

  "cash_flow": {
    "opening_balance": number,
    "deposits": number,
    "withdrawals": number,
    "dividends_received": number,
    "interest_received": number,
    "trades_proceeds": number,
    "trades_cost": number,
    "fees_paid": number,
    "closing_balance": number
  },

  "ytd_metrics": {
    "net_deposits_ytd": number,
    "withdrawals_ytd": number,
    "income_ytd": number,
    "realized_gain_loss_ytd": number,
    "fees_ytd": number
  },

  "legal_and_disclosures": [
    "string - Full verbatim text of all disclaimers, USA PATRIOT ACT notices, SIPC information, and fine print"
  ],

  "cash_balance": number,
  "total_value": number
}

CRITICAL: Extract ALL holdings and transactions. Return ONLY valid JSON, no explanation or markdown."""
            
            # Create content with PDF
            contents = [
                prompt,
                types.Part(
                    inline_data=types.Blob(
                        mime_type="application/pdf",
                        data=pdf_base64
                    )
                )
            ]
            
            # Configure with thinking enabled for Gemini 3 Flash
            try:
                config = types.GenerateContentConfig(
                    temperature=1,
                    max_output_tokens=32768,
                    thinking_config=types.ThinkingConfig(
                        include_thoughts=True,
                        thinking_level=types.ThinkingLevel.MEDIUM,
                    )
                )
                logger.info("SSE: Thinking mode enabled with level=MEDIUM")
            except Exception as thinking_error:
                # Fallback if thinking config not supported
                logger.warning(f"SSE: Thinking config not supported, falling back: {thinking_error}")
                thinking_enabled = False
                config = types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=32768,
                )
            
            # Stage 3: Thinking/Streaming
            if thinking_enabled:
                yield f"data: {json.dumps({'stage': 'thinking', 'message': 'AI reasoning about document structure...'})}\n\n"
            else:
                yield f"data: {json.dumps({'stage': 'extracting', 'message': 'Extracting financial data...'})}\n\n"
            
            full_response = ""
            chunk_count = 0
            thought_count = 0
            in_extraction_phase = False
            
            # Use official Gemini streaming API with thinking support
            stream = await client.aio.models.generate_content_stream(
                model=model_to_use,
                contents=contents,
                config=config,
            )
            
            async for chunk in stream:
                # Check for disconnection after each chunk
                if await request.is_disconnected():
                    logger.info("[Portfolio Import] Client disconnected, stopping streaming...")
                    return
                
                # Handle chunks with thinking support
                if hasattr(chunk, 'candidates') and chunk.candidates:
                    candidate = chunk.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if not hasattr(part, 'text') or not part.text:
                                continue
                            
                            # Check if this is a thought (reasoning) or actual response
                            is_thought = hasattr(part, 'thought') and part.thought
                            
                            if is_thought:
                                # Stream thought summary to frontend
                                thought_count += 1
                                yield f"data: {json.dumps({'stage': 'thinking', 'thought': part.text, 'thought_count': thought_count, 'is_thought': True})}\n\n"
                            else:
                                # This is the actual JSON response
                                if not in_extraction_phase:
                                    in_extraction_phase = True
                                    yield f"data: {json.dumps({'stage': 'extracting', 'message': 'Extracting structured data...'})}\n\n"
                                
                                full_response += part.text
                                chunk_count += 1
                                
                                # Stream extraction progress
                                yield f"data: {json.dumps({'stage': 'extracting', 'text': part.text, 'total_chars': len(full_response), 'chunk_count': chunk_count, 'is_thought': False})}\n\n"
                else:
                    # Fallback for non-thinking response format
                    if chunk.text:
                        full_response += chunk.text
                        chunk_count += 1
                        yield f"data: {json.dumps({'stage': 'extracting', 'text': chunk.text, 'total_chars': len(full_response), 'chunk_count': chunk_count, 'is_thought': False})}\n\n"
            
            # Final extraction complete
            yield f"data: {json.dumps({'stage': 'extracting', 'text': '', 'total_chars': len(full_response), 'chunk_count': chunk_count, 'thought_count': thought_count, 'streaming_complete': True})}\n\n"
            
            # Stage 4: Parsing
            yield f"data: {json.dumps({'stage': 'parsing', 'message': 'Processing extracted data...'})}\n\n"
            
            # Parse JSON from response
            try:
                # Clean up response
                json_text = full_response.strip()
                if json_text.startswith("```json"):
                    json_text = json_text[7:]
                if json_text.startswith("```"):
                    json_text = json_text[3:]
                if json_text.endswith("```"):
                    json_text = json_text[:-3]
                json_text = json_text.strip()
                
                parsed_data = json.loads(json_text)
                
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
                    "beginning_value": portfolio_summary.get("beginning_value"),
                    "ending_value": portfolio_summary.get("ending_value"),
                    "change_in_value": portfolio_summary.get("total_change"),
                    "cash_balance": parsed_data.get("cash_balance", 0),
                    "net_deposits_withdrawals": portfolio_summary.get("net_deposits_withdrawals"),
                    "investment_gain_loss": portfolio_summary.get("investment_gain_loss"),
                }
                
                detailed_holdings = parsed_data.get("detailed_holdings", [])
                holdings = []
                for h in detailed_holdings:
                    holding = {
                        "symbol": h.get("symbol_cusip", h.get("symbol", "")),
                        "name": h.get("description", h.get("name", "Unknown")),
                        "quantity": h.get("quantity", 0),
                        "price": h.get("price", 0),
                        "price_per_unit": h.get("price", 0),
                        "market_value": h.get("market_value", 0),
                        "cost_basis": h.get("cost_basis"),
                        "unrealized_gain_loss": h.get("unrealized_gain_loss"),
                        "unrealized_gain_loss_pct": h.get("unrealized_gain_loss_pct"),
                        "asset_type": h.get("asset_class"),
                        "acquisition_date": h.get("acquisition_date"),
                        "estimated_annual_income": h.get("estimated_annual_income"),
                        "est_yield": h.get("est_yield"),
                    }
                    holdings.append(holding)
                
                # Calculate total_value if not provided
                total_value = parsed_data.get("total_value", 0)
                if not total_value and account_summary.get("ending_value"):
                    total_value = account_summary["ending_value"]
                if not total_value and holdings:
                    total_value = sum(h.get("market_value", 0) for h in holdings)
                
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
                    "cash_balance": parsed_data.get("cash_balance", 0),
                    "total_value": total_value,
                    "kpis": {
                        "holdings_count": len(holdings),
                        "total_value": total_value,
                    }
                }
                
                logger.info(f"SSE: Transformed portfolio data - {len(holdings)} holdings, total_value={total_value}")
                
                # Stage 5: Complete
                yield f"data: {json.dumps({'stage': 'complete', 'portfolio_data': portfolio_data, 'success': True, 'thought_count': thought_count})}\n\n"
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error: {e}")
                yield f"data: {json.dumps({'stage': 'error', 'message': f'Failed to parse AI response: {str(e)}'})}\n\n"
                
        except Exception as e:
            logger.error(f"SSE streaming error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )