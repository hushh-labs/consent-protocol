# hushh_mcp/agents/food_dining/__init__.py

"""
Food & Dining Agent

Consent-first agent for restaurant recommendations and meal planning.
Uses vault-encrypted user preferences (dietary restrictions, cuisines, budget).
"""

from .agent import HushhFoodDiningAgent
from .manifest import AGENT_MANIFEST

__all__ = ["HushhFoodDiningAgent", "AGENT_MANIFEST"]
