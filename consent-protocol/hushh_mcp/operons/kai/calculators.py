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
    # Extract real financial data from SEC filings
    latest_10k = sec_filings.get("latest_10k", {})
    
    revenue = latest_10k.get("revenue", 0)
    net_income = latest_10k.get("net_income", 0)
    total_assets = latest_10k.get("total_assets", 1)  # Avoid division by zero
    total_liabilities = latest_10k.get("total_liabilities", 0)
    
    # Calculate actual ratios
    equity = max(total_assets - total_liabilities, 1)  # Avoid division by zero
    
    profit_margin = (net_income / revenue) if revenue > 0 else 0
    return_on_equity = (net_income / equity) if equity > 0 else 0
    debt_to_equity = (total_liabilities / equity) if equity > 0 else 0
    
    # Current ratio would need current assets/liabilities (not in our data yet)
    # Using a reasonable estimate based on total balance sheet health
    current_ratio = 1.5 if total_assets > total_liabilities else 0.8
    
    revenue_billions = revenue / 1_000_000_000 if revenue > 0 else 0
    
    # Revenue growth would need historical data (future enhancement)
    # For now, use a reasonable estimate based on company size
    revenue_growth_yoy = 0.10 if revenue > 100_000_000_000 else 0.15
    
    return {
        "revenue_growth_yoy": revenue_growth_yoy,
        "profit_margin": profit_margin,
        "debt_to_equity": debt_to_equity,
        "current_ratio": current_ratio,
        "return_on_equity": return_on_equity,
        "revenue_billions": revenue_billions,
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
        market_data: Current price, market cap, financials (from yfinance)
        
    Returns:
        Dict of valuation metrics
    """
    # Extract real data from market_data (from yfinance)
    pe_ratio = market_data.get("pe_ratio", 0)
    pb_ratio = market_data.get("pb_ratio", 0)
    dividend_yield = market_data.get("dividend_yield", 0)
    market_cap = market_data.get("market_cap", 0)
    price = market_data.get("price", 0)
    
    # Calculate PS ratio if we have revenue data
    # (Would need to pass revenue from SEC data - future enhancement)
    ps_ratio = 0  # Placeholder
    
    # Enterprise value approximation (market cap for simplicity)
    enterprise_value_billions = market_cap / 1_000_000_000 if market_cap > 0 else 0
    
    # Price to FCF would need cash flow data
    price_to_fcf = 0  # Placeholder
    
    return {
        "pe_ratio": pe_ratio or 0,
        "pb_ratio": pb_ratio or 0,
        "ps_ratio": ps_ratio,
        "dividend_yield": dividend_yield or 0,
        "enterprise_value_billions": enterprise_value_billions,
        "price_to_fcf": price_to_fcf,
    }
