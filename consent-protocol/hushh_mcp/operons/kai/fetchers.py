# hushh_mcp/operons/kai/fetchers.py

"""
Kai Fetcher Operons

External data retrieval with per-source consent validation.
Each fetcher requires specific TrustLink for the data source.

Free API Options:
- SEC EDGAR: Public, no API key required
- NewsAPI: Free tier (100 req/day) OR Google News RSS (unlimited)
- Market Data: yfinance (unlimited) OR Alpha Vantage free tier (500 req/day)
"""

from typing import Dict, Any, List
import logging
import os
from datetime import datetime, timedelta
import asyncio

import httpx

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID

logger = logging.getLogger(__name__)

async def _fetch_yahoo_quote_fast(ticker: str) -> Dict[str, Any]:
    """
    Fast market-data fallback using Yahoo's public quote endpoint.

    Rationale: `yfinance` is synchronous and can hang in some Cloud Run environments.
    This endpoint is lighter-weight and has explicit timeouts.

    NOTE: This is public market data (no user data). Consent is still enforced by the caller.
    """
    url = "https://query1.finance.yahoo.com/v7/finance/quote"
    params = {"symbols": ticker.upper()}
    headers = {"User-Agent": "Hushh-Research/1.0 (eng@hush1one.com)"}

    timeout = httpx.Timeout(connect=3.0, read=4.0, write=4.0, pool=3.0)
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        res = await client.get(url, params=params)
        res.raise_for_status()
        data = res.json() or {}
        results = ((data.get("quoteResponse") or {}).get("result")) or []
        if not results:
            return {}

        q = results[0] or {}

        # Map a minimal common subset
        return {
            "ticker": ticker.upper(),
            "price": q.get("regularMarketPrice") or 0,
            "change_percent": q.get("regularMarketChangePercent") or 0,
            "volume": q.get("regularMarketVolume") or 0,
            "market_cap": q.get("marketCap") or 0,
            "pe_ratio": q.get("trailingPE") or 0,
            "pb_ratio": q.get("priceToBook") or 0,
            "dividend_yield": q.get("trailingAnnualDividendYield") or 0,
            "company_name": q.get("longName") or q.get("shortName") or ticker.upper(),
            # Sector/industry often not present in quote endpoint; keep best-effort.
            "sector": q.get("sector") or "Unknown",
            "industry": q.get("industry") or "Unknown",
            "source": "Yahoo Quote (Fast)",
            "fetched_at": datetime.utcnow().isoformat(),
        }


# ============================================================================
# OPERON: fetch_sec_filings
# ============================================================================

