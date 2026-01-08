import asyncio
import os
import sys

# Ensure hushh_research is in path
sys.path.append(os.path.join(os.getcwd(), "consent-protocol"))

from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

async def test_gemini_analysis():
    print("Testing Gemini Analysis (Hybrid Mode)...")
    ticker = "NVDA"
    user_id = "test_user"
    
    # Issue a real test token
    token = issue_token(user_id, "agent_kai", ConsentScope("agent.kai.analyze"))
    
    orchestrator = KaiOrchestrator(
        user_id=user_id,
        risk_profile="balanced",
        processing_mode="hybrid"
    )
    
    try:
        decision = await orchestrator.analyze(ticker, token.token)
        print("\n=== Analysis Result ===")
        print(f"Ticker: {decision.ticker}")
        print(f"Decision: {decision.decision}")
        print(f"Headline: {decision.headline}")
        print(f"Processing Mode: {decision.processing_mode}")
        
        # Check for Gemini data
        insight = decision.fundamental_insight
        moat = insight.get("business_moat", "")
        print(f"Moat: {moat[:100]}...")
        if "Deterministic Mode" in moat or not moat:
            print("❌ FAIL: Still in Deterministic Mode or No Moat Data")
        else:
            print("✅ SUCCESS: Gemini Data Present")
            
    except Exception as e:
        print(f"Error during analysis: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini_analysis())
