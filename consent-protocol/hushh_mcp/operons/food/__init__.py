# hushh_mcp/operons/food/__init__.py

"""
Food & Dining Operons

Pure, reusable functions for food-related logic.
Each operon is stateless, testable, and composable.
"""

from .dietary import validate_dietary_restrictions, is_compatible_with_diet, get_dietary_label
from .preferences import calculate_cuisine_match_score, get_top_cuisine_matches
from .budget import calculate_meal_budget, filter_by_price_range

__all__ = [
    # Dietary operons
    "validate_dietary_restrictions",
    "is_compatible_with_diet",
    "get_dietary_label",
    # Preference operons
    "calculate_cuisine_match_score",
    "get_top_cuisine_matches",
    # Budget operons
    "calculate_meal_budget",
    "filter_by_price_range",
]
