# hushh_mcp/agents/food_dining/manifest.py

"""
Food & Dining Agent Manifest

Defines agent metadata, required scopes, and capabilities.
"""

from hushh_mcp.constants import ConsentScope

AGENT_MANIFEST = {
    "agent_id": "agent_food_dining",
    "name": "Food & Dining Assistant",
    "version": "1.0.0",
    "description": (
        "Privacy-first restaurant recommendation and meal planning agent. "
        "Uses encrypted vault data for dietary restrictions, cuisine preferences, "
        "and budget constraints to suggest personalized dining options."
    ),
    
    "required_scopes": [
        ConsentScope.VAULT_READ_FINANCE,    # For budget information
        ConsentScope.VAULT_READ_CONTACTS    # For location/friends preferences
    ],
    
    "optional_scopes": [
        ConsentScope.VAULT_READ_EMAIL       # For reservation confirmations
    ],
    
    "capabilities": [
        "restaurant_recommendations",
        "dietary_restriction_filtering",
        "budget_based_suggestions",
        "cuisine_preference_matching",
        "meal_planning",
        "spending_analysis"
    ],
    
    "data_usage": {
        "reads": [
            "dietary_restrictions",
            "cuisine_preferences",
            "monthly_food_budget",
            "location_data",
            "past_dining_history"
        ],
        "writes": [
            "restaurant_recommendations",
            "meal_plans",
            "spending_insights"
        ],
        "shares": []  # This agent does not share data with third parties
    },
    
    "consent_policy": {
        "min_consent_duration": 7 * 24 * 60 * 60 * 1000,  # 7 days in ms
        "revocable": True,
        "audit_trail": True
    },
    
    "author": "Hushh PDA Team",
    "repository": "hushh-labs/consent-protocol",
    "documentation_url": "https://github.com/hushh-labs/consent-protocol/docs/agents/food_dining.md"
}
