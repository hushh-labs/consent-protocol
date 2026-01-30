#!/usr/bin/env python3
"""
Test with invalid ticker to ensure proper error handling.
"""

import asyncio
import os
import sys

sys.path.append(os.getcwd())

from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope


async def test_invalid_ticker():
    print("--- Testing with Invalid Ticker ---")
    
    user_id = "test_user_123"
    
    # Issue Token
    token = issue_token(
        user_id=user_id,
        agent_id="agent_kai",
        scope=ConsentScope("agent.kai.analyze")
    )
    
    # Initialize Orchestrator
    orchestrator = KaiOrchestrator(
        user_id=user_id,
        risk_profile="balanced",
        processing_mode="hybrid"
    )
    
    # Test with INVALID ticker
    print("\nTesting: INVALIDTICKER123")
    try:
        decision = await orchestrator.analyze(
            ticker="INVALIDTICKER123",
            consent_token=token.token
        )
        print(f"\n❌ UNEXPECTED: Should have failed but got: {decision.decision}")
    except ValueError as e:
        print(f"\n✅ EXPECTED FAILURE: {e}")
    except Exception as e:
        print(f"\n⚠️  Different error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_invalid_ticker())
