# hushh_mcp/operons/food/dietary.py

"""
Dietary Restriction Validation Operon

Pure function to validate dietary restrictions.
Used by food agents to filter restaurant recommendations.
"""

from enum import Enum
from typing import List, Set


class DietaryRestriction(str, Enum):
    """Supported dietary restrictions"""
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    GLUTEN_FREE = "gluten_free"
    DAIRY_FREE = "dairy_free"
    NUT_FREE = "nut_free"
    HALAL = "halal"
    KOSHER = "kosher"
    PESCATARIAN = "pescatarian"
    KETO = "keto"
    PALEO = "paleo"


def validate_dietary_restrictions(restrictions: List[str]) -> tuple[bool, List[str]]:
    """
    Validate a list of dietary restrictions.
    
    Args:
        restrictions: List of dietary restriction strings
        
    Returns:
        Tuple of (is_valid, list_of_invalid_items)
        
    Example:
        >>> validate_dietary_restrictions(["vegan", "gluten_free"])
        (True, [])
        
        >>> validate_dietary_restrictions(["vegan", "invalid_diet"])
        (False, ["invalid_diet"])
    """
    valid_restrictions = {r.value for r in DietaryRestriction}
    invalid = [r for r in restrictions if r not in valid_restrictions]
    
    return (len(invalid) == 0, invalid)


def is_compatible_with_diet(
    food_tags: Set[str],
    dietary_restrictions: List[str]
) -> tuple[bool, str]:
    """
    Check if food is compatible with dietary restrictions.
    
    Args:
        food_tags: Set of tags describing the food (e.g., {"meat", "dairy"})
        dietary_restrictions: List of user's dietary restrictions
        
    Returns:
        Tuple of (is_compatible, reason_if_incompatible)
        
    Example:
        >>> is_compatible_with_diet({"meat", "cheese"}, ["vegan"])
        (False, "Contains: meat, cheese (incompatible with vegan)")
        
        >>> is_compatible_with_diet({"vegetables", "oil"}, ["vegan"])
        (True, "")
    """
    # Incompatibility matrix
    incompatible = {
        "vegan": {"meat", "dairy", "eggs", "honey"},
        "vegetarian": {"meat", "poultry", "fish", "seafood"},
        "gluten_free": {"wheat", "barley", "rye", "gluten"},
        "dairy_free": {"milk", "cheese", "butter", "cream", "yogurt"},
        "nut_free": {"peanuts", "almonds", "cashews", "walnuts", "tree_nuts"},
        "halal": {"pork", "alcohol"},
        "kosher": {"pork", "shellfish", "mixing_meat_dairy"},
        "pescatarian": {"meat", "poultry"},
        "keto": {"bread", "rice", "pasta", "sugar", "high_carb"},
        "paleo": {"grains", "legumes", "dairy", "processed"}
    }
    
    for restriction in dietary_restrictions:
        if restriction in incompatible:
            forbidden = incompatible[restriction]
            conflicts = food_tags.intersection(forbidden)
            
            if conflicts:
                return (
                    False,
                    f"Contains: {', '.join(conflicts)} (incompatible with {restriction})"
                )
    
    return (True, "")


def get_dietary_label(restrictions: List[str]) -> str:
    """
    Get a friendly label for dietary restrictions.
    
    Args:
        restrictions: List of dietary restrictions
        
    Returns:
        Human-readable label
        
    Example:
        >>> get_dietary_label(["vegan", "gluten_free"])
        "Vegan, Gluten-Free"
    """
    labels = []
    for r in restrictions:
        # Convert snake_case to Title Case
        label = r.replace("_", " ").title()
        labels.append(label)
    
    return ", ".join(labels) if labels else "No restrictions"
