# hushh_mcp/operons/kai/calculators.py

"""
Kai Calculator Operons

Pure calculation functions for financial analysis.
These are lightweight helpers used by analysis operons.

No consent validation needed - these are just math!
"""

from typing import Dict, Any, List, Tuple


# ============================================================================
# FINANCIAL RATIO CALCULATORS
# ============================================================================

def calculate_financial_ratios(sec_filings: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate key financial ratios from SEC filings.
    
    Args:
        sec_filings: Parsed SEC filing data with income statement, balance sheet
        
    Returns:
        Dict of financial metrics
    """
    # Mock implementation - replace with real calculation
    # In production, parse actual 10-K/10-Q XBRL data
    
    return {
        "revenue_growth_yoy": 0.12,  # 12% YoY growth
        "profit_margin": 0.25,  # 25% margin
        "debt_to_equity": 0.45,
        "current_ratio": 1.8,
        "return_on_equity": 0.22,
        "revenue_billions": 95.0,
    }


def assess_fundamental_health(
    metrics: Dict[str, float]
) -> Tuple[List[str], List[str], float]:
    """
    Assess fundamental health from financial ratios.
    
    Args:
        metrics: Financial ratios
        
    Returns:
        Tuple of (strengths, weaknesses, health_score)
    """
    strengths = []
    weaknesses = []
    
    # Revenue growth
    if metrics.get("revenue_growth_yoy", 0) > 0.1:
        strengths.append("Strong revenue growth (>10% YoY)")
    elif metrics.get("revenue_growth_yoy", 0) < 0:
        weaknesses.append("Declining revenue")
    
    # Profitability
    if metrics.get("profit_margin", 0) > 0.15:
        strengths.append("Healthy profit margins (>15%)")
    elif metrics.get("profit_margin", 0) < 0.05:
        weaknesses.append("Low profit margins (<5%)")
    
    # Debt levels
    if metrics.get("debt_to_equity", 0) < 0.5:
        strengths.append("Low debt levels")
    elif metrics.get("debt_to_equity", 0) > 1.5:
        weaknesses.append("High debt burden")
    
    # Liquidity
    if metrics.get("current_ratio", 0) > 1.5:
        strengths.append("Strong liquidity")
    elif metrics.get("current_ratio", 0) < 1.0:
        weaknesses.append("Liquidity concerns")
    
    # Calculate health score (0-1)
    strength_score = min(len(strengths) / 4, 1.0)
    weakness_penalty = min(len(weaknesses) / 4, 0.5)
    health_score = max(strength_score - weakness_penalty, 0.0)
    
    return strengths, weaknesses, health_score


# ============================================================================
# SENTIMENT CALCULATORS
# ============================================================================

def calculate_sentiment_score(news_articles: List[Dict[str, Any]]) -> float:
    """
    Calculate aggregate sentiment score from news articles.
    
    Args:
        news_articles: List of news dicts with title, description
        
    Returns:
        Sentiment score from -1 (very negative) to +1 (very positive)
    """
    if not news_articles:
        return 0.0
    
    # Mock sentiment calculation
    # In production, use NLP library like transformers or TextBlob
    
    positive_keywords = ["growth", "strong", "beat", "upgrade", "bullish", "positive"]
    negative_keywords = ["decline", "miss", "downgrade", "bearish", "negative", "concern"]
    
    scores = []
    for article in news_articles:
        text = f"{article.get('title', '')} {article.get('description', '')}".lower()
        
        pos_count = sum(1 for kw in positive_keywords if kw in text)
        neg_count = sum(1 for kw in negative_keywords if kw in text)
        
        # Simple sentiment score
        if pos_count > neg_count:
            scores.append(0.5)
        elif neg_count > pos_count:
            scores.append(-0.5)
        else:
            scores.append(0.0)
    
    return sum(scores) / len(scores) if scores else 0.0


def extract_catalysts_from_news(news_articles: List[Dict[str, Any]]) -> List[str]:
    """
    Extract key catalysts/events from news.
    
    Args:
        news_articles: List of news dicts
        
    Returns:
        List of catalyst strings
    """
    catalysts = []
    
    catalyst_keywords = [
        "earnings", "acquisition", "product launch", "FDA approval",
        "partnership", "contract", "innovation", "expansion"
    ]
    
    for article in news_articles[:10]:  # Top 10 articles
        title = article.get("title", "").lower()
        
        for keyword in catalyst_keywords:
            if keyword in title:
                catalysts.append(article.get("title", "")[:100])
                break
    
    return catalysts[:5]  # Top 5 catalysts


# ============================================================================
# VALUATION CALCULATORS
# ============================================================================

def calculate_valuation_metrics(market_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate valuation metrics from market data.
    
    Args:
        market_data: Current price, market cap, financials
        
    Returns:
        Dict of valuation metrics
    """
    # Mock implementation
    # In production, fetch from API and calculate
    
    return {
        "pe_ratio": 28.5,
        "pb_ratio": 8.2,
        "ps_ratio": 7.1,
        "dividend_yield": 0.005,  # 0.5%
        "enterprise_value_billions": 2850.0,
        "price_to_fcf": 32.0,
    }
