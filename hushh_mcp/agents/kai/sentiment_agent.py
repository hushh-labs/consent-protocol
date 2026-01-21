"""
Agent Kai — Sentiment Agent

Processes news articles, earnings calls, and market sentiment using reflection summarization.

Key Responsibilities:
- Market momentum analysis
- Short-term catalyst identification
- News sentiment scoring
- Earnings call interpretation
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

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


class SentimentAgent:
    """
    Sentiment Agent - Analyzes market sentiment and news.
    
    Processes news articles, social media, and earnings transcripts
    to gauge market momentum and identify short-term catalysts.
    """
    
    def __init__(self, processing_mode: str = "hybrid"):
        self.agent_id = "sentiment"
        self.processing_mode = processing_mode
        self.color = "#8b5cf6"
        
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
                    user_context=context
                )
            except Exception as e:
                logger.warning(f"[Sentiment] Gemini analysis failed: {e}. Falling back to deterministic.")
        
        # Use Gemini results if available
        if gemini_analysis and "error" not in gemini_analysis:
            logger.info(f"[Sentiment] Using Gemini analysis for {ticker}")
            return SentimentInsight(
                summary=gemini_analysis.get("summary", f"Sentiment analysis for {ticker}"),
                sentiment_score=gemini_analysis.get("sentiment_score", 0.0),
                key_catalysts=gemini_analysis.get("key_catalysts", []),
                confidence=gemini_analysis.get("confidence", 0.7),
                recommendation=gemini_analysis.get("recommendation", "neutral"),
                news_highlights=[
                    {
                        "title": a.get("title", ""),
                        "source": a.get("source", {}).get("name", "Unknown"),
                        "date": a.get("publishedAt", "")[:10] if a.get("publishedAt") else ""
                    }
                    for a in news_articles[:3]
                ],
                sources=["Gemini Sentiment Analysis"] + [a.get("source", {}).get("name", "Unknown") for a in news_articles[:3]],
            )
        
        # Fallback: Deterministic analysis
        from hushh_mcp.operons.kai.analysis import analyze_sentiment
        
        analysis = analyze_sentiment(
            ticker=ticker,
            user_id=user_id,
            news_articles=news_articles,
            consent_token=consent_token,
        )
        
        # Convert to dataclass
        return SentimentInsight(
            summary=analysis["summary"],
            sentiment_score=analysis["sentiment_score"],
            key_catalysts=analysis["key_catalysts"],
            confidence=analysis["confidence"],
            recommendation=analysis["recommendation"],
            news_highlights=[
                {
                    "title": a.get("title", ""),
                    "source": a.get("source", {}).get("name", "Unknown"),
                    "date": a.get("publishedAt", "")[:10] if a.get("publishedAt") else ""
                }
                for a in news_articles[:3]
            ],
            sources=[article.get("source", {}).get("name", "Unknown") for article in news_articles[:5]],
        )
    

    
    async def _mock_analysis(self, ticker: str) -> SentimentInsight:
        """Mock sentiment analysis (temporary)."""
        
        return SentimentInsight(
            summary=f"Recent news sentiment for {ticker} is moderately positive, with strong momentum following recent product announcements and positive analyst upgrades.",
            sentiment_score=0.65,  # Moderately bullish
            key_catalysts=[
                "New product launch generating positive buzz",
                "Analyst upgrades from major institutions",
                "Strong earnings beat expectations",
                "Expanding market share in key segment",
            ],
            news_highlights=[
                {
                    "title": f"{ticker} announces breakthrough product innovation",
                    "source": "Financial Times",
                    "date": "2024-01-03",
                    "sentiment": "positive",
                },
                {
                    "title": f"Analysts raise price target for {ticker}",
                    "source": "Bloomberg",
                    "date": "2024-01-02",
                    "sentiment": "positive",
                },
                {
                    "title": f"{ticker} faces regulatory headwinds",
                    "source": "Wall Street Journal",
                    "date": "2023-12-28",
                    "sentiment": "negative",
                },
            ],
            sources=[
                "Financial News APIs",
                "Earnings Call Transcripts",
                "Social Media Sentiment Analysis",
            ],
            confidence=0.70,
            recommendation="bullish",
        )
    
    async def fetch_news(
        self,
        ticker: str,
        consent_token: str,
        days_back: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent news for a ticker (requires consent).
        
        Args:
            ticker: Stock ticker
            consent_token: Valid consent token for external.news.api
            days_back: Number of days to look back
            
        Returns:
            List of news articles
        """
        # TODO: Validate consent token
        # TODO: Call news API (e.g., NewsAPI, Alpha Vantage)
        # TODO: Filter and rank by relevance
        
        logger.info(f"[Sentiment] Fetching news for {ticker} ({days_back} days)")
        
        return []
    
    def calculate_sentiment_score(
        self,
        news_articles: List[Dict[str, Any]],
    ) -> float:
        """
        Calculate aggregate sentiment score from news articles.
        
        Args:
            news_articles: List of news articles with sentiment
            
        Returns:
            Sentiment score (-1.0 to 1.0)
        """
        # TODO: Implement sentiment aggregation
        # - Weight by source credibility
        # - Time decay for older articles
        # - Normalize to -1.0 to 1.0 scale
        
        return 0.0
