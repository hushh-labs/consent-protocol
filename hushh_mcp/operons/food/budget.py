# hushh_mcp/operons/food/budget.py

"""
Meal Budget Calculation Operon

Pure functions for budget and pricing logic.
"""

from typing import List, Dict


def calculate_meal_budget(
    monthly_food_budget: float,
    meals_per_week: int = 14,  # 2 meals/day * 7 days
    weeks_in_month: float = 4.33
) -> float:
    """
    Calculate per-meal budget based on monthly allocation.
    
    Args:
        monthly_food_budget: Total monthly budget for dining
        meals_per_week: Number of planned meals per week
        weeks_in_month: Average weeks per month
        
    Returns:
        Budget per meal
        
    Example:
        >>> calculate_meal_budget(600, 14, 4.33)
        9.91  # ~$10 per meal
    """
    total_meals_per_month = meals_per_week * weeks_in_month
    return monthly_food_budget / total_meals_per_month


def filter_by_price_range(
    restaurants: List[Dict[str, any]],
    max_price: float,
    min_price: float = 0.0,
    price_key: str = "avg_price"
) -> List[Dict[str, any]]:
    """
    Filter restaurants by price range.
    
    Args:
        restaurants: List of restaurant dicts
        max_price: Maximum price per person
        min_price: Minimum price per person
        price_key: Key in dict containing price
        
    Returns:
        Filtered list of restaurants
        
    Example:
        >>> restaurants = [
        ...     {"name": "Cheap Eats", "avg_price": 8},
        ...     {"name": "Mid Range", "avg_price": 15},
        ...     {"name": "Fancy", "avg_price": 50}
        ... ]
        >>> filter_by_price_range(restaurants, 20)
        [
            {"name": "Cheap Eats", "avg_price": 8},
            {"name": "Mid Range", "avg_price": 15}
        ]
    """
    return [
        r for r in restaurants
        if min_price <= r.get(price_key, float('inf')) <= max_price
    ]


def categorize_price_range(price: float) -> str:
    """
    Categorize price into $ symbols.
    
    Args:
        price: Average price per person
        
    Returns:
        Price category ($, $$, $$$, $$$$)
        
    Example:
        >>> categorize_price_range(8)
        "$"
        
        >>> categorize_price_range(25)
        "$$"
    """
    if price < 10:
        return "$"
    elif price < 25:
        return "$$"
    elif price < 50:
        return "$$$"
    else:
        return "$$$$"


def calculate_weekly_dining_cost(
    meals: List[float]
) -> Dict[str, float]:
    """
    Calculate weekly dining statistics.
    
    Args:
        meals: List of meal prices for the week
        
    Returns:
        Dict with total, average, min, max
        
    Example:
        >>> calculate_weekly_dining_cost([10, 15, 12, 20, 8])
        {
            "total": 65,
            "average": 13.0,
            "min": 8,
            "max": 20,
            "meal_count": 5
        }
    """
    if not meals:
        return {
            "total": 0,
            "average": 0,
            "min": 0,
            "max": 0,
            "meal_count": 0
        }
    
    return {
        "total": sum(meals),
        "average": sum(meals) / len(meals),
        "min": min(meals),
        "max": max(meals),
        "meal_count": len(meals)
    }
