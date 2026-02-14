# hushh_mcp/operons/kai/llm.py

"""
Kai LLM Operons - Powered by Gemini 3 Flash
Processes financial data through Gemini 3 Flash for fast, intelligent analysis.
"""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

# Gemini SDK compatibility
#
# We support two possible SDKs:
# - New: `google-genai`  -> `from google import genai` and `from google.genai import types`
# - Legacy (deprecated): `google-generativeai` -> `import google.generativeai as genai`
#
# In dev environments, only the legacy package may be installed. We fall back
# to it to avoid noisy runtime errors.
try:
    from google import genai  # type: ignore
    from google.genai import types  # type: ignore

    GEMINI_AVAILABLE = True
    GEMINI_SDK = "google-genai"
except ImportError:
    try:
        import google.generativeai as genai  # type: ignore

        types = None  # type: ignore
        GEMINI_AVAILABLE = True
        GEMINI_SDK = "google-generativeai"
        logging.warning(
            "⚠️ Using deprecated google.generativeai SDK fallback. Install google-genai to remove this warning."
        )
    except ImportError:
        GEMINI_AVAILABLE = False
        GEMINI_SDK = "none"
        genai = None  # type: ignore
        types = None  # type: ignore
        logging.warning(
            "⚠️ No Gemini SDK found (google-genai or google-generativeai). Kai agent will run in logic-only mode."
        )

from hushh_mcp.config import GOOGLE_API_KEY
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import GEMINI_MODEL, GEMINI_MODEL_FULL, ConsentScope
from hushh_mcp.types import UserID

logger = logging.getLogger(__name__)

# Configure Gemini Client
# NOTE: GOOGLE_API_KEY is sanitized (trimmed) in hushh_mcp/config.py to avoid Cloud Run
# gRPC metadata errors ("Illegal header value") caused by trailing newlines.
_gemini_client = None
if GEMINI_AVAILABLE and GOOGLE_API_KEY:
    try:
        if GEMINI_SDK == "google-genai":
            _gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
        else:
            # google.generativeai uses module-level configuration
            genai.configure(api_key=GOOGLE_API_KEY)
            _gemini_client = None
    except Exception as e:
        logger.error(f"Failed to initialize Gemini Client: {e}")
        GEMINI_AVAILABLE = False
elif not GOOGLE_API_KEY:
    logger.warning("⚠️ GOOGLE_API_KEY not found. Gemini operons will be unavailable.")


def _extract_json(text: str) -> Dict[str, Any]:
    """Robustly extract JSON from a string, handling markdown and noise."""
    text = text.strip()

    # 1. Try standard markdown code block removal
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    # 2. Try identifying the first { and last }
    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"[Kai LLM] JSON parse failed on text: {text[:100]}...")
        return {}


