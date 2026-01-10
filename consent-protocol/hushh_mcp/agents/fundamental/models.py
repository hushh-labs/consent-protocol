from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class AnalystSignal(str, Enum):
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"

class MarketMetrics(BaseModel):
    """Raw fundamental data fetched from market source."""
    symbol: str
    price: float
    
    # Valuation
    pe_ratio: Optional[float] = None
    peg_ratio: Optional[float] = None
    
    # Growth
    revenue_growth: Optional[float] = None
    
    # Risk
    beta: Optional[float] = None
    
    # Quality
    roe: Optional[float] = None  # Return on Equity
    debt_to_equity: Optional[float] = None
    
    # Discovery
    sector: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None

class ContextualFactor(BaseModel):
    """A specific reason why a stock fits/mismatches the USER profile."""
    factor_name: str = Field(..., description="e.g. Risk Match, Competence Circle")
    score_impact: int = Field(..., description="Numerical impact (-20 to +20)")
    reasoning: str = Field(..., description="Human-readable explanation")
    related_kpi: str = Field(..., description="Which profile field triggered this (e.g. risk_tolerance)")

class AnalysisReport(BaseModel):
    """Final output of the Fundamental Agent."""
    ticker: str
    fit_score: int = Field(..., description="0-100 Score of how well this stock fits the USER")
    signal: AnalystSignal
    
    # Analysis Breakdown
    factors: List[ContextualFactor]
    
    # Summary
    summary: str = Field(..., description="Executive summary of the recommendation")
    
    # Metadata
    market_data: MarketMetrics
