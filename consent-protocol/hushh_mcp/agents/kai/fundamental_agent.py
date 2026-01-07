"""
Agent Kai — Fundamental Agent (AgentNav Compliant)

Analyzes 10-K/10-Q SEC filings and financial fundamentals.
Extended from AgentNav for consent enforcement.

Key Responsibilities:
- Business fundamentals analysis (via operons)
- Financial health assessment
- Long-term viability evaluation
- Competitive positioning review

Future: Attention Marketplace integration for premium data sources.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class FundamentalInsight:
    """Fundamental analysis insight with sources and confidence."""
    summary: str
    key_metrics: Dict[str, Any]
    quant_metrics: Dict[str, Any]
    business_moat: str
    financial_resilience: str
    growth_efficiency: str
    bull_case: str
    bear_case: str
    sources: List[str]
    confidence: float
    recommendation: str  # "buy", "hold", "reduce"


class FundamentalAgent:
    """
    Fundamental Agent - Analyzes company fundamentals.
    
    Lightweight orchestrator that composes operons for:
    - SEC filing retrieval (via fetch_sec_filings operon)
    - Fundamental analysis (via analyze_fundamentals operon)
    - Financial ratio calculations
    
    All consent validation happens in the operons.
    Agent simply orchestrates and formats results.
    """
    
    def __init__(self, processing_mode: str = "hybrid"):
        self.agent_id = "fundamental"
        self.processing_mode = processing_mode
        self.color = "#3b82f6"  # Blue
        
    async def analyze(
        self,
        ticker: str,
        user_id: str,
        consent_token: str,
    ) -> FundamentalInsight:
        """
        Perform fundamental analysis using operons.
        
        This agent is a LIGHTWEIGHT ORCHESTRATOR.
        All business logic and consent validation is in the operons.
        
        Args:
            ticker: Stock ticker symbol (e.g., "AAPL")
            user_id: User ID for audit logging
            consent_token: Consent token (validated by operons)
            
        Returns:
            FundamentalInsight with analysis results
        """
        logger.info(f"[Fundamental] Orchestrating analysis for {ticker}")
        
        # Step 1: Fetch SEC filings (operon validates consent internally)
        from hushh_mcp.operons.kai.fetchers import fetch_sec_filings, fetch_market_data
        
        try:
            sec_filings = await fetch_sec_filings(
                ticker=ticker,
                user_id=user_id,
                consent_token=consent_token
            )
            # We also need market data for context
            market_data = await fetch_market_data(
                ticker=ticker,
                user_id=user_id,
                consent_token=consent_token
            )
        except PermissionError as e:
            logger.error(f"[Fundamental] External data access denied: {e}")
            raise
        
        # Step 2: Gemini Deep Analysis (HYBRID v2)
        from hushh_mcp.config import GOOGLE_API_KEY
        from hushh_mcp.operons.kai.llm import analyze_stock_with_gemini
        from hushh_mcp.operons.kai.calculators import calculate_quant_metrics
        
        quant_metrics = calculate_quant_metrics(sec_filings)
        
        gemini_analysis = None
        if GOOGLE_API_KEY and self.processing_mode == "hybrid":
            try:
                gemini_analysis = await analyze_stock_with_gemini(
                    ticker=ticker,
                    user_id=user_id,
                    consent_token=consent_token,
                    sec_data=sec_filings,
                    market_data=market_data,
                    quant_metrics=quant_metrics
                )
            except Exception as e:
                logger.warning(f"[Fundamental] Gemini analysis failed: {e}. Falling back to deterministic.")

        # Step 3: Traditional Analysis (Fallback or baseline metrics)
        from hushh_mcp.operons.kai.analysis import analyze_fundamentals
        
        analysis = analyze_fundamentals(
            ticker=ticker,
            user_id=user_id,
            sec_filings=sec_filings,
            consent_token=consent_token,
        )
        
        # Step 4: Merge results (Prefer Deep Gemini Report)
        if gemini_analysis and "error" not in gemini_analysis:
            logger.info(f"[Fundamental] Integrating Deep Gemini Report for {ticker}")
            return FundamentalInsight(
                summary=gemini_analysis.get("summary", analysis["summary"]),
                key_metrics=analysis["key_metrics"],
                quant_metrics=quant_metrics,
                business_moat=gemini_analysis.get("business_moat", "No moat analysis available."),
                financial_resilience=gemini_analysis.get("financial_resilience", "No resilience analysis available."),
                growth_efficiency=gemini_analysis.get("growth_efficiency", "No efficiency analysis available."),
                bull_case=gemini_analysis.get("bull_case", "No bull case provided."),
                bear_case=gemini_analysis.get("bear_case", "No bear case provided."),
                confidence=gemini_analysis.get("confidence", analysis["confidence"]),
                recommendation=gemini_analysis.get("recommendation", analysis["recommendation"]),
                sources=self._format_sources(sec_filings) + ["Gemini Senior Analyst Report"],
            )

        # Step 5: Format as FundamentalInsight (Fallback)
        return FundamentalInsight(
            summary=analysis["summary"],
            key_metrics=analysis["key_metrics"],
            quant_metrics=quant_metrics,
            business_moat="N/A (Deterministic Mode)",
            financial_resilience="N/A (Deterministic Mode)",
            growth_efficiency="N/A (Deterministic Mode)",
            bull_case="N/A",
            bear_case="N/A",
            confidence=analysis["confidence"],
            recommendation=analysis["recommendation"],
            sources=self._format_sources(sec_filings),
        )
    
    def _format_sources(self, sec_filings: Dict[str, Any]) -> List[str]:
        """Format SEC filing sources for display."""
        ticker = sec_filings.get("ticker", "N/A")
        filing_date = sec_filings.get("filing_date", "N/A")
        
        return [
            f"{ticker} 10-K Annual Report ({filing_date})",
            "SEC EDGAR Database",
            "Financial statement analysis",
        ]
    

    
    # =========================================================================
    # FUTURE: Attention Marketplace Integration
    # =========================================================================
    
    async def fetch_premium_data(
        self,
        ticker: str,
        data_source: str,
        consent_token: str,
        bid_amount: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        [PLACEHOLDER] Fetch premium data via Attention Marketplace.
        
        In v2+, users can bid for access to premium data sources:
        - Bloomberg Terminal data
        - Proprietary research reports
        - Real-time SEC filing alerts
        - Expert analyst insights
        
        The Attention Marketplace allows Kai to:
        1. Request premium data on user's behalf
        2. Present bid options (cost, quality, speed)
        3. Execute data purchase with user consent
        4. Audit all transactions transparently
        
        Args:
            ticker: Stock ticker
            data_source: Premium source identifier
            consent_token: Validated consent token
            bid_amount: Optional bid amount (USD)
            
        Returns:
            Premium data payload
            
        References:
            - docs/vision/kai/preparation/attention-marketplace.md
            - Adaptive Attention Marketplace (AAM) spec
        """
        logger.info(
            f"[Fundamental] [PLACEHOLDER] Attention Marketplace: "
            f"Would fetch {data_source} for {ticker} (bid: ${bid_amount})"
        )
        
        # TODO: v2+ implementation
        # - Integrate with Attention Marketplace API
        # - Present bid UI to user
        # - Execute transaction with consent
        # - Return premium data
        
        return {
            "status": "not_implemented",
            "message": "Attention Marketplace coming in v2+",
            "data_source": data_source,
            "ticker": ticker,
        }


# Export singleton for use in KaiAgent orchestration
fundamental_agent = FundamentalAgent()
