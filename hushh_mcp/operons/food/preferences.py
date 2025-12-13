# hushh_mcp/operons/food/preferences.py

"""
Cuisine Preference Matching Operon

Pure function to score and match cuisine preferences.
"""

from typing import List, Dict
from enum import Enum


class CuisineType(str, Enum):
    """Supported cuisine types"""
    ITALIAN = "italian"
    CHINESE = "chinese"
    JAPANESE = "japanese"
    INDIAN = "indian"
    MEXICAN = "mexican"
    THAI = "thai"
    FRENCH = "french"
    AMERICAN = "american"
    MEDITERRANEAN = "mediterranean"
    KOREAN = "korean"
    VIETNAMESE = "vietnamese"
    MIDDLE_EASTERN = "middle_eastern"
    GREEK = "greek"
    SPANISH = "spanish"


def calculate_cuisine_match_score(
    user_preferences: List[str],
    restaurant_cuisine: str,
    weights: Dict[str, float] = None
) -> float:
    """
    Calculate how well a restaurant matches user cuisine preferences.
    
    Args:
        user_preferences: User's preferred cuisines (ordered by preference)
        restaurant_cuisine: Restaurant's cuisine type
        weights: Optional custom weights for ranking (default: exponential decay)
        
    Returns:
        Match score (0.0 to 1.0)
        
    Example:
        >>> calculate_cuisine_match_score(["italian", "japanese"], "italian")
        1.0
        
        >>> calculate_cuisine_match_score(["italian", "japanese"], "chinese")
        0.0
    """
    if not user_preferences:
        return 0.5  # Neutral score if no preferences
    
    if restaurant_cuisine in user_preferences:
        # Position-based scoring (earlier preferences score higher)
        index = user_preferences.index(restaurant_cuisine)
        
        if weights:
            return weights.get(str(index), 0.0)
        else:
            # Default: exponential decay (1.0, 0.8, 0.6, 0.4, ...)
            return max(0.0, 1.0 - (index * 0.2))
    
    return 0.0  # No match


def get_top_cuisine_matches(
    user_preferences: List[str],
    restaurants: List[Dict[str, any]],
    top_n: int = 5
) -> List[Dict[str, any]]:
    """
    Get top N restaurant matches based on cuisine preferences.
    
    Args:
        user_preferences: User's preferred cuisines
        restaurants: List of restaurant dicts with 'cuisine' key
        top_n: Number of top matches to return
        
    Returns:
        Sorted list of top matches with scores
        
    Example:
        >>> restaurants = [
        ...     {"name": "Pasta Palace", "cuisine": "italian"},
        ...     {"name": "Sushi Bar", "cuisine": "japanese"},
        ...     {"name": "Burger Joint", "cuisine": "american"}
        ... ]
        >>> get_top_cuisine_matches(["italian", "japanese"], restaurants, 2)
        [
            {"name": "Pasta Palace", "cuisine": "italian", "match_score": 1.0},
            {"name": "Sushi Bar", "cuisine": "japanese", "match_score": 0.8}
        ]
    """
    scored = []
    
    for restaurant in restaurants:
        score = calculate_cuisine_match_score(
            user_preferences,
            restaurant.get("cuisine", "")
        )
        
        scored.append({
            **restaurant,
            "match_score": score
        })
    
    # Sort by score descending
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    
    return scored[:top_n]


def validate_cuisine_types(cuisines: List[str]) -> tuple[bool, List[str]]:
    """
    Validate cuisine type strings.
    
    Args:
        cuisines: List of cuisine type strings
        
    Returns:
        Tuple of (is_valid, list_of_invalid_items)
    """
    valid_cuisines = {c.value for c in CuisineType}
    invalid = [c for c in cuisines if c not in valid_cuisines]
    
    return (len(invalid) == 0, invalid)
