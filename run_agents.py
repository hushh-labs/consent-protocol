import asyncio
import logging

# Simple runner to start agents on different ports
# In production, these would be separate services/containers

def main():
    print("🚀 Starting HushhMCP Agents...")
    
    print("""
    ═══════════════════════════════════════════════════════════════════
    AGENT PORT MAPPING (from consent-protocol/hushh_mcp/constants.py)
    ═══════════════════════════════════════════════════════════════════
    
    Port  │ Agent                  │ Status
    ──────┼────────────────────────┼─────────
    10003 │ Orchestrator           │ Active
    10004 │ Professional Profile   │ Active
    10005 │ Food & Dining          │ Active
    10006 │ Finance                │ Reserved
    10007 │ Health & Wellness      │ Reserved
    10008 │ Travel                 │ Reserved
    10009 │ Identity               │ Reserved
    8000  │ FastAPI Dev Server     │ Optional
    
    ═══════════════════════════════════════════════════════════════════
    HOW TO RUN
    ═══════════════════════════════════════════════════════════════════
    
    Run each agent in a separate terminal:
    
    Terminal 1 (Orchestrator - REQUIRED):
    cd consent-protocol
    uvicorn hushh_mcp.agents.orchestrator:a2a_app --port 10003 --reload
    
    Terminal 2 (Professional Profile - Optional):
    cd consent-protocol
    uvicorn hushh_mcp.agents.professional_profile:a2a_app --port 10004 --reload
    
    Terminal 3 (Food & Dining REST API - Optional):
    cd consent-protocol
    uvicorn api.main:app --port 8000 --reload
    
    Terminal 4 (Next.js Frontend):
    cd hushh-webapp
    npm run dev
    
    ═══════════════════════════════════════════════════════════════════
    TESTING
    ═══════════════════════════════════════════════════════════════════
    
    Run all tests:
    cd consent-protocol
    pytest tests/ -v
    
    Run specific test:
    pytest tests/test_food_dining_agent.py -v
    
    ═══════════════════════════════════════════════════════════════════
    """)

if __name__ == "__main__":
    main()
