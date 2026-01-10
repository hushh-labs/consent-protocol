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

from db.connection import get_pool

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
    pool = await get_pool()
    
    # Normalize search term
    name_normalized = re.sub(r'\s+', '', name.lower())
    
    query = """
        SELECT 
            id, name, firm, title, investor_type, aum_billions, investment_style,
            similarity(name, $1) as similarity_score
        FROM investor_profiles
        WHERE 
            name ILIKE $2
            OR name % $1
            OR name_normalized ILIKE $3
        ORDER BY similarity_score DESC, aum_billions DESC NULLS LAST
        LIMIT $4
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, name, f"%{name}%", f"%{name_normalized}%", limit)
        
        results = []
        for row in rows:
            results.append({
                "id": row["id"],
                "name": row["name"],
                "firm": row["firm"],
                "title": row["title"],
                "investor_type": row["investor_type"],
                "aum_billions": float(row["aum_billions"]) if row["aum_billions"] else None,
                "investment_style": row["investment_style"],
                "similarity_score": round(float(row["similarity_score"]), 3) if row["similarity_score"] else 0
            })
        
        logger.info(f"🔍 Search '{name}' returned {len(results)} results")
        return results


@router.get("/{investor_id}", response_model=InvestorProfile)
async def get_investor(investor_id: int):
    """
    Get full investor profile by ID.
    
    Returns complete public profile including holdings, quotes, biography.
    Used after user selects from search results to show full preview.
    """
    pool = await get_pool()
    
    query = """
        SELECT * FROM investor_profiles WHERE id = $1
    """
    
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, investor_id)
            
            if not row:
                raise HTTPException(status_code=404, detail="Investor not found")
            
            logger.info(f"📥 Retrieved investor {investor_id}: {row['name']}")
            
            return {
                "id": row["id"],
                "name": row["name"],
                "cik": row.get("cik"),
                "firm": row.get("firm"),
                "title": row.get("title"),
                "investor_type": row.get("investor_type"),
                "photo_url": row.get("photo_url"),
                "aum_billions": float(row["aum_billions"]) if row.get("aum_billions") else None,
                "top_holdings": json.loads(row["top_holdings"]) if row.get("top_holdings") and isinstance(row["top_holdings"], str) else row.get("top_holdings"),
                "sector_exposure": json.loads(row["sector_exposure"]) if row.get("sector_exposure") and isinstance(row["sector_exposure"], str) else row.get("sector_exposure"),
                "investment_style": row.get("investment_style"),
                "risk_tolerance": row.get("risk_tolerance"),
                "time_horizon": row.get("time_horizon"),
                "portfolio_turnover": row.get("portfolio_turnover"),
                "recent_buys": row.get("recent_buys"),
                "recent_sells": row.get("recent_sells"),
                "public_quotes": json.loads(row["public_quotes"]) if row.get("public_quotes") and isinstance(row["public_quotes"], str) else row.get("public_quotes"),
                "biography": row.get("biography"),
                "education": row.get("education"),
                "board_memberships": row.get("board_memberships"),
                "peer_investors": row.get("peer_investors"),
                "is_insider": row.get("is_insider") if row.get("is_insider") is not None else False,
                "insider_company_ticker": row.get("insider_company_ticker")
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching investor {investor_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cik/{cik}", response_model=InvestorProfile)
async def get_investor_by_cik(cik: str):
    """Get investor profile by SEC CIK number."""
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM investor_profiles WHERE cik = $1", cik)
        
        if not row:
            raise HTTPException(status_code=404, detail=f"Investor with CIK {cik} not found")
        
        # Same return as get_investor
        return {
            "id": row["id"],
            "name": row["name"],
            "cik": row["cik"],
            "firm": row["firm"],
            "title": row["title"],
            "investor_type": row["investor_type"],
            "photo_url": row["photo_url"],
            "aum_billions": float(row["aum_billions"]) if row["aum_billions"] else None,
            "top_holdings": json.loads(row["top_holdings"]) if row["top_holdings"] and isinstance(row["top_holdings"], str) else row.get("top_holdings"),
            "sector_exposure": json.loads(row["sector_exposure"]) if row["sector_exposure"] and isinstance(row["sector_exposure"], str) else row.get("sector_exposure"),
            "investment_style": row["investment_style"],
            "risk_tolerance": row["risk_tolerance"],
            "time_horizon": row["time_horizon"],
            "portfolio_turnover": row["portfolio_turnover"],
            "recent_buys": row["recent_buys"],
            "recent_sells": row["recent_sells"],
            "public_quotes": json.loads(row["public_quotes"]) if row["public_quotes"] and isinstance(row["public_quotes"], str) else row.get("public_quotes"),
            "biography": row["biography"],
            "education": row["education"],
            "board_memberships": row["board_memberships"],
            "peer_investors": row["peer_investors"],
            "is_insider": row["is_insider"] if row["is_insider"] is not None else False,
            "insider_company_ticker": row["insider_company_ticker"]
        }


# ============================================================================
# Admin Endpoints (for data ingestion)
# ============================================================================

@router.post("/", status_code=201)
async def create_investor(investor: InvestorCreateRequest):
    """
    Create or update an investor profile.
    
    Admin endpoint for data ingestion from SEC EDGAR, etc.
    """
    pool = await get_pool()
    
    # Normalize name for search
    name_normalized = re.sub(r'\s+', '', investor.name.lower())
    
    async with pool.acquire() as conn:
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
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM investor_profiles")
        by_type = await conn.fetch("""
            SELECT investor_type, COUNT(*) as count 
            FROM investor_profiles 
            WHERE investor_type IS NOT NULL
            GROUP BY investor_type
        """)
        
        return {
            "total_profiles": total,
            "by_type": {row["investor_type"]: row["count"] for row in by_type}
        }
