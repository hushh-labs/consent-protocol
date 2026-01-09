# hushh_mcp/agents/food_dining/__init__.py

"""
Food & Dining Agent

Consent-first agent for restaurant recommendations and meal planning.
Uses vault-encrypted user preferences (dietary restrictions, cuisines, budget).

Features:
- Conversational data collection (handle_message)
- Restaurant recommendations (get_restaurant_recommendations)
- Spending analysis (analyze_spending)
"""

from .agent import HushhFoodDiningAgent, get_food_dining_agent
from .manifest import AGENT_MANIFEST

__all__ = ["HushhFoodDiningAgent", "get_food_dining_agent", "AGENT_MANIFEST"]
