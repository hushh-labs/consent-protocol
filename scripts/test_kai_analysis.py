import asyncio
import logging
import os
import sys
import traceback

# Add project root to path
sys.path.append(os.getcwd())

# Config logging
logging.basicConfig(level=logging.INFO)

from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator  # noqa: E402
from hushh_mcp.consent.token import issue_token  # noqa: E402
from hushh_mcp.constants import ConsentScope  # noqa: E402


async def test_analysis():
    print("--- Starting Kai Analysis Test ---")

    user_id = "test_user_123"

    # 1. Issue Token
    print("1. Issuing Consent Token...")
    token = issue_token(
        user_id=user_id, agent_id="agent_kai", scope=ConsentScope("agent.kai.analyze")
    )
    print(f"   Token: {token.token[:20]}...")

    # 2. Initialize Orchestrator
    print("2. Initializing Orchestrator...")
    orchestrator = KaiOrchestrator(
        user_id=user_id, risk_profile="balanced", processing_mode="hybrid"
    )

    # 3. Analyze
    print("3. Running Analysis (AAPL)...")
    try:
        decision = await orchestrator.analyze(ticker="AAPL", consent_token=token.token)
        print("\n--- SUCCESS ---")
        print(f"Decision: {decision.decision}")
        print(f"Confidence: {decision.confidence}")
        print(f"Headline: {decision.headline}")
    except Exception:
        print("\n--- FAILURE ---")
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_analysis())
