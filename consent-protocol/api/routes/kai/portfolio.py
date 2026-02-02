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

from fastapi import APIRouter, Depends, Form, Header, HTTPException, UploadFile, status
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
    authorization: str = Header(..., description="Bearer token with VAULT_OWNER token"),
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
    
    Note: This endpoint uses manual token validation instead of Depends() due to
    multipart form data handling requirements with file uploads.
    """
    from hushh_mcp.consent.token import validate_token
    from hushh_mcp.constants import ConsentScope
    
    # Manual token validation (can't use Depends with multipart form + file upload)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.removeprefix("Bearer ").strip()
    valid, reason, token_obj = validate_token(token, ConsentScope.VAULT_OWNER)
    
    if not valid or not token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {reason}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify user_id matches token (consent-first: token contains user_id)
    if token_obj.user_id != user_id:
        logger.warning(f"User ID mismatch: token={token_obj.user_id}, request={user_id}")
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
    
    # Get financial attributes from world model
    world_model = get_world_model_service()
    attributes = await world_model.get_domain_attributes(user_id, "financial")
    
    if not attributes:
        return PortfolioSummaryResponse(
            user_id=user_id,
            has_portfolio=False,
        )
    
    # Build summary from attributes
    attr_map = {a.attribute_key: a.ciphertext for a in attributes}
    
    return PortfolioSummaryResponse(
        user_id=user_id,
        has_portfolio="portfolio_imported" in attr_map,
        holdings_count=int(attr_map.get("holdings_count", 0)) if "holdings_count" in attr_map else None,
        portfolio_value_bucket=attr_map.get("portfolio_value_bucket"),
        risk_bucket=attr_map.get("risk_bucket"),
        losers_count=int(attr_map.get("losers_count", 0)) if "losers_count" in attr_map else None,
        winners_count=int(attr_map.get("winners_count", 0)) if "winners_count" in attr_map else None,
        total_gain_loss_pct=float(attr_map.get("total_gain_loss_pct", 0)) if "total_gain_loss_pct" in attr_map else None,
    )


@router.post("/portfolio/import/stream")
async def import_portfolio_stream(
    file: UploadFile,
    user_id: str = Form(..., description="User's ID"),
    authorization: str = Header(..., description="Bearer token with VAULT_OWNER token"),
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
    
    **Example SSE Events**:
    ```
    data: {"stage": "thinking", "thought": "I can see this is a Schwab brokerage statement..."}
    
    data: {"stage": "extracting", "text": "{\n  \"account_info\":", "total_chars": 20}
    
    data: {"stage": "complete", "portfolio_data": {...}}
    ```
    
    **Authentication**: Requires valid VAULT_OWNER token.
    """
    from hushh_mcp.consent.token import validate_token
    from hushh_mcp.constants import ConsentScope
    
    # Manual token validation (can't use Depends with multipart form + file upload)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.removeprefix("Bearer ").strip()
    valid, reason, token_obj = validate_token(token, ConsentScope.VAULT_OWNER)
    
    if not valid or not token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {reason}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify user_id matches token
    if token_obj.user_id != user_id:
        logger.warning(f"User ID mismatch: token={token_obj.user_id}, request={user_id}")
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
    
    filename = file.filename
    
    async def event_generator():
        """Generate SSE events for streaming portfolio parsing with Gemini thinking."""
        import os
        import base64
        from google import genai
        from google.genai import types
        from hushh_mcp.constants import GEMINI_MODEL, GEMINI_MODEL_VERTEX
        
        thinking_enabled = True  # Flag to track if thinking is available
        
        try:
            # Stage 1: Uploading
            yield f"data: {json.dumps({'stage': 'uploading', 'message': 'Processing uploaded file...'})}\n\n"
            await asyncio.sleep(0.1)  # Small delay for UI feedback
            
            # Initialize Gemini client
            api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            model_to_use = GEMINI_MODEL
            
            if api_key and api_key.startswith("AIza"):
                client = genai.Client(api_key=api_key)
                model_to_use = GEMINI_MODEL
                logger.info("SSE: Using Google AI Studio API key")
            else:
                project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
                if not project_id:
                    import subprocess
                    try:
                        result = subprocess.run(
                            ['gcloud', 'config', 'get-value', 'project'],
                            capture_output=True, text=True, timeout=5
                        )
                        if result.returncode == 0 and result.stdout.strip():
                            project_id = result.stdout.strip()
                    except Exception:
                        pass
                
                if not project_id:
                    yield f"data: {json.dumps({'stage': 'error', 'message': 'No GCP project configured'})}\n\n"
                    return
                
                location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
                client = genai.Client(vertexai=True, project=project_id, location=location)
                model_to_use = GEMINI_MODEL_VERTEX
                logger.info(f"SSE: Using Vertex AI with project: {project_id}")
            
            # Stage 2: Analyzing
            yield f"data: {json.dumps({'stage': 'analyzing', 'message': 'AI analyzing document...'})}\n\n"
            
            # Encode PDF as base64
            pdf_base64 = base64.b64encode(content).decode('utf-8')
            
            # Build prompt for comprehensive extraction
            prompt = """You are a financial document parser. Analyze this brokerage statement PDF and extract ALL financial data.

Return a JSON object with these sections (use null for missing values, NOT 0):

{
  "account_info": {
    "holder_name": "string - account holder's full name",
    "account_number": "string - account number",
    "account_type": "string - e.g., Individual, TOD, Joint, IRA, 401k",
    "brokerage": "string - brokerage firm name",
    "statement_period_start": "string - start date",
    "statement_period_end": "string - end date"
  },
  
  "account_summary": {
    "beginning_value": number,
    "ending_value": number,
    "cash_balance": number,
    "equities_value": number,
    "change_in_value": number
  },
  
  "asset_allocation": {
    "cash_pct": number (as percentage, e.g., 54.4 for 54.4%),
    "cash_value": number,
    "equities_pct": number,
    "equities_value": number,
    "bonds_pct": number,
    "bonds_value": number
  },
  
  "holdings": [
    {
      "symbol": "string - ticker symbol",
      "name": "string - security name",
      "quantity": number,
      "price": number - current price per share,
      "market_value": number - total current value,
      "cost_basis": number - total cost,
      "unrealized_gain_loss": number (negative for losses),
      "unrealized_gain_loss_pct": number,
      "asset_type": "string - stock, etf, bond, mutual_fund, cash"
    }
  ],
  
  "income_summary": {
    "dividends_taxable": number,
    "interest_income": number,
    "total_income": number
  },
  
  "realized_gain_loss": {
    "short_term_gain": number,
    "long_term_gain": number,
    "net_realized": number
  },
  
  "cash_balance": number - total cash/sweep balance,
  "total_value": number - total account value
}

CRITICAL: Extract ALL holdings. Return ONLY valid JSON, no explanation or markdown."""
            
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
            
            # Configure with thinking enabled for Gemini 2.5 Flash
            # This allows us to stream thought summaries to the user
            try:
                config = types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=32768,
                    thinking_config=types.ThinkingConfig(
                        include_thoughts=True,
                        thinking_budget=8192,  # Allow substantial reasoning for complex documents
                    )
                )
                logger.info("SSE: Thinking mode enabled with budget=8192")
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
                
                # Build portfolio_data structure for frontend
                portfolio_data = {
                    "account_info": parsed_data.get("account_info"),
                    "account_summary": parsed_data.get("account_summary"),
                    "asset_allocation": parsed_data.get("asset_allocation"),
                    "holdings": parsed_data.get("holdings", []),
                    "income_summary": parsed_data.get("income_summary"),
                    "realized_gain_loss": parsed_data.get("realized_gain_loss"),
                    "cash_balance": parsed_data.get("cash_balance", 0),
                    "total_value": parsed_data.get("total_value", 0),
                    "kpis": {
                        "holdings_count": len(parsed_data.get("holdings", [])),
                        "total_value": parsed_data.get("total_value", 0),
                    }
                }
                
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
