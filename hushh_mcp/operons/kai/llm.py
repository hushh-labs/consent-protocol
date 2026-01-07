# hushh_mcp/operons/kai/llm.py

"""
Kai LLM Operons - Powered by Gemini
Processes financial data through Gemini-2.0-flash for deep reasoning.
"""

import logging
from typing import Dict, Any, List, Optional
import google.generativeai as genai
import json

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.config import GOOGLE_API_KEY
from hushh_mcp.types import UserID

logger = logging.getLogger(__name__)

# Configure Gemini
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    logger.warning("⚠️ GOOGLE_API_KEY not found. Gemini operons will be unavailable.")

async def analyze_stock_with_gemini(
    ticker: str,
    user_id: UserID,
    consent_token: str,
    sec_data: Dict[str, Any],
    market_data: Optional[Dict[str, Any]] = None,
    sentiment_data: Optional[List[Dict[str, Any]]] = None,
    quant_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Operon: Deep financial analysis using Gemini-2.0-flash.
    
    Validates: agent.kai.analyze
    Context: All available specialist data (SEC, Market, Sentiment, Quant Trends)
    """
    # 1. Validate Consent
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope("agent.kai.analyze")
    )
    
    if not valid:
        logger.error(f"[Gemini Operon] Permission denied: {reason}")
        raise PermissionError(f"Gemini analysis denied: {reason}")
    
    if not GOOGLE_API_KEY:
        return {
            "error": "Gemini API key not configured",
            "fallback": True
        }

    logger.info(f"[Gemini Operon] Starting deep analyst session for {ticker}")

    # 2. Build Rich Context (Trends + Fundamentals)
    latest_10k = sec_data.get('latest_10k', {})
    
    context = f"""
    --- SENIOR ANALYST TERMINAL ({ticker}) ---
    Company: {sec_data.get('entity_name', ticker)}
    
    [Current Fundamentals]
    Revenue: ${latest_10k.get('revenue', 0):,}
    Net Income: ${latest_10k.get('net_income', 0):,}
    Operating Income: ${latest_10k.get('operating_income', 0):,}
    Operating Cash Flow: ${latest_10k.get('operating_cash_flow', 0):,}
    Free Cash Flow: ${latest_10k.get('free_cash_flow', 0):,}
    R&D Investment: ${latest_10k.get('research_and_development', 0):,}
    
    [3-Year Quant Trends]
    Revenue Trend: {quant_metrics.get('revenue_trend_data') if quant_metrics else 'N/A'}
    Net Income Trend: {quant_metrics.get('net_income_trend_data') if quant_metrics else 'N/A'}
    OCF Trend: {quant_metrics.get('ocf_trend_data') if quant_metrics else 'N/A'}
    R&D Trend: {quant_metrics.get('rnd_trend_data') if quant_metrics else 'N/A'}
    
    [Efficiency Ratios]
    Revenue CAGR (3Y): {quant_metrics.get('revenue_cagr_3y', 0)*100:.2f}%
    Revenue Growth (YoY): {quant_metrics.get('revenue_growth_yoy', 0)*100:.2f}%
    Net Income Growth (YoY): {quant_metrics.get('net_income_growth_yoy', 0)*100:.2f}%
    
    --- MARKET DATA ---
    Current Price: {market_data.get('price', 'N/A') if market_data else 'N/A'}
    Market Cap: {market_data.get('market_cap', 'N/A') if market_data else 'N/A'}
    Sector: {market_data.get('sector', 'Unknown') if market_data else 'Unknown'}
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
        model = genai.GenerativeModel("models/gemini-2.0-flash")
        response = await model.generate_content_async(
            f"{system_instruction}\n\nCONTEXT DATA:\n{context}"
        )
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        analysis = json.loads(text)
        logger.info(f"[Gemini Operon] Deep Fundamental Report success for {ticker}")
        return analysis

    except Exception as e:
        logger.error(f"[Gemini Operon] Error calling Gemini: {e}")
        return {
            "error": str(e),
            "fallback": True
        }
