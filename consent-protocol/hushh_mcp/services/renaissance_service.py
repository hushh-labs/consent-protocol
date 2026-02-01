# consent-protocol/hushh_mcp/services/renaissance_service.py
"""
Renaissance Universe Service - Query investable stock universe.

Provides:
- Check if a ticker is in the Renaissance investable universe
- Get tier information for decision-making
- List stocks by tier/sector
"""

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class RenaissanceStock:
    """A stock in the Renaissance investable universe."""
    ticker: str
    company_name: str
    sector: str
    tier: str  # ACE, KING, QUEEN, JACK
    fcf_billions: Optional[float]
    investment_thesis: str
    tier_rank: int


# Tier weights for decision-making
TIER_WEIGHTS = {
    "ACE": 1.0,    # Highest conviction
    "KING": 0.85,  # High conviction
    "QUEEN": 0.70, # Moderate conviction
    "JACK": 0.55,  # Lower conviction but still investable
}

# Tier descriptions for UI
TIER_DESCRIPTIONS = {
    "ACE": "Top-tier: Largest FCF generators with strongest moats",
    "KING": "High-quality: Strong market positions and consistent FCF",
    "QUEEN": "Quality: Solid fundamentals and reliable cash flows",
    "JACK": "Investable: Good companies with smaller but growing FCF",
}


class RenaissanceService:
    """
    Service for querying the Renaissance investable universe.
    
    Used by Kai to:
    1. Check if a stock is investable
    2. Get tier-based conviction weights
    3. Provide investment thesis context
    """
    
    def __init__(self):
        self._db = None
    
    @property
    def db(self):
        if self._db is None:
            from db.db_client import get_db
            self._db = get_db()
        return self._db
    
    async def is_investable(self, ticker: str) -> tuple[bool, Optional[RenaissanceStock]]:
        """
        Check if a ticker is in the Renaissance investable universe.
        
        Returns:
            Tuple of (is_investable, stock_info)
        """
        try:
            response = self.db.table("renaissance_universe").select("*").eq(
                "ticker", ticker.upper()
            ).execute()
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                stock = RenaissanceStock(
                    ticker=row["ticker"],
                    company_name=row["company_name"],
                    sector=row["sector"],
                    tier=row["tier"],
                    fcf_billions=row.get("fcf_billions"),
                    investment_thesis=row.get("investment_thesis", ""),
                    tier_rank=row.get("tier_rank", 0),
                )
                return True, stock
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error checking Renaissance universe: {e}")
            return False, None
    
    async def get_tier_weight(self, ticker: str) -> float:
        """
        Get the conviction weight for a ticker based on its tier.
        
        Returns:
            Weight from 0.0 to 1.0 (0.0 if not in universe)
        """
        is_inv, stock = await self.is_investable(ticker)
        if is_inv and stock:
            return TIER_WEIGHTS.get(stock.tier, 0.0)
        return 0.0
    
    async def get_by_tier(self, tier: str) -> list[RenaissanceStock]:
        """Get all stocks in a specific tier."""
        try:
            response = self.db.table("renaissance_universe").select("*").eq(
                "tier", tier.upper()
            ).order("tier_rank").execute()
            
            return [
                RenaissanceStock(
                    ticker=row["ticker"],
                    company_name=row["company_name"],
                    sector=row["sector"],
                    tier=row["tier"],
                    fcf_billions=row.get("fcf_billions"),
                    investment_thesis=row.get("investment_thesis", ""),
                    tier_rank=row.get("tier_rank", 0),
                )
                for row in response.data
            ]
            
        except Exception as e:
            logger.error(f"Error getting tier {tier}: {e}")
            return []
    
    async def get_by_sector(self, sector: str) -> list[RenaissanceStock]:
        """Get all stocks in a specific sector."""
        try:
            response = self.db.table("renaissance_universe").select("*").ilike(
                "sector", f"%{sector}%"
            ).order("tier").order("tier_rank").execute()
            
            return [
                RenaissanceStock(
                    ticker=row["ticker"],
                    company_name=row["company_name"],
                    sector=row["sector"],
                    tier=row["tier"],
                    fcf_billions=row.get("fcf_billions"),
                    investment_thesis=row.get("investment_thesis", ""),
                    tier_rank=row.get("tier_rank", 0),
                )
                for row in response.data
            ]
            
        except Exception as e:
            logger.error(f"Error getting sector {sector}: {e}")
            return []
    
    async def get_analysis_context(self, ticker: str) -> dict:
        """
        Get Renaissance context for a stock analysis.
        
        Returns dict with:
        - is_investable: bool
        - tier: str or None
        - tier_description: str
        - conviction_weight: float
        - investment_thesis: str
        - fcf_billions: float or None
        - sector_peers: list of tickers in same sector/tier
        """
        is_inv, stock = await self.is_investable(ticker)
        
        if not is_inv:
            return {
                "is_investable": False,
                "tier": None,
                "tier_description": "Not in Renaissance investable universe",
                "conviction_weight": 0.0,
                "investment_thesis": "",
                "fcf_billions": None,
                "sector_peers": [],
                "recommendation_bias": "CAUTION",
            }
        
        # Get sector peers in same or higher tier
        sector_peers = []
        try:
            response = self.db.table("renaissance_universe").select(
                "ticker"
            ).eq("sector", stock.sector).neq("ticker", ticker.upper()).limit(5).execute()
            
            sector_peers = [row["ticker"] for row in response.data]
        except Exception:
            pass
        
        # Determine recommendation bias based on tier
        bias_map = {
            "ACE": "STRONG_BUY",
            "KING": "BUY",
            "QUEEN": "HOLD_TO_BUY",
            "JACK": "HOLD",
        }
        
        return {
            "is_investable": True,
            "ticker": stock.ticker,
            "company_name": stock.company_name,
            "tier": stock.tier,
            "tier_description": TIER_DESCRIPTIONS.get(stock.tier, ""),
            "conviction_weight": TIER_WEIGHTS.get(stock.tier, 0.5),
            "investment_thesis": stock.investment_thesis,
            "fcf_billions": stock.fcf_billions,
            "sector": stock.sector,
            "sector_peers": sector_peers,
            "recommendation_bias": bias_map.get(stock.tier, "NEUTRAL"),
        }


# Singleton instance
_renaissance_service: Optional[RenaissanceService] = None


def get_renaissance_service() -> RenaissanceService:
    """Get singleton RenaissanceService instance."""
    global _renaissance_service
    if _renaissance_service is None:
        _renaissance_service = RenaissanceService()
    return _renaissance_service