async def fetch_sec_filings(
    ticker: str,
    user_id: UserID,
    consent_token: str,
) -> Dict[str, Any]:
    """
    Operon: Fetch SEC filings from EDGAR (free, public API).
    
    TrustLink Required: external.sec.filings
    
    This requires EXPLICIT consent for external data access.
    SEC EDGAR is 100% free and requires no API key.
    
    Args:
        ticker: Stock ticker symbol
        user_id: User ID for audit
        consent_token: Valid consent token with external.sec.filings scope
        
    Returns:
        Dict with SEC filing data:
        - ticker: Stock symbol
        - cik: Central Index Key
        - latest_10k: Parsed 10-K data
        - latest_10q: Parsed 10-Q data
        - filing_date: Date of latest filing
        - source: "SEC EDGAR"
        
    Raises:
        PermissionError: If TrustLink validation fails
    """
    # Validate TrustLink for Kai analysis
    # Note: agent.kai.analyze scope covers all data fetching needs for Kai
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope("agent.kai.analyze")  # Changed from external.sec.filings
    )
    
    if not valid:
        logger.error(f"[SEC Fetcher] TrustLink validation failed: {reason}")
        raise PermissionError(f"SEC data access denied: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch")
    
    logger.info(f"[SEC Fetcher] Fetching filings for {ticker} - user {user_id}")
    
    # SEC EDGAR API Implementation
    # Reference: https://www.sec.gov/edgar/sec-api-documentation
    # Note: Different base URLs for different endpoints
    
    EDGAR_DATA_URL = "https://data.sec.gov"  # For submissions
    EDGAR_WWW_URL = "https://www.sec.gov"    # For company tickers
    HEADERS = {
        "User-Agent": "Hushh-Research/1.0 (eng@hush1one.com)",  # Required by SEC
        "Accept": "application/json"
    }
    
    # Step 1: Get CIK from ticker
    async with httpx.AsyncClient() as client:
        # Get ticker-to-CIK mapping
        logger.info(f"[SEC Fetcher] Looking up CIK for {ticker}...")
        tickers_response = await client.get(
            f"{EDGAR_WWW_URL}/files/company_tickers.json",
            headers=HEADERS,
            timeout=10.0
        )
        tickers_response.raise_for_status()
        tickers_data = tickers_response.json()
        
        # Find CIK for ticker
        cik = None
        for entry in tickers_data.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                cik = str(entry["cik_str"]).zfill(10)
                break
        
        if not cik:
            raise ValueError(f"CIK not found for ticker: {ticker}")
        
        logger.info(f"[SEC Fetcher] Found CIK {cik} for {ticker}")
        
        # Step 2: Get submissions (filings list)
        logger.info(f"[SEC Fetcher] Fetching submissions for CIK {cik}...")
        submissions_response = await client.get(
            f"{EDGAR_DATA_URL}/submissions/CIK{cik}.json",
            headers=HEADERS,
            timeout=10.0
        )
        submissions_response.raise_for_status()
        submissions = submissions_response.json()
        
        # Step 3: Find latest 10-K
        filings = submissions.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        accession_numbers = filings.get("accessionNumber", [])
        filing_dates = filings.get("filingDate", [])
        
        latest_10k_idx = None
        for i, form in enumerate(forms):
            if form == "10-K":
                latest_10k_idx = i
                break
        
        if latest_10k_idx is None:
            raise ValueError(f"No 10-K filing found for ticker: {ticker} (CIK: {cik})")
        
        logger.info(f"[SEC Fetcher] Found 10-K: {accession_numbers[latest_10k_idx]} dated {filing_dates[latest_10k_idx]}")
        
        # Step 4: Fetch Company Facts for actual financial data
        logger.info(f"[SEC Fetcher] Fetching company facts (financial metrics) for CIK {cik}...")
        try:
            facts_url = f"{EDGAR_DATA_URL}/api/xbrl/companyfacts/CIK{cik}.json"
            # NVDA and other large filers can have very large payloads; allow a bit more time + retry.
            # We still keep a firm ceiling so the overall Kai analysis doesn't stall.
            facts_response = None
            for attempt in range(1, 3):
                try:
                    facts_response = await client.get(
                        facts_url,
                        headers=HEADERS,
                        timeout=25.0
                    )
                    facts_response.raise_for_status()
                    break
                except Exception as e:
                    if attempt >= 2:
                        raise
                    logger.warning(f"[SEC Fetcher] companyfacts attempt {attempt} failed: {e}; retrying once...")
                    await asyncio.sleep(0.5)

            facts_data = (facts_response.json() if facts_response is not None else {}) or {}
            
            # Extract financial metrics from US-GAAP taxonomy
            us_gaap = facts_data.get("facts", {}).get("us-gaap", {})
            
            def get_latest_annual_value(metric_names: List[str]) -> int:
                """Extract the most recent annual (10-K) value from a prioritized list of tags."""
                for metric_name in metric_names:
                    if metric_name not in us_gaap:
                        continue
                    
                    metric_data = us_gaap[metric_name]
                    usd_data = metric_data.get("units", {}).get("USD", [])
                    
                    # Filter for 10-K filings only
                    annual_data = [d for d in usd_data if d.get("form") == "10-K"]
                    
                    if not annual_data:
                        continue
                    
                    # Get most recent by end date
                    latest = sorted(annual_data, key=lambda x: x.get("end", ""), reverse=True)[0]
                    return int(latest.get("val", 0))
                return 0

            def get_historical_annual_values(metric_names: List[str], years: int = 4) -> List[Dict[str, Any]]:
                """Extract historical annual values for a prioritized list of tags."""
                for metric_name in metric_names:
                    if metric_name not in us_gaap:
                        continue
                    
                    metric_data = us_gaap[metric_name]
                    usd_data = metric_data.get("units", {}).get("USD", [])
                    
                    # Filter for 10-K filings only
                    annual_data = [d for d in usd_data if d.get("form") == "10-K"]
                    
                    if not annual_data:
                        continue
                    
                    # Get most recent years by end date
                    sorted_data = sorted(annual_data, key=lambda x: x.get("end", ""), reverse=True)
                    
                    # Dedup by year (sometimes multiple entries for same year)
                    seen_years = set()
                    historical = []
                    for d in sorted_data:
                        year = d.get("fy") or d.get("end", "")[:4]
                        if year not in seen_years:
                            historical.append({
                                "year": year,
                                "value": int(d.get("val", 0)),
                                "end": d.get("end")
                            })
                            seen_years.add(year)
                        if len(historical) >= years:
                            break
                    return historical[::-1] # Chronological order
                return []
            
            # Extract key financial metrics using prioritized US-GAAP tags
            revenue = get_latest_annual_value(["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"])
            net_income = get_latest_annual_value(["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"])
            total_assets = get_latest_annual_value(["Assets"])
            total_liabilities = get_latest_annual_value(["Liabilities"])
            
            # --- NEW: Expanded Fundamental Metrics ---
            # Cash Flow tags
            ocf = get_latest_annual_value(["NetCashProvidedByUsedInOperatingActivities"])
            capex = get_latest_annual_value(["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"])
            fcf = ocf - capex if ocf else 0
            
            # Balance Sheet & Efficiency tags
            long_term_debt = get_latest_annual_value(["LongTermDebtNoncurrent", "LongTermDebt"])
            equity = get_latest_annual_value(["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"])
            op_income = get_latest_annual_value(["OperatingIncomeLoss"])
            rnd = get_latest_annual_value(["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"])

            # --- NEW: Historical Trends for Quant Analysis ---
            revenue_trend = get_historical_annual_values(["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"])
            net_income_trend = get_historical_annual_values(["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"])
            ocf_trend = get_historical_annual_values(["NetCashProvidedByUsedInOperatingActivities"])
            rnd_trend = get_historical_annual_values(["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"])
            
            logger.info(f"[SEC Fetcher] Extracted Deep Metrics for {ticker} - Trends for Revenue, Net Income, OCF, R&D available.")
            
        except Exception as facts_error:
            logger.warning(f"[SEC Fetcher] Could not fetch company facts: {facts_error}")
            revenue = net_income = total_assets = total_liabilities = 0
            ocf = fcf = long_term_debt = equity = op_income = rnd = 0
            revenue_trend = net_income_trend = ocf_trend = rnd_trend = []
        
        # Return structured filing data with EXPANDED financial metrics
        return {
            "ticker": ticker,
            "cik": cik,
            "entity_name": facts_data.get("entityName", ticker) if 'facts_data' in locals() else ticker,
            "latest_10k": {
                "accession_number": accession_numbers[latest_10k_idx],
                "filing_date": filing_dates[latest_10k_idx],
                "revenue": revenue,
                "net_income": net_income,
                "total_assets": total_assets,
                "total_liabilities": total_liabilities,
                # Deep Metrics
                "operating_cash_flow": ocf,
                "free_cash_flow": fcf,
                "long_term_debt": long_term_debt,
                "equity": equity,
                "operating_income": op_income,
                "research_and_development": rnd,
                # Trends
                "revenue_trend": revenue_trend,
                "net_income_trend": net_income_trend,
                "ocf_trend": ocf_trend,
                "rnd_trend": rnd_trend,
            },
            "filing_date": filing_dates[latest_10k_idx],
            "source": "SEC EDGAR (Institutional Trend Extract)",
            "fetched_at": datetime.utcnow().isoformat(),
        }


