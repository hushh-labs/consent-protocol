
import sys
import os
import asyncio

# Add project root to path
sys.path.append(os.getcwd())

try:
    print("Attempting to import KaiOrchestrator...")
    from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
    print("Import successful!")
    
    print("Attempting instantiation...")
    orchestrator = KaiOrchestrator(
        user_id="test_user",
        risk_profile="balanced",
        processing_mode="hybrid"
    )
    print("Instantiation successful!")
    
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