async def analyze_stock_with_gemini(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    sec_data: Dict[str, Any],
    market_data: Optional[Dict[str, Any]] = None,
    sentiment_data: Optional[List[Dict[str, Any]]] = None,
    quant_metrics: Optional[Dict[str, Any]] = None,
    user_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Operon: Deep financial analysis using Gemini-2.0-flash.

    Validates: agent.kai.analyze
    Context: All available specialist data (SEC, Market, Sentiment, Quant Trends)
    """
    # 1. Validate Consent
    valid, reason, token = validate_token(consent_token, ConsentScope("agent.kai.analyze"))

    if not valid:
        logger.error(f"[Gemini Operon] Permission denied: {reason}")
        raise PermissionError(f"Gemini analysis denied: {reason}")

    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY:
        return {"error": "Gemini unavailable (Missing API Key or SDK)", "fallback": True}

    logger.info(f"[Gemini Operon] Starting deep analyst session for {ticker}")

    # 2. Build Rich Context (Trends + Fundamentals)
    latest_10k = sec_data.get("latest_10k", {})

    # Extract User Context (Personalization) — tolerant to missing keys (backward compatible).
    user_context = user_context or {}

    def _safe_list(val: Any) -> List[Any]:
        return val if isinstance(val, list) else []

    def _safe_dict(val: Any) -> Dict[str, Any]:
        return val if isinstance(val, dict) else {}

    def _tickers_from_holdings(val: Any) -> List[str]:
        out: List[str] = []
        for h in _safe_list(val):
            if isinstance(h, dict):
                t = h.get("ticker") or h.get("symbol")
                if isinstance(t, str) and t.strip():
                    out.append(t.strip().upper())
        return out

    # Strategy
    risk = user_context.get("risk_tolerance") or "Balanced"
    style = _safe_list(user_context.get("investment_style"))
    time_horizon = user_context.get("time_horizon") or "Unknown"
    turnover = user_context.get("portfolio_turnover") or "Unknown"

    # Identity / scale
    firm = user_context.get("firm") or "—"
    title = user_context.get("title") or "—"
    investor_type = user_context.get("investor_type") or "—"
    aum_b = user_context.get("aum_billions")

    # Portfolio footprint
    holdings = user_context.get("top_holdings")
    holdings_tickers = _tickers_from_holdings(holdings)
    sector_exposure = _safe_dict(user_context.get("sector_exposure"))
    recent_buys = _safe_list(user_context.get("recent_buys"))
    recent_sells = _safe_list(user_context.get("recent_sells"))

    # Insider
    is_insider = bool(user_context.get("is_insider"))
    insider_ticker = user_context.get("insider_company_ticker") or "—"

    # Provenance (optional)
    last_13f_date = user_context.get("last_13f_date") or "—"
    last_form4_date = user_context.get("last_form4_date") or "—"

    personalization = f"""
    --- INVESTOR PROFILE (AUDIENCE) ---
    Name: {user_context.get("name", "—")}
    Firm/Title: {firm} / {title}
    Investor Type: {investor_type}
    Risk Tolerance: {risk}
    Time Horizon: {time_horizon}
    Portfolio Turnover: {turnover}
    AUM (B): {aum_b if aum_b is not None else "—"}

    Investment Style: {style if style else "—"}
    Current Holdings (tickers): {holdings_tickers if holdings_tickers else "—"}
    Sector Exposure (if provided): {sector_exposure if sector_exposure else "—"}
    Recent Buys/Sells: {recent_buys if recent_buys else "—"} / {recent_sells if recent_sells else "—"}

    Insider: {is_insider} (company: {insider_ticker})
    Data Freshness (optional): last_13F={last_13f_date}, last_Form4={last_form4_date}

    INSTRUCTION: Tailor your \"Bull Case\" and \"Bear Case\" specifically for this profile.
    - If Conservative: penalize high volatility, leverage, weak FCF conversion; prioritize downside protection.
    - If Aggressive/Growth: allow higher multiples if durability + growth are supported by SEC numbers; prioritize upside capture.
    - If Time Horizon is short: emphasize near-term catalysts + downside risk.
    - If Turnover is low: emphasize moat durability + long-run compounding.
    - Use sector exposure/holdings to avoid redundant bets and highlight concentration risks.
    """

    context = f"""
    --- SENIOR ANALYST TERMINAL ({ticker}) ---
    Company: {sec_data.get("entity_name", ticker)}
    {personalization}
    
    [Current Fundamentals]
    Revenue: ${latest_10k.get("revenue", 0):,}
    Net Income: ${latest_10k.get("net_income", 0):,}
    Operating Income: ${latest_10k.get("operating_income", 0):,}
    Operating Cash Flow: ${latest_10k.get("operating_cash_flow", 0):,}
    Free Cash Flow: ${latest_10k.get("free_cash_flow", 0):,}
    R&D Investment: ${latest_10k.get("research_and_development", 0):,}
    
    [3-Year Quant Trends]
    Revenue Trend: {quant_metrics.get("revenue_trend_data") if quant_metrics else "N/A"}
    Net Income Trend: {quant_metrics.get("net_income_trend_data") if quant_metrics else "N/A"}
    OCF Trend: {quant_metrics.get("ocf_trend_data") if quant_metrics else "N/A"}
    R&D Trend: {quant_metrics.get("rnd_trend_data") if quant_metrics else "N/A"}
    
    [Efficiency Ratios]
    Revenue CAGR (3Y): {quant_metrics.get("revenue_cagr_3y", 0) * 100:.2f}%
    Revenue Growth (YoY): {quant_metrics.get("revenue_growth_yoy", 0) * 100:.2f}%
    Net Income Growth (YoY): {quant_metrics.get("net_income_growth_yoy", 0) * 100:.2f}%
    
    --- MARKET DATA ---
    Current Price: {market_data.get("price", "N/A") if market_data else "N/A"}
    Market Cap: {market_data.get("market_cap", "N/A") if market_data else "N/A"}
    Sector: {market_data.get("sector", "Unknown") if market_data else "Unknown"}
    """

    system_instruction = """
You are a **Senior Quant Analyst** at a Top-Tier Hedge Fund.
Your mission is to perform a high-conviction, data-driven "Earnings Quality & Moat Audit".

### HUSHH CORE PRINCIPLES
- **Explain with Receipts**: Every claim must be backed by the SEC numbers provided.
- **Data Integrity**: If numbers don't add up (e.g., Net Income > OCF), flag it as a quality issue.
- **Institutional Rigor**: No generic advice. Be specific.

### REPORT STRUCTURE (Strict JSON)
- `business_moat`: (String) Depth of the "castle moat". Use Revenue CAGR and R&D trends to justify if the moat is expanding or shrinking.
- `financial_resilience`: (String) Audit the balance sheet. Evaluate the relationship between OCF and Net Income. Is the cash real?
- `growth_efficiency`: (String) Capital allocation audit. Are they getting a good return on their R&D spend? 
- `bull_case`: (String) Upside based on compounding or inflection points.
- `bear_case`: (String) Hard risks (e.g., growth slowing vs high R&D cost).
- `summary`: (String) 1-paragraph institutional summary.
- `confidence`: (Float 0.0-1.0)
- `recommendation`: (String: "buy", "hold", "reduce")

### OPERATIONAL RULES
- Use Billions ($B) for all monetary values.
- Maintain a cold, analytical tone.
- If data is missing (N/A), use your knowledge of the sector to explain what that missing piece usually signifies for a company like this.
- DO NOT use markdown formatting inside the JSON strings.
"""

    # 3. Call Gemini
    try:
        if GEMINI_SDK == "google-genai":
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            # Cloud calls can occasionally stall; hard-timebox so Kai can fall back to deterministic analysis.
            response = await asyncio.wait_for(
                model.generate_content_async(f"{system_instruction}\n\nCONTEXT DATA:\n{context}"),
                timeout=40.0,
            )
        else:
            # google.generativeai fallback
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    model.generate_content,
                    f"{system_instruction}\n\nCONTEXT DATA:\n{context}",
                ),
                timeout=40.0,
            )

        analysis = _extract_json(response.text)
        if not analysis:
            raise ValueError("Failed to parse JSON from Gemini response")

        # Fallback to defaults if keys missing to prevent "N/A"
        analysis.setdefault("bull_case", "Growth potential through market expansion.")
        analysis.setdefault("bear_case", "Risks include competitive pressure and macro headwinds.")

        logger.info(f"[Gemini Operon] Deep Fundamental Report success for {ticker}")
        return analysis

    except asyncio.TimeoutError:
        logger.warning(
            f"[Gemini Operon] Gemini timed out for {ticker}; falling back to deterministic analysis"
        )
        return {"error": "Gemini timeout", "fallback": True}
    except Exception as e:
        logger.error(f"[Gemini Operon] Error calling Gemini: {e}")
        return {"error": str(e), "fallback": True}


async def analyze_sentiment_with_gemini(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    news_articles: List[Dict[str, Any]],
    user_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Operon: Sentiment analysis using Gemini-2.0-flash.

    Analyzes news articles and market sentiment for investment signals.
    """
    # 1. Validate Consent
    valid, reason, token = validate_token(consent_token, ConsentScope("agent.kai.analyze"))

    if not valid:
        logger.error(f"[Gemini Sentiment] Permission denied: {reason}")
        raise PermissionError(f"Sentiment analysis denied: {reason}")

    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY:
        return {"error": "Gemini unavailable", "fallback": True}

    logger.info(f"[Gemini Sentiment] Analyzing sentiment for {ticker}")

    # 2. Build Context from news articles
    news_context = (
        "\n".join(
            [
                f"- [{a.get('source', {}).get('name', 'Unknown')}] {a.get('title', 'No title')}: {a.get('description', '')[:200]}"
                for a in news_articles[:10]
            ]
        )
        if news_articles
        else "No recent news available."
    )

    user_risk = user_context.get("risk_tolerance", "Balanced") if user_context else "Balanced"

    context = f"""
    --- SENTIMENT ANALYSIS TERMINAL ({ticker}) ---
    
    [Recent News Articles]
    {news_context}
    
    [Investor Profile]
    Risk Tolerance: {user_risk}
    """

    system_instruction = """
You are a **Market Sentiment Analyst** specializing in news-driven momentum signals.

Analyze the provided news articles and assess market sentiment for this stock.

### REPORT STRUCTURE (Strict JSON)
- `summary`: (String) 1-paragraph summary of current market sentiment
- `sentiment_score`: (Float -1.0 to 1.0) Overall sentiment (-1=very bearish, 0=neutral, 1=very bullish)
- `key_catalysts`: (List[String]) Top 3-5 near-term catalysts or events driving sentiment
- `momentum_signal`: (String) "positive", "neutral", or "negative" momentum
- `confidence`: (Float 0.0-1.0)
- `recommendation`: (String: "bullish", "neutral", "bearish")

### RULES
- Focus on actionable insights, not generic observations
- Weight recent news more heavily
- Identify both positive and negative signals
- DO NOT use markdown inside JSON strings
"""

    # 3. Call Gemini
    try:
        if GEMINI_SDK == "google-genai":
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            response = await asyncio.wait_for(
                model.generate_content_async(f"{system_instruction}\n\nCONTEXT:\n{context}"),
                timeout=30.0,
            )
        else:
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    model.generate_content,
                    f"{system_instruction}\n\nCONTEXT:\n{context}",
                ),
                timeout=30.0,
            )

        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()

        analysis = json.loads(text)
        logger.info(f"[Gemini Sentiment] Analysis complete for {ticker}")
        return analysis

    except asyncio.TimeoutError:
        logger.warning(f"[Gemini Sentiment] Timed out for {ticker}")
        return {"error": "Gemini timeout", "fallback": True}
    except Exception as e:
        logger.error(f"[Gemini Sentiment] Error: {e}")
        return {"error": str(e), "fallback": True}


