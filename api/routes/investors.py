# api/routes/investors.py
"""
Investor Profiles API Routes (PUBLIC DISCOVERY LAYER)

These endpoints serve publicly available investor data for identity resolution.
Data source: SEC 13F filings, Form 4, public sources

IMPORTANT: This is the PUBLIC layer - no authentication required for search.
The data here is NOT encrypted (it's all from public SEC filings).

Privacy architecture:
- investor_profiles = PUBLIC (SEC filings, read-only)
- user_investor_profiles = PRIVATE (E2E encrypted, consent required)
"""

import logging
import json
import re
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from hushh_mcp.services.investor_db import InvestorDBService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investors", tags=["Investor Profiles (Public)"])


# ============================================================================
# Request/Response Models
# ============================================================================

class InvestorSearchResult(BaseModel):
    id: int
    name: str
    firm: Optional[str]
    title: Optional[str]
    investor_type: Optional[str]
    aum_billions: Optional[float]
    investment_style: Optional[List[str]]
    similarity_score: Optional[float]


class InvestorProfile(BaseModel):
    id: int
    name: str
    cik: Optional[str]
    firm: Optional[str]
    title: Optional[str]
    investor_type: Optional[str]
    photo_url: Optional[str]
    aum_billions: Optional[float]
    top_holdings: Optional[list]
    sector_exposure: Optional[dict]
    investment_style: Optional[List[str]]
    risk_tolerance: Optional[str]
    time_horizon: Optional[str]
    portfolio_turnover: Optional[str]
    recent_buys: Optional[List[str]]
    recent_sells: Optional[List[str]]
    public_quotes: Optional[list]
    biography: Optional[str]
    education: Optional[List[str]]
    board_memberships: Optional[List[str]]
    peer_investors: Optional[List[str]]
    is_insider: Optional[bool] = False
    insider_company_ticker: Optional[str]


class InvestorCreateRequest(BaseModel):
    name: str
    cik: Optional[str] = None
    firm: Optional[str] = None
    title: Optional[str] = None
    investor_type: Optional[str] = None
    aum_billions: Optional[float] = None
    top_holdings: Optional[list] = None
    sector_exposure: Optional[dict] = None
    investment_style: Optional[List[str]] = None
    risk_tolerance: Optional[str] = None
    time_horizon: Optional[str] = None
    portfolio_turnover: Optional[str] = None
    recent_buys: Optional[List[str]] = None
    recent_sells: Optional[List[str]] = None
    public_quotes: Optional[list] = None
    biography: Optional[str] = None
    education: Optional[List[str]] = None
    board_memberships: Optional[List[str]] = None
    peer_investors: Optional[List[str]] = None
    is_insider: bool = False
    insider_company_ticker: Optional[str] = None


# ============================================================================
# Search Endpoints
# ============================================================================

