# hushh_mcp/agents/food_dining/__init__.py
"""
Food & Dining Agent 🥗

A consent-first agent for dining recommendations.
MIGRATED TO ADK (v2.0.0)
"""

from typing import Dict, Any, Optional
from hushh_mcp.types import UserID
from .agent import get_food_dining_agent, FoodDiningAgent

__all__ = ["handle_message", "FoodDiningAgent", "get_food_dining_agent"]

def handle_message(
    message: str,
    user_id: UserID,
    session_state: Optional[Dict] = None
) -> Dict[str, Any]:
    """Compatibility wrapper for the new ADK agent."""
    agent = get_food_dining_agent()
    # Note: Token handling is simplified here for compat; 
    # caller should ideally use agent.handle_message directly with token.
    # We pass empty token; the agent will likely prompt or error gracefully if tools are hit.
    return agent.handle_message(message, user_id, consent_token="")