async def analyze_valuation_with_gemini(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    market_data: Dict[str, Any],
    peer_data: Optional[List[Dict[str, Any]]] = None,
    user_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Operon: Valuation analysis using Gemini-2.0-flash.

    Performs relative and intrinsic valuation analysis.
    """
    # 1. Validate Consent
    valid, reason, token = validate_token(consent_token, ConsentScope("agent.kai.analyze"))

    if not valid:
        logger.error(f"[Gemini Valuation] Permission denied: {reason}")
        raise PermissionError(f"Valuation analysis denied: {reason}")

    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY:
        return {"error": "Gemini unavailable", "fallback": True}

    logger.info(f"[Gemini Valuation] Analyzing valuation for {ticker}")

    # 2. Build Context
    peer_context = (
        "\n".join(
            [
                f"- {p.get('ticker', 'N/A')}: P/E={p.get('pe_ratio', 'N/A')}, Growth={p.get('growth', 'N/A')}"
                for p in (peer_data or [])[:5]
            ]
        )
        if peer_data
        else "No peer data available."
    )

    user_risk = user_context.get("risk_tolerance", "Balanced") if user_context else "Balanced"

    context = f"""
    --- VALUATION ANALYSIS TERMINAL ({ticker}) ---
    
    [Market Data]
    Current Price: ${market_data.get("price", "N/A")}
    P/E Ratio: {market_data.get("pe_ratio", "N/A")}
    Forward P/E: {market_data.get("forward_pe", "N/A")}
    P/B Ratio: {market_data.get("pb_ratio", "N/A")}
    P/S Ratio: {market_data.get("ps_ratio", "N/A")}
    EV/EBITDA: {market_data.get("ev_ebitda", "N/A")}
    Market Cap: ${market_data.get("market_cap", "N/A")}
    Dividend Yield: {market_data.get("dividend_yield", "N/A")}
    52-Week Range: ${market_data.get("52w_low", "N/A")} - ${market_data.get("52w_high", "N/A")}
    
    [Peer Comparison]
    {peer_context}
    
    [Investor Profile]
    Risk Tolerance: {user_risk}
    """

    system_instruction = """
You are a **Quantitative Valuation Analyst** at an institutional investment firm.

Perform a comprehensive valuation analysis with focus on relative and intrinsic value.

### REPORT STRUCTURE (Strict JSON)
- `summary`: (String) 1-paragraph valuation assessment
- `valuation_verdict`: (String) "undervalued", "fair", or "overvalued"
- `valuation_metrics`: (Dict) Key metrics analyzed with values
- `peer_ranking`: (String) How this stock ranks vs peers
- `price_targets`: (Dict) {"conservative": X, "base_case": Y, "optimistic": Z}
- `upside_downside`: (Dict) {"upside_pct": X, "downside_pct": Y}
- `confidence`: (Float 0.0-1.0)
- `recommendation`: (String: "undervalued", "fair", "overvalued")

### RULES
- Use multiple valuation methods (P/E, EV/EBITDA, DCF if possible)
- Compare to sector averages
- Consider growth rates when evaluating multiples
- DO NOT use markdown inside JSON strings
"""

    # 3. Call Gemini
    try:
        if GEMINI_SDK == "google-genai":
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            response = await asyncio.wait_for(
                model.generate_content_async(f"{system_instruction}\n\nCONTEXT:\n{context}"),
                timeout=30.0,
            )
        else:
            model = genai.GenerativeModel(GEMINI_MODEL_FULL)
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    model.generate_content,
                    f"{system_instruction}\n\nCONTEXT:\n{context}",
                ),
                timeout=30.0,
            )

        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()

        analysis = json.loads(text)
        logger.info(f"[Gemini Valuation] Analysis complete for {ticker}")
        return analysis

    except asyncio.TimeoutError:
        logger.warning(f"[Gemini Valuation] Timed out for {ticker}")
        return {"error": "Gemini timeout", "fallback": True}
    except Exception as e:
        logger.error(f"[Gemini Valuation] Error: {e}")
        return {"error": str(e), "fallback": True}


# ============================================================================
# STREAMING GENERATORS - Real-time Token Streaming
# ============================================================================


async def stream_gemini_response(
    prompt: str,
    agent_name: str = "gemini",
    timeout: float = 60.0,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Generic streaming generator for Gemini responses.

    Yields events:
    - {"type": "token", "text": "..."} for each token chunk
    - {"type": "complete", "text": "full response"} when done
    - {"type": "error", "message": "..."} on error

    Uses Gemini 3 Flash with synchronous streaming wrapped in async context.
    This is more reliable than async iteration which may not yield correctly.
    """
    if GEMINI_SDK != "google-genai":
        # Streaming is only implemented for the new google-genai client.
        yield {
            "type": "error",
            "message": "Gemini streaming unavailable (requires google-genai SDK)",
        }
        return

    if not _gemini_client:
        logger.error("[Gemini Streaming] No client configured!")
        yield {"type": "error", "message": "Gemini API key not configured"}
        return

    logger.info(f"[Gemini Streaming] Starting stream for {agent_name}")

    try:
        # Use ASYNC streaming to prevent blocking the event loop
        if types is None:
            yield {
                "type": "error",
                "message": "Gemini streaming unavailable (google.genai.types missing)",
            }
            return

        config = types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=4096,
        )

        # Call the ASYNC streaming method
        # Note: google.genai V1 SDK uses client.aio for async calls
        stream = await _gemini_client.aio.models.generate_content_stream(
            model=GEMINI_MODEL,  # Use standardized model
            contents=prompt,
            config=config,
        )

        full_text = ""
        token_count = 0

        # Async iteration
        async for chunk in stream:
            try:
                chunk_text = chunk.text if hasattr(chunk, "text") else ""
            except Exception as e:
                logger.warning(f"[Gemini Streaming] Skipped chunk for {agent_name}: {e}")
                continue

            if chunk_text:
                token_count += 1
                full_text += chunk_text
                # Log only every 10th token to reduce noise
                if token_count % 10 == 0:
                    logger.info(f"[Gemini Streaming] Token #{token_count} for {agent_name}")

                yield {
                    "type": "token",
                    "text": chunk_text,
                    "agent": agent_name,
                }

        # Yield complete event with full text
        yield {
            "type": "complete",
            "text": full_text,
            "agent": agent_name,
        }

        logger.info(f"[Gemini Streaming] Complete for {agent_name}, {token_count} tokens")

    except Exception as e:
        logger.error(f"[Gemini Streaming] Error for {agent_name}: {e}", exc_info=True)
        yield {
            "type": "error",
            "message": str(e),
            "agent": agent_name,
        }