@router.get("/search", response_model=List[InvestorSearchResult])
async def search_investors(
    name: str = Query(..., min_length=2, description="Name to search for"),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Search for investors by name using fuzzy matching.
    
    This is the primary identity resolution endpoint.
    Returns ranked list of potential matches with similarity scores.
    
    Example: /api/investors/search?name=Warren+Buffett
    """
    # Use service layer (no consent required for public investor data)
    service = InvestorDBService()
    results = await service.search_investors(name=name, limit=limit)
    
    logger.info(f"🔍 Search '{name}' returned {len(results)} results")
    return results


@router.get("/{investor_id}", response_model=InvestorProfile)
async def get_investor(investor_id: int):
    """
    Get full investor profile by ID.
    
    Returns complete public profile including holdings, quotes, biography.
    Used after user selects from search results to show full preview.
    """
    # Use service layer (no consent required for public investor data)
    service = InvestorDBService()
    
    try:
        profile = await service.get_investor_by_id(investor_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Investor not found")
        
        logger.info(f"📥 Retrieved investor {investor_id}: {profile['name']}")
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching investor {investor_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cik/{cik}", response_model=InvestorProfile)
async def get_investor_by_cik(cik: str):
    """Get investor profile by SEC CIK number."""
    # Use service layer (no consent required for public investor data)
    service = InvestorDBService()
    profile = await service.get_investor_by_cik(cik)
    
    if not profile:
        raise HTTPException(status_code=404, detail=f"Investor with CIK {cik} not found")
    
    return profile


# ============================================================================
# Admin Endpoints (for data ingestion)
# ============================================================================

@router.post("/", status_code=201)
async def create_investor(investor: InvestorCreateRequest):
    """
    Create or update an investor profile.
    
    Admin endpoint for data ingestion from SEC EDGAR, etc.
    """
    # Use service layer - admin endpoint but use Supabase for consistency
    service = InvestorDBService()
    supabase = service.get_supabase()
    
    # Normalize name for search
    name_normalized = re.sub(r'\s+', '', investor.name.lower())
    
    from datetime import datetime
    now_iso = datetime.now().isoformat()
    
    # Prepare data for Supabase
    data = {
        "name": investor.name,
        "name_normalized": name_normalized,
        "cik": investor.cik,
        "firm": investor.firm,
        "title": investor.title,
        "investor_type": investor.investor_type or "fund_manager",
        "aum_billions": investor.aum_billions,
        "top_holdings": json.dumps(investor.top_holdings) if investor.top_holdings else None,
        "sector_exposure": json.dumps(investor.sector_exposure) if investor.sector_exposure else None,
        "investment_style": investor.investment_style,
        "risk_tolerance": investor.risk_tolerance,
        "time_horizon": investor.time_horizon,
        "portfolio_turnover": investor.portfolio_turnover,
        "recent_buys": investor.recent_buys,
        "recent_sells": investor.recent_sells,
        "public_quotes": json.dumps(investor.public_quotes) if investor.public_quotes else None,
        "biography": investor.biography,
        "education": investor.education,
        "board_memberships": investor.board_memberships,
        "peer_investors": investor.peer_investors,
        "is_insider": investor.is_insider or False,
        "insider_company_ticker": investor.insider_company_ticker,
        "updated_at": now_iso
    }
    
    # Remove None values
    data = {k: v for k, v in data.items() if v is not None}
    
    try:
        # Upsert by CIK if provided
        if investor.cik:
            response = supabase.table("investor_profiles").upsert(
                data,
                on_conflict="cik"
            ).execute()
        else:
            # Insert new (no CIK) - remove cik from data
            data_no_cik = {k: v for k, v in data.items() if k != "cik"}
            response = supabase.table("investor_profiles").insert(data_no_cik).execute()
        
        # Extract ID from response
        if response.data and len(response.data) > 0:
            result = response.data[0].get("id")
            logger.info(f"📈 Created/updated investor profile: {investor.name} (id={result})")
            return {"id": result, "name": investor.name, "status": "created"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create investor profile")
    except Exception as e:
        logger.error(f"Error creating investor: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        # Upsert by CIK if provided, otherwise insert
        if investor.cik:
            query = """
                INSERT INTO investor_profiles (
                    name, name_normalized, cik, firm, title, investor_type,
                    aum_billions, top_holdings, sector_exposure,
                    investment_style, risk_tolerance, time_horizon, portfolio_turnover,
                    recent_buys, recent_sells, public_quotes, biography,
                    education, board_memberships, peer_investors,
                    is_insider, insider_company_ticker, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW()
                )
                ON CONFLICT (cik) DO UPDATE SET
                    name = EXCLUDED.name,
                    name_normalized = EXCLUDED.name_normalized,
                    firm = EXCLUDED.firm,
                    title = EXCLUDED.title,
                    investor_type = EXCLUDED.investor_type,
                    aum_billions = EXCLUDED.aum_billions,
                    top_holdings = EXCLUDED.top_holdings,
                    sector_exposure = EXCLUDED.sector_exposure,
                    investment_style = EXCLUDED.investment_style,
                    risk_tolerance = EXCLUDED.risk_tolerance,
                    time_horizon = EXCLUDED.time_horizon,
                    portfolio_turnover = EXCLUDED.portfolio_turnover,
                    recent_buys = EXCLUDED.recent_buys,
                    recent_sells = EXCLUDED.recent_sells,
                    public_quotes = EXCLUDED.public_quotes,
                    biography = EXCLUDED.biography,
                    education = EXCLUDED.education,
                    board_memberships = EXCLUDED.board_memberships,
                    peer_investors = EXCLUDED.peer_investors,
                    is_insider = EXCLUDED.is_insider,
                    insider_company_ticker = EXCLUDED.insider_company_ticker,
                    updated_at = NOW()
                RETURNING id
            """
        else:
            query = """
                INSERT INTO investor_profiles (
                    name, name_normalized, cik, firm, title, investor_type,
                    aum_billions, top_holdings, sector_exposure,
                    investment_style, risk_tolerance, time_horizon, portfolio_turnover,
                    recent_buys, recent_sells, public_quotes, biography,
                    education, board_memberships, peer_investors,
                    is_insider, insider_company_ticker
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19, $20, $21, $22
                )
                RETURNING id
            """
        
        result = await conn.fetchval(
            query,
            investor.name,
            name_normalized,
            investor.cik,
            investor.firm,
            investor.title,
            investor.investor_type,
            investor.aum_billions,
            json.dumps(investor.top_holdings) if investor.top_holdings else None,
            json.dumps(investor.sector_exposure) if investor.sector_exposure else None,
            investor.investment_style,
            investor.risk_tolerance,
            investor.time_horizon,
            investor.portfolio_turnover,
            investor.recent_buys,
            investor.recent_sells,
            json.dumps(investor.public_quotes) if investor.public_quotes else None,
            investor.biography,
            investor.education,
            investor.board_memberships,
            investor.peer_investors,
            investor.is_insider,
            investor.insider_company_ticker
        )
        
        logger.info(f"📈 Created/updated investor profile: {investor.name} (id={result})")
        
        return {"id": result, "name": investor.name, "status": "created"}


@router.post("/bulk", status_code=201)
async def bulk_create_investors(investors: List[InvestorCreateRequest]):
    """
    Bulk create investor profiles from list.
    
    Used for initial data seeding from JSON file.
    """
    results = []
    for investor in investors:
        result = await create_investor(investor)
        results.append(result)
    
    logger.info(f"📈 Bulk created {len(results)} investor profiles")
    
    return {"created": len(results), "profiles": results}


@router.get("/stats")
async def get_stats():
    """Get statistics about investor profiles."""
    # Use service layer
    service = InvestorDBService()
    stats = await service.get_investor_stats()
    
    return {
        "total_profiles": stats.get("total", 0),
        "by_type": stats.get("by_type", {})
    }
