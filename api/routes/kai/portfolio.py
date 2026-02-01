# consent-protocol/api/routes/kai/portfolio.py
"""
Kai Portfolio API Route - Portfolio import and analysis endpoints.

Handles:
- File upload (CSV/PDF) for brokerage statements
- Portfolio summary retrieval
- KPI derivation and world model integration

Authentication:
- All endpoints require VAULT_OWNER token (consent-first architecture)
- Token contains user_id, proving both identity and consent
- Firebase is only used for bootstrap (issuing VAULT_OWNER token)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Form, Header, HTTPException, UploadFile, status
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
