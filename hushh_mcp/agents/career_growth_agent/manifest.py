# hushh_mcp/agents/career_growth_agent/manifest.py
manifest = {
    "name": "Career Growth Agent",
    "version": "1.0.0",
    "description": "Analyzes LinkedIn data to recommend career paths and learning resources",
    "entry_point": "index:app",
    "consent_scopes": [
        {
            "name": "custom.linkedin.upload",
            "description": "Access exported LinkedIn data to analyze your skills and experience"
        }
    ]
}

# This manifest defines the Career Growth Agent, which is responsible for analyzing user data
# and providing recommendations for career advancement. It requires access to the user's profile,