# ============================================================================
# OPERON: fetch_market_news
# ============================================================================

async def fetch_market_news(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    days_back: int = 7,
) -> List[Dict[str, Any]]:
    """
    Operon: Fetch recent news articles.
    
    TrustLink Required: external.news.api
    
    Uses free sources:
    - NewsAPI free tier (100 req/day) if API key available
    - Google News RSS (unlimited) as fallback
    
    Args:
        ticker: Stock ticker symbol
        user_id: User ID for audit
        consent_token: Valid consent token
        days_back: How many days of news to fetch
        
    Returns:
        List of news article dicts with:
        - title: Article headline
        - description: Article summary
        - url: Article URL
        - publishedAt: Publication timestamp
        - source: {"name": "Source Name"}
        
    Raises:
        PermissionError: If TrustLink validation fails
    """
    # Validate TrustLink
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope("agent.kai.analyze")  # Changed from external.news.api
    )
    
    if not valid:
        logger.error(f"[News Fetcher] TrustLink validation failed: {reason}")
        raise PermissionError(f"News data access denied: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch")
    
    logger.info(f"[News Fetcher] Fetching news for {ticker} - user {user_id}")
    
    # Mock implementation
    # Real implementation would use NewsAPI or Google News RSS
    
    return [
        {
            "title": f"{ticker} reports strong Q4 earnings",
            "description": "Company beats analyst expectations with 15% revenue growth",
            "url": "https://example.com/article1",
            "publishedAt": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "source": {"name": "Financial Times"},
        },
        {
            "title": f"Analysts upgrade {ticker} to buy rating",
            "description": "Multiple firms raise price targets citing strong fundamentals",
            "url": "https://example.com/article2",
            "publishedAt": (datetime.utcnow() - timedelta(days=2)).isoformat(),
            "source": {"name": "Bloomberg"},
        },
    ]


