"""
Agent Kai — Sentiment Agent (ADK Compliant)

Processes news articles, earnings calls, and market sentiment using reflection summarization.

Key Responsibilities:
- Market momentum analysis
- Short-term catalyst identification
- News sentiment scoring
- Earnings call interpretation
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from hushh_mcp.agents.base_agent import HushhAgent
from hushh_mcp.constants import GEMINI_MODEL

logger = logging.getLogger(__name__)


@dataclass
class SentimentInsight:
    """Sentiment analysis insight."""

    summary: str
    sentiment_score: float  # -1.0 (very bearish) to 1.0 (very bullish)
    key_catalysts: List[str]
    news_highlights: List[Dict[str, str]]
    sources: List[str]
    confidence: float
    recommendation: str  # "bullish", "neutral", "bearish"


class SentimentAgent(HushhAgent):
    """
    Sentiment Agent - Analyzes market sentiment and news.

    ADK-compliant implementation that uses tools with proper consent validation.

    Processes news articles, social media, and earnings transcripts
    to gauge market momentum and identify short-term catalysts.
    """

    def __init__(self, processing_mode: str = "hybrid"):
        self.agent_id = "sentiment"
        self.processing_mode = processing_mode
        self.color = "#8b5cf6"

        # Initialize with proper ADK parameters
        super().__init__(
            name="Sentiment Agent",
            model=GEMINI_MODEL,  # Standardized model
            system_prompt="""
            You are a Sentiment Analyst focused on market momentum, news catalysts, and sentiment analysis.
            Your job is to evaluate recent market events, news, and social sentiment to identify short-term catalysts.
            """,
            required_scopes=["agent.kai.sentiment"],
        )

    async def analyze(
        self,
        ticker: str,
        user_id: str,
        consent_token: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> SentimentInsight:
        """
        Perform sentiment analysis using Gemini + operons.

        Args:
            ticker: Stock ticker symbol (e.g., "AAPL")
            user_id: User ID for audit logging
            consent_token: Consent token for news API access
            context: Optional user context for personalization

        Returns:
            SentimentInsight with analysis results
        """
        logger.info(f"[Sentiment] Orchestrating analysis for {ticker} - user {user_id}")

        # Operon 1: Fetch news articles (with consent check)
        from hushh_mcp.operons.kai.fetchers import fetch_market_news

        try:
            news_articles = await fetch_market_news(ticker, user_id, consent_token)
        except PermissionError as e:
            logger.error(f"[Sentiment] News access denied: {e}")
            raise
        except Exception as e:
            logger.warning(f"[Sentiment] News fetch failed: {e}, using empty list")
            news_articles = []

        # Operon 2: Gemini Deep Sentiment Analysis
        from hushh_mcp.config import GOOGLE_API_KEY
        from hushh_mcp.operons.kai.llm import analyze_sentiment_with_gemini

        gemini_analysis = None
        if GOOGLE_API_KEY and self.processing_mode == "hybrid" and consent_token:
            try:
                gemini_analysis = await analyze_sentiment_with_gemini(
                    ticker=ticker,
                    user_id=user_id,
                    consent_token=consent_token,
                    news_articles=news_articles,
                    user_context=context,
                )
            except Exception as e:
                logger.warning(
                    f"[Sentiment] Gemini analysis failed: {e}. Falling back to deterministic."
                )

        # Use Gemini results if available
        if gemini_analysis and "error" not in gemini_analysis:
            logger.info(f"[Sentiment] Using Gemini analysis for {ticker}")
            return SentimentInsight(
                summary=gemini_analysis.get("summary", f"Sentiment analysis for {ticker}"),
                sentiment_score=gemini_analysis.get("sentiment_score", 0.0),
                key_catalysts=gemini_analysis.get("key_catalysts", []),
                news_highlights=gemini_analysis.get("news_highlights", []),
                sources=gemini_analysis.get("sources", ["Gemini Sentiment Analysis"]),
                confidence=gemini_analysis.get("confidence", 0.5),
                recommendation=gemini_analysis.get("recommendation", "neutral"),
            )

        # Fallback: Deterministic analysis
        logger.info(f"[Sentiment] Using deterministic analysis for {ticker}")
        from hushh_mcp.operons.kai.analysis import analyze_sentiment

        try:
            # Call the operon directly without tools (deterministic)
            analysis = analyze_sentiment(
                ticker=ticker,
                user_id=user_id,
                news_articles=news_articles,
                consent_token=consent_token,
            )

            return SentimentInsight(
                summary=analysis.get("summary", f"Sentiment analysis for {ticker}"),
                sentiment_score=analysis.get("sentiment_score", 0.0),
                key_catalysts=analysis.get("key_catalysts", []),
                news_highlights=analysis.get("news_highlights", []),
                sources=analysis.get("sources", ["Deterministic Analysis"]),
                confidence=analysis.get("confidence", 0.5),
                recommendation=analysis.get("recommendation", "neutral"),
            )
        except Exception as e:
            logger.error(f"[Sentiment] Deterministic analysis failed: {e}")
            raise


# Export singleton for use in KaiAgent orchestration
sentiment_agent = SentimentAgent()
