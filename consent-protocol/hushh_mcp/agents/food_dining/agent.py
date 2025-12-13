# hushh_mcp/agents/food_dining/agent.py

"""
Food & Dining Agent

A consent-first agent that provides personalized restaurant recommendations
and meal planning based on encrypted user preferences.

This agent demonstrates:
1. Consent token validation before ANY data access
2. E2EE vault integration for user preferences
3. Composable operons for business logic
4. Clean error handling and logging
"""

from typing import List, Dict, Optional
import json

from hushh_mcp.consent.token import validate_token
from hushh_mcp.vault.encrypt import decrypt_data
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID, EncryptedPayload

# Import our operons
from hushh_mcp.operons.food.dietary import (
    validate_dietary_restrictions,
    is_compatible_with_diet,
    get_dietary_label
)
from hushh_mcp.operons.food.preferences import (
    calculate_cuisine_match_score,
    get_top_cuisine_matches
)
from hushh_mcp.operons.food.budget import (
    calculate_meal_budget,
    filter_by_price_range,
    categorize_price_range
)

from .manifest import AGENT_MANIFEST


class HushhFoodDiningAgent:
    """
    Food & Dining Agent with E2EE Vault Integration
    
    Features:
    - Restaurant recommendations based on encrypted preferences
    - Dietary restriction filtering
    - Budget-conscious suggestions
    - Cuisine preference matching
    - Meal planning assistance
    
    All user data is encrypted in vault and requires valid consent tokens.
    """
    
    def __init__(self, agent_id: str = "agent_food_dining"):
        self.agent_id = agent_id
        self.manifest = AGENT_MANIFEST
        
        # Required scopes for this agent
        self.required_scopes = {
            "budget": ConsentScope.VAULT_READ_FINANCE,
            "preferences": ConsentScope.VAULT_READ_CONTACTS  # Using for food prefs
        }
    
    def get_restaurant_recommendations(
        self,
        user_id: UserID,
        consent_token: str,
        vault_key_hex: str,
        user_vault_data: Dict[str, EncryptedPayload],
        restaurants: List[Dict[str, any]],
        max_results: int = 5
    ) -> List[Dict[str, any]]:
        """
        Get personalized restaurant recommendations.
        
        Args:
            user_id: User identifier
            consent_token: Signed consent token
            vault_key_hex: User's vault encryption key (client-provided)
            user_vault_data: Encrypted vault data (from backend)
            restaurants: Available restaurants to filter
            max_results: Maximum number of recommendations
            
        Returns:
            List of recommended restaurants with scores
            
        Raises:
            PermissionError: If consent validation fails
            ValueError: If vault decryption fails
            
        Example:
            >>> restaurants = [
            ...     {
            ...         "name": "Vegan Delight",
            ...         "cuisine": "italian",
            ...         "avg_price": 18,
            ...         "tags": {"vegan", "gluten_free"}
            ...     }
            ... ]
            >>> agent.get_restaurant_recommendations(
            ...     user_id="user123",
            ...     consent_token="HCT:...",
            ...     vault_key_hex="abcd...",
            ...     user_vault_data={...},
            ...     restaurants=restaurants
            ... )
        """
        # ═══════════════════════════════════════════════════════
        # STEP 1: Validate Consent Token
        # ═══════════════════════════════════════════════════════
        print(f"🔍 Validating consent for user {user_id}...")
        
        # We need finance scope for budget
        valid, reason, token = validate_token(
            consent_token,
            expected_scope=self.required_scopes["budget"]
        )
        
        if not valid:
            raise PermissionError(
                f"❌ Consent validation failed: {reason}"
            )
        
        # Verify token belongs to this user
        if token.user_id != user_id:
            raise PermissionError(
                f"❌ Token user ID mismatch: expected {user_id}, got {token.user_id}"
            )
        
        print(f"✅ Consent verified for {self.agent_id}")
        
        # ═══════════════════════════════════════════════════════
        # STEP 2: Decrypt User Preferences from Vault
        # ═══════════════════════════════════════════════════════
        print(f"🔓 Decrypting user preferences...")
        
        try:
            # Decrypt dietary restrictions
            dietary_data = decrypt_data(
                user_vault_data["dietary_restrictions"],
                vault_key_hex
            )
            dietary_restrictions = json.loads(dietary_data)
            
            # Decrypt cuisine preferences
            cuisine_data = decrypt_data(
                user_vault_data["cuisine_preferences"],
                vault_key_hex
            )
            cuisine_preferences = json.loads(cuisine_data)
            
            # Decrypt budget
            budget_data = decrypt_data(
                user_vault_data["monthly_food_budget"],
                vault_key_hex
            )
            monthly_budget = float(json.loads(budget_data))
            
            print(f"✅ Preferences decrypted successfully")
            
        except Exception as e:
            raise ValueError(f"❌ Vault decryption failed: {str(e)}")
        
        # ═══════════════════════════════════════════════════════
        # STEP 3: Validate User Data
        # ═══════════════════════════════════════════════════════
        valid_dietary, invalid = validate_dietary_restrictions(dietary_restrictions)
        if not valid_dietary:
            print(f"⚠️ Warning: Invalid dietary restrictions: {invalid}")
        
        # ═══════════════════════════════════════════════════════
        # STEP 4: Calculate Constraints
        # ═══════════════════════════════════════════════════════
        # Calculate max price per meal from budget
        max_price_per_meal = calculate_meal_budget(monthly_budget)
        
        print(f"💰 Budget: ${monthly_budget}/month → ${max_price_per_meal:.2f}/meal")
        print(f"🥗 Dietary: {get_dietary_label(dietary_restrictions)}")
        print(f"🍽️ Cuisines: {', '.join(cuisine_preferences)}")
        
        # ═══════════════════════════════════════════════════════
        # STEP 5: Filter Restaurants
        # ═══════════════════════════════════════════════════════
        
        # Filter by budget
        affordable = filter_by_price_range(
            restaurants,
            max_price=max_price_per_meal
        )
        
        print(f"📊 {len(affordable)}/{len(restaurants)} within budget")
        
        # Filter by dietary restrictions
        compatible = []
        for restaurant in affordable:
            is_ok, reason = is_compatible_with_diet(
                restaurant.get("tags", set()),
                dietary_restrictions
            )
            
            if is_ok:
                compatible.append(restaurant)
            else:
                print(f"   ❌ {restaurant['name']}: {reason}")
        
        print(f"✅ {len(compatible)} compatible with diet")
        
        # ═══════════════════════════════════════════════════════
        # STEP 6: Rank by Cuisine Preference
        # ═══════════════════════════════════════════════════════
        recommendations = get_top_cuisine_matches(
            cuisine_preferences,
            compatible,
            top_n=max_results
        )
        
        # Add price category labels
        for rec in recommendations:
            rec["price_category"] = categorize_price_range(rec["avg_price"])
        
        print(f"🎯 Returning top {len(recommendations)} recommendations")
        
        return recommendations
    
    def analyze_spending(
        self,
        user_id: UserID,
        consent_token: str,
        vault_key_hex: str,
        dining_history: EncryptedPayload
    ) -> Dict[str, any]:
        """
        Analyze user's dining spending patterns.
        
        Args:
            user_id: User identifier
            consent_token: Signed consent token
            vault_key_hex: User's vault encryption key
            dining_history: Encrypted list of past meal prices
            
        Returns:
            Spending analysis dict
            
        Raises:
            PermissionError: If consent validation fails
        """
        # Validate consent
        valid, reason, token = validate_token(
            consent_token,
            expected_scope=self.required_scopes["budget"]
        )
        
        if not valid:
            raise PermissionError(f"Consent validation failed: {reason}")
        
        if token.user_id != user_id:
            raise PermissionError("Token user ID mismatch")
        
        # Decrypt dining history
        history_data = decrypt_data(dining_history, vault_key_hex)
        meal_prices = json.loads(history_data)
        
        # Calculate statistics
        from hushh_mcp.operons.food.budget import calculate_weekly_dining_cost
        
        stats = calculate_weekly_dining_cost(meal_prices)
        
        return {
            "user_id": user_id,
            "agent_id": self.agent_id,
            "analysis": stats,
            "insights": self._generate_insights(stats)
        }
    
    def _generate_insights(self, stats: Dict[str, float]) -> List[str]:
        """Generate spending insights from statistics."""
        insights = []
        
        if stats["meal_count"] > 0:
            avg = stats["average"]
            
            if avg > 25:
                insights.append(
                    f"💸 Your average meal cost (${avg:.2f}) is above typical range. "
                    "Consider more budget-friendly options."
                )
            elif avg < 10:
                insights.append(
                    f"💰 Great job keeping meals affordable at ${avg:.2f} average!"
                )
            
            if stats["max"] > stats["average"] * 2:
                insights.append(
                    f"⚠️ Your most expensive meal (${stats['max']:.2f}) was significantly "
                    f"above your average. Plan splurges within monthly budget."
                )
        
        return insights
    
    def get_agent_info(self) -> Dict[str, any]:
        """Get agent manifest information."""
        return {
            "agent_id": self.agent_id,
            "manifest": self.manifest,
            "status": "active",
            "version": self.manifest["version"]
        }