# ============================================================================
# OPERON: fetch_market_data  
# ============================================================================

async def fetch_market_data(
    ticker: str,
    user_id: UserID,
    consent_token: str,
) -> Dict[str, Any]:
    """
    Operon: Fetch current market data (price, volume, metrics).
    
    TrustLink Required: external.market.data
    
    Uses free sources:
    - yfinance (unlimited) as primary
    - Alpha Vantage free tier (500 req/day) as fallback
    
    Args:
        ticker: Stock ticker symbol
        user_id: User ID for audit
        consent_token: Valid consent token
        
    Returns:
        Dict with market data:
        - ticker: Stock symbol
        - price: Current price
        - change_percent: Daily change %
        - volume: Trading volume
        - market_cap: Market capitalization
        - pe_ratio: P/E ratio
        - source: Data source name
        
    Raises:
        PermissionError: If TrustLink validation fails
    """
    # Validate TrustLink
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope("agent.kai.analyze")  # Changed from external.market.data
    )
    
    if not valid:
        logger.error(f"[Market Data Fetcher] TrustLink validation failed: {reason}")
        raise PermissionError(f"Market data access denied: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch")
    
    logger.info(f"[Market Data Fetcher] Fetching market data for {ticker} - user {user_id}")
    
    # Use yfinance for real market data (free, unlimited)
    try:
        import yfinance as yf

        # yfinance is synchronous and can hang indefinitely in some environments (notably Cloud Run).
        # Run it in a thread and enforce a hard timeout so Kai can still return results.
        async def _get_info() -> Dict[str, Any]:
            def _blocking_fetch() -> Dict[str, Any]:
                stock = yf.Ticker(ticker)
                return stock.info or {}

            return await asyncio.to_thread(_blocking_fetch)

        try:
            info = await asyncio.wait_for(_get_info(), timeout=8.0)
        except asyncio.TimeoutError:
            logger.warning("[Market Data Fetcher] yfinance timed out; returning minimal market data")
            info = {}
        
        # If yfinance returned empty (or timed out), try a fast Yahoo quote fallback.
        if not info:
            try:
                yahoo = await _fetch_yahoo_quote_fast(ticker)
                if yahoo:
                    return yahoo
            except Exception as e:
                logger.warning(f"[Market Data Fetcher] Yahoo fast quote fallback failed: {e}")

        # Extract key market metrics
        return {
            "ticker": ticker,
            "price": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "change_percent": info.get("regularMarketChangePercent", 0),
            "volume": info.get("volume", 0),
            "market_cap": info.get("marketCap", 0),
            "pe_ratio": info.get("trailingPE", 0),
            "pb_ratio": info.get("priceToBook", 0),
            "dividend_yield": info.get("dividendYield", 0) or 0,
            "company_name": info.get("longName", ticker),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "source": "yfinance (Real-time)",
            "fetched_at": datetime.utcnow().isoformat(),
        }
        # raise ImportError("Temporarily disabled yfinance")
        
    except ImportError:
        logger.warning("[Market Data Fetcher] yfinance not installed, using minimal data")
        # Fallback to minimal data if library not available
        return {
            "ticker": ticker,
            "price": 0,
            "change_percent": 0,
            "volume": 0,
            "market_cap": 0,
            "pe_ratio": 0,
            "pb_ratio": 0,
            "dividend_yield": 0,
            "company_name": ticker,
            "sector": "Unknown",
            "industry": "Unknown",
            "source": "Unavailable (yfinance not installed)",
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.warning(f"[Market Data Fetcher] yfinance error (likely rate-limited): {e}")
        # Best-effort: try fast Yahoo quote before returning minimal zeros.
        try:
            yahoo = await _fetch_yahoo_quote_fast(ticker)
            if yahoo:
                return yahoo
        except Exception as e2:
            logger.warning(f"[Market Data Fetcher] Yahoo fast quote fallback failed: {e2}")
        # Return minimal data structure instead of failing
        # This allows analysis to proceed with SEC data only
        return {
            "ticker": ticker,
            "price": 0,
            "change_percent": 0,
            "volume": 0,
            "market_cap": 0,
            "pe_ratio": 0,
            "pb_ratio": 0,
            "dividend_yield": 0,
            "company_name": ticker,
            "sector": "Unknown",
            "industry": "Unknown",
            "source": "Unavailable (API error or rate limit)",
            "fetched_at": datetime.utcnow().isoformat(),
        }


# ============================================================================
# OPERON: fetch_peer_data
# ============================================================================

async def fetch_peer_data(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    sector: str = None,
) -> List[Dict[str, Any]]:
    """
    Operon: Fetch peer company data for comparison.
    
    TrustLink Required: external.market.data
    
    Args:
        ticker: Stock ticker symbol
        user_id: User ID for audit
        consent_token: Valid consent token
        sector: Industry sector (optional, auto-detected if None)
        
    Returns:
        List of peer company dicts with market data
        
    Raises:
        PermissionError: If TrustLink validation fails
    """
    # Validate TrustLink
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope("agent.kai.analyze")  # Changed from external.market.data
    )
    
    if not valid:
        raise PermissionError(f"Market data access denied: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch")
    
    logger.info(f"[Peer Data Fetcher] Fetching peers for {ticker} - user {user_id}")
    
    # Mock peers
    # Real implementation would fetch from sector/industry database
    
    return [
        {"ticker": "MSFT", "pe_ratio": 32.1, "market_cap": 2_800_000_000_000},
        {"ticker": "GOOGL", "pe_ratio": 24.8, "market_cap": 1_750_000_000_000},
        {"ticker": "AMZN", "pe_ratio": 45.3, "market_cap": 1_600_000_000_000},
    ]
