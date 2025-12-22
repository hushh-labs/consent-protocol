# shared/mock_data.py
"""
Mock data for development and testing.

In production, these would be replaced with database queries.
"""

from typing import Dict

# Mock developer registry (in production, this would be a database)
REGISTERED_DEVELOPERS: Dict[str, Dict] = {
    "dev-hushh-001": {"name": "Hushh Internal", "approved_scopes": ["*"]},
    "dev-partner-001": {"name": "Partner App", "approved_scopes": ["vault_read_food", "vault_read_professional"]},
    # MCP Server developer (Claude Desktop, Cursor, etc.)
    "mcp_dev_claude_desktop": {"name": "Claude Desktop (MCP)", "approved_scopes": ["*"]},
}


# Mock user data store (in production, comes from encrypted vault)
MOCK_USER_DATA: Dict[str, Dict] = {
    "user_mock_001": {
        "food": {
            "dietary_preferences": ["Vegetarian", "Gluten-Free"],
            "favorite_cuisines": ["Italian", "Mexican", "Thai"],
            "monthly_budget": 500
        },
        "professional": {
            "title": "Senior Software Engineer",
            "skills": ["Python", "React", "AWS"],
            "experience_level": "Senior (5-8 years)",
            "job_preferences": ["Full-time", "Remote"]
        }
    }
}