async def analyze_fundamental_streaming(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    sec_data: Dict[str, Any],
    market_data: Optional[Dict[str, Any]] = None,
    quant_metrics: Optional[Dict[str, Any]] = None,
    user_context: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streaming version of fundamental analysis.
    Yields tokens in real-time as Gemini generates them.
    """
    # 1. Validate Consent
    valid, reason, token = validate_token(consent_token, ConsentScope("agent.kai.analyze"))

    if not valid:
        yield {"type": "error", "message": f"Permission denied: {reason}"}
        return

    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY:
        yield {"type": "error", "message": "Gemini unavailable"}
        return

    logger.info(f"[Fundamental Streaming] Starting for {ticker}")

    # Build context (same as non-streaming version)
    latest_10k = sec_data.get("latest_10k", {})
    user_context = user_context or {}

    risk = user_context.get("risk_tolerance") or "Balanced"

    context = f"""
    --- SENIOR ANALYST TERMINAL ({ticker}) ---
    Company: {sec_data.get("entity_name", ticker)}
    Risk Profile: {risk}
    
    [Current Fundamentals]
    Revenue: ${latest_10k.get("revenue", 0):,}
    Net Income: ${latest_10k.get("net_income", 0):,}
    Operating Cash Flow: ${latest_10k.get("operating_cash_flow", 0):,}
    Free Cash Flow: ${latest_10k.get("free_cash_flow", 0):,}
    
    [3-Year Quant Trends]
    Revenue Trend: {quant_metrics.get("revenue_trend_data") if quant_metrics else "N/A"}
    
    --- MARKET DATA ---
    Current Price: {market_data.get("price", "N/A") if market_data else "N/A"}
    Market Cap: {market_data.get("market_cap", "N/A") if market_data else "N/A"}
    """

    system_instruction = """
You are a Senior Quant Analyst performing a deep fundamental analysis.

Provide your analysis in a conversational, thinking-out-loud style.
Walk through your reasoning step by step.

Cover:
1. Business moat assessment
2. Financial health audit  
3. Growth efficiency review
4. Bull case and bear case
5. Final recommendation (buy/hold/reduce) with confidence

Be specific and cite the numbers provided.
"""

    prompt = f"{system_instruction}\n\nCONTEXT DATA:\n{context}"

    # Stream the response
    async for event in stream_gemini_response(prompt, agent_name="fundamental"):
        yield event
