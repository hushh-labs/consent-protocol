import logging
from typing import Dict, List, Any
from .models import MarketMetrics, AnalysisReport, AnalystSignal, ContextualFactor
from .tools import MarketFetcher

logger = logging.getLogger(__name__)

class FundamentalAgent:
    """
    The Analyst. 
    Combines Market Data with User Context to generate personalized investment signals.
    """
    
    def __init__(self):
        self.fetcher = MarketFetcher()
        
    async def analyze(self, ticker: str, user_profile: Dict[str, Any]) -> AnalysisReport:
        """
        Main entry point.
        ticker: Symbol to analyze (e.g. "NVDA")
        user_profile: Decrypted contents of user_investor_profiles
        """
        # 1. Fetch Market Data
        market_data = self.fetcher.fetch_ticker(ticker)
        if not market_data:
            raise ValueError(f"Could not fetch market data for {ticker}")
            
        # 2. Extract Profile KPIs
        style = user_profile.get("investment_style", []) # e.g. ["Growth", "Tech"]
        risk_tolerance = user_profile.get("risk_tolerance", "Balanced")
        holdings = user_profile.get("top_holdings", []) # e.g. ["AAPL", "MSFT"]
        
        # 3. Calculate Factors
        factors: List[ContextualFactor] = []
        score = 50 # Start neutral
        
        # --- FACTOR 1: STYLE FIT ---
        # Heuristic: Check if user is Growth vs Value
        is_growth_investor = "Growth" in style or "Aggressive" in style
        is_value_investor = "Value" in style or "Conservative" in style
        
        if is_growth_investor:
            if market_data.peg_ratio and market_data.peg_ratio < 1.5:
                factors.append(ContextualFactor(
                    factor_name="Growth at Reasonable Price",
                    score_impact=15,
                    reasoning=f"PEG Ratio {market_data.peg_ratio:.2f} indicates good growth value, matching your Growth style.",
                    related_kpi="investment_style"
                ))
                score += 15
            elif market_data.revenue_growth and market_data.revenue_growth > 0.20:
                factors.append(ContextualFactor(
                    factor_name="High Growth",
                    score_impact=10,
                    reasoning=f"Revenue growth {market_data.revenue_growth:.1%} fits your aggressive profile.",
                    related_kpi="investment_style"
                ))
                score += 10
                
        if is_value_investor:
            if market_data.pe_ratio and market_data.pe_ratio < 20:
                factors.append(ContextualFactor(
                    factor_name="Value Valuation",
                    score_impact=15,
                    reasoning=f"P/E {market_data.pe_ratio:.2f} is within value territory.",
                    related_kpi="investment_style"
                ))
                score += 15
            elif market_data.pe_ratio and market_data.pe_ratio > 40:
                factors.append(ContextualFactor(
                    factor_name="Overvalued",
                    score_impact=-20,
                    reasoning=f"P/E {market_data.pe_ratio:.2f} is too expensive for a Value investor.",
                    related_kpi="investment_style"
                ))
                score -= 20

        # --- FACTOR 2: RISK TOLERANCE ---
        beta = market_data.beta or 1.0
        
        if risk_tolerance == "Low" or risk_tolerance == "Conservative":
            if beta > 1.2:
                factors.append(ContextualFactor(
                    factor_name="High Volatility Risk",
                    score_impact=-15,
                    reasoning=f"Beta {beta:.2f} exceeds your low risk tolerance.",
                    related_kpi="risk_tolerance"
                ))
                score -= 15
        elif risk_tolerance == "High" or risk_tolerance == "Aggressive":
            if beta > 1.5:
                factors.append(ContextualFactor(
                    factor_name="Volatility Play",
                    score_impact=5,
                    reasoning=f"High Beta {beta:.2f} aligns with your tolerance for volatility.",
                    related_kpi="risk_tolerance"
                ))
                score += 5
                
        # --- FACTOR 3: SECTOR / COMPETENCE ---
        # Simple string match for now
        # Check if they own similar stocks (Competence Circle)
        # We don't have full embedding search here yet, so simple check
        
        # 4. Synthesize Signal
        score = max(0, min(100, score)) # Clamp 0-100
        
        signal = AnalystSignal.HOLD
        if score >= 80: signal = AnalystSignal.STRONG_BUY
        elif score >= 60: signal = AnalystSignal.BUY
        elif score <= 20: signal = AnalystSignal.STRONG_SELL
        elif score <= 40: signal = AnalystSignal.SELL
        
        summary = f"Based on your {risk_tolerance} risk profile and {', '.join(style)} style, {ticker} is a {signal.value}. "
        if factors:
            summary += f"Key driver: {factors[0].reasoning}"
            
        return AnalysisReport(
            ticker=ticker,
            fit_score=score,
            signal=signal,
            factors=factors,
            summary=summary,
            market_data=market_data
        )
