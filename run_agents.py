import asyncio
import logging
from consent_protocol.hushh_mcp.agents.orchestrator import a2a_app as orchestrator_app
from consent_protocol.hushh_mcp.agents.professional_profile import a2a_app as professional_app

# Simple runner to start both agents on different ports
# In production, these would be separate services/containers

async def main():
    print("🚀 Starting HushhMCP Agents...")
    
    # We need to run them as separate tasks or processes
    # For this simple script, we'll just print usage instructions
    # because uvicorn.run is blocking.
    
    print("""
    Please run the agents in separate terminals:
    
    Terminal 1 (Orchestrator):
    uvicorn consent_protocol.hushh_mcp.agents.orchestrator:a2a_app --port 10003 --reload
    
    Terminal 2 (Professional Profile):
    uvicorn consent_protocol.hushh_mcp.agents.professional_profile:a2a_app --port 10004 --reload
    """)

if __name__ == "__main__":
    asyncio.run(main())
