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

from hushh_mcp.consent.token import validate_token, issue_token
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
        # OR valid VAULT_OWNER scope (Self-Access)
        
        permitted_scopes = [
            self.required_scopes["budget"],
            ConsentScope.VAULT_OWNER
        ]
        
        is_valid = False
        last_reason = "No token"
        
        for scope in permitted_scopes:
            valid, reason, token = validate_token(consent_token, expected_scope=scope)
            if valid:
                is_valid = True
                break
            last_reason = reason
        
        if not is_valid:
            raise PermissionError(
                f"❌ Consent validation failed: {last_reason}"
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
    
    # =========================================================================
    # CONVERSATIONAL DATA COLLECTION (Agentic Flow)
    # =========================================================================
    
    def handle_message(
        self,
        message: str,
        user_id: UserID,
        session_state: Optional[Dict] = None
    ) -> Dict[str, any]:
        """
        Handle conversational message for preference collection.
        
        This is the main entry point for the agentic flow.
        It manages multi-turn conversation to collect:
        - Dietary restrictions
        - Cuisine preferences
        - Monthly budget
        
        Args:
            message: User's message
            user_id: User identifier
            session_state: Current conversation state (for multi-turn)
            
        Returns:
            Dict with response, updated state, and any collected data
        """
        state = session_state or {"step": "greeting", "collected": {}}
        
        response = self._process_conversation_step(message, state, user_id)
        
        return {
            "response": response["message"],
            "session_state": response["state"],
            "collected_data": state.get("collected", {}),
            "is_complete": response.get("is_complete", False),
            "needs_consent": response.get("needs_consent", False),
            "consent_scope": response.get("consent_scope", None),
            # UI hints for frontend
            "ui_type": response.get("ui_type"),
            "options": response.get("options"),
            "allow_custom": response.get("allow_custom"),
            "allow_none": response.get("allow_none"),
            # Consent token (issued when user confirms save)
            "consent_token": response.get("consent_token"),
            "consent_issued_at": response.get("consent_issued_at"),
            "consent_expires_at": response.get("consent_expires_at")
        }
    
    def _process_conversation_step(
        self,
        message: str,
        state: Dict,
        user_id: UserID
    ) -> Dict:
        """Process a single step in the conversation."""
        step = state.get("step", "greeting")
        collected = state.get("collected", {})
        
        if step == "greeting":
            return self._handle_greeting(message, state)
        elif step == "dietary":
            return self._handle_dietary_input(message, state)
        elif step == "cuisines":
            return self._handle_cuisine_input(message, state)
        elif step == "budget":
            return self._handle_budget_input(message, state)
        elif step == "confirm":
            return self._handle_confirmation(message, state, user_id)
        else:
            return self._handle_greeting(message, state)
    
    def _parse_bulk_food_input(self, text: str, state: Dict) -> Dict[str, any]:
        """
        Smart parsing: Extract food preferences from any text.
        Returns dict with found fields and list of missing fields.
        """
        import re
        text_lower = text.lower()
        collected = state.get("collected", {})
        
        # 1. Extract dietary restrictions
        dietary_keywords = {
            "vegetarian": ["vegetarian", "no meat"],
            "vegan": ["vegan", "plant-based", "plant based"],
            "gluten_free": ["gluten-free", "gluten free", "no gluten", "celiac"],
            "dairy_free": ["dairy-free", "dairy free", "no dairy", "lactose"],
            "nut_free": ["nut-free", "nut free", "no nuts", "nut allergy"],
            "halal": ["halal"],
            "kosher": ["kosher"],
            "keto": ["keto", "low carb"],
            "pescatarian": ["pescatarian", "fish only"],
        }
        
        # Always try to extract, extending existing
        found_dietary = set(collected.get("dietary_restrictions", []))
        for restriction, keywords in dietary_keywords.items():
            for kw in keywords:
                if kw in text_lower:
                    found_dietary.add(restriction)
                    break 
        if found_dietary:
            collected["dietary_restrictions"] = list(found_dietary)
        
        # 2. Extract cuisine preferences
        known_cuisines = [
            "italian", "japanese", "chinese", "indian", "mexican",
            "thai", "korean", "vietnamese", "mediterranean", "greek",
            "french", "american", "spanish", "middle eastern", "ethiopian"
        ]
        
        # Always try to extract
        found_cuisines = set(c.lower() for c in collected.get("cuisine_preferences", []))
        for cuisine in known_cuisines:
            if cuisine in text_lower:
                found_cuisines.add(cuisine.title())
        if found_cuisines:
            collected["cuisine_preferences"] = list(found_cuisines)
        
        # 3. Extract budget
        # Look for dollar amounts
        budget_patterns = [
            r'\$\s*(\d{2,4})',
            r'(\d{2,4})\s*(?:dollars|bucks|usd)',
            r'budget\s*(?:is|of)?\s*(\d{2,4})',
            r'(\d{2,4})\s*(?:/mo|month|monthly)'
        ]
        for pattern in budget_patterns:
            match = re.search(pattern, text_lower)
            if match:
                budget = int(match.group(1))
                if 50 <= budget <= 5000:  # Reasonable range
                    collected["monthly_budget"] = budget
                break
        
        state["collected"] = collected
        
        # Determine what's missing
        missing = []
        if not collected.get("dietary_restrictions") and "no restrictions" not in text_lower and "none" not in text_lower:
            missing.append("dietary_restrictions")
        if not collected.get("cuisine_preferences"):
            missing.append("cuisine_preferences")
        if not collected.get("monthly_budget"):
            missing.append("monthly_budget")
        
        return {"collected": collected, "missing": missing, "state": state}
    
    def _handle_greeting(self, message: str, state: Dict) -> Dict:
        """Handle initial greeting and smart parse any provided text."""
        # Try to extract data from provided message
        result = self._parse_bulk_food_input(message, state)
        state = result["state"]
        missing = result["missing"]
        collected = result["collected"]
        
        # Check what was extracted
        found_items = []
        if collected.get("dietary_restrictions"):
            found_items.append(f"🥗 Dietary: **{', '.join(collected['dietary_restrictions'])}**")
        if collected.get("cuisine_preferences"):
            found_items.append(f"🍽️ Cuisines: **{', '.join(collected['cuisine_preferences'])}**")
        if collected.get("monthly_budget"):
            found_items.append(f"💰 Budget: **${collected['monthly_budget']}/month**")
        
        if len(missing) == 0 and len(found_items) > 0:
            # All found! Go straight to confirmation
            state["step"] = "confirm"
            return {
                "message": (
                    "🎉 Great! I was able to extract your preferences from your input:\n\n"
                    + "\n".join(found_items) + "\n\n"
                    "---\n\n"
                    "Is this correct? I can save this to your encrypted vault."
                ),
                "state": state,
                "ui_type": "buttons",
                "options": ["💾 Save Preference", "✏️ Edit"],
                "needs_consent": True
            }
        
        # Some items found, ask for missing
        if found_items:
            if "dietary_restrictions" in missing:
                state["step"] = "dietary"
                return {
                    "message": (
                        "👋 I found some info from your input:\n\n"
                        + "\n".join(found_items) + "\n\n"
                        "Do you have any **dietary restrictions**?"
                    ),
                    "state": state,
                    "ui_type": "checkbox",
                    "options": ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher"],
                    "allow_custom": True,
                    "allow_none": True
                }
            elif "cuisine_preferences" in missing:
                state["step"] = "cuisines"
                return {
                    "message": (
                        "👋 I found some info from your input:\n\n"
                        + "\n".join(found_items) + "\n\n"
                        "What are your **favorite cuisines**?"
                    ),
                    "state": state,
                    "ui_type": "checkbox",
                    "options": ["Italian", "Japanese", "Chinese", "Indian", "Mexican", "Thai", "Mediterranean"],
                    "allow_custom": True
                }
            else:  # budget missing
                state["step"] = "budget"
                return {
                    "message": (
                        "👋 I found some info from your input:\n\n"
                        + "\n".join(found_items) + "\n\n"
                        "What's your **monthly dining budget** in dollars?"
                    ),
                    "state": state
                }
        
        # Standard greeting - no data provided
        state["step"] = "dietary"
        return {
            "message": (
                "👋 Hi! I'm your Food & Dining assistant. I'll help you set up your "
                "dining preferences so I can give you personalized recommendations.\n\n"
                "**Tip:** You can describe all your preferences in one message and "
                "I'll extract them automatically! (e.g., 'I'm vegan, love Italian, $500/mo')\n\n"
                "Let's start with **dietary restrictions**.\n\n"
                "Select any that apply:"
            ),
            "state": state,
            "ui_type": "checkbox",
            "options": ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher"],
            "allow_custom": True,
            "allow_none": True
        }
    
    def _handle_dietary_input(self, message: str, state: Dict) -> Dict:
        """Parse and store dietary restrictions."""
        # Use bulk parse first to capture everything incl. budget/cuisines
        self._parse_bulk_food_input(message, state)
        
        # If dietary was NOT extracted by bulk, handle explicit fallback
        # e.g. "none" or just comma list
        # We re-run explicit dietary logic if needed
        # But wait, bulk parser handles "vegan", "gluten free".
        # It misses "none".
        
        msg_lower = message.lower().strip()
        collected = state["collected"]
        dietary_extracted = collected.get("dietary_restrictions", [])

        if not dietary_extracted:
            if msg_lower in ["none", "no", "nope", "n/a"]:
                # Explicit none
                collected["dietary_restrictions"] = []
                state["collected"] = collected
            # Else: bulk parser might have missed it if not keywords, or user typed garbage.
            # But let's assume if bulk parser found nothing and it wasn't 'none', we proceed.
        
        # Logic to move to next step
        # If we have dietary now (or established 'none'), move to cuisines
        # BUT if we also picked up cuisines from bulk parse, check if we can skip cuisines step
        
        # Note: If bulk parse found other stuff, it's already in 'collected'.
        
        state["step"] = "cuisines"
        
        # Determine next question based on what's missing
        missing_cuisines = not collected.get("cuisine_preferences")
        missing_budget = not collected.get("monthly_budget")
        
        if not missing_cuisines and not missing_budget:
            # Done!
            state["step"] = "confirm"
            return self._handle_budget_input("fake_trigger", state) # Reuse confirm logic
        
        if not missing_cuisines:
            # Update step to budget
            state["step"] = "budget"
            dietary_label = ", ".join(collected.get("dietary_restrictions", [])) or "No restrictions"
            cuisines_label = ", ".join(collected.get("cuisine_preferences", []))
            return {
                "message": (
                    f"✅ Got it! Dietary: **{dietary_label}**\n"
                    f"🍽️ Cuisines: **{cuisines_label}** (extracted)\n\n"
                    "Last question: What's your **monthly dining budget** (in dollars)?"
                ),
                "state": state
            }
            
        # Normal flow -> Ask cuisines
        dietary_label = ", ".join(collected.get("dietary_restrictions", [])) or "No restrictions"
        return {
            "message": (
                f"✅ Got it! Dietary: **{dietary_label}**\n\n"
                "Now, what are your **favorite cuisines**?\n\n"
                "Select your favorites:"
            ),
            "state": state,
            "ui_type": "checkbox",
            "options": ["Italian", "Japanese", "Chinese", "Indian", "Mexican", "Thai", "Mediterranean", "American", "Korean", "Vietnamese"],
            "allow_custom": True
        }
    
    def _handle_cuisine_input(self, message: str, state: Dict) -> Dict:
        """Parse and store cuisine preferences."""
        # Use bulk parse first
        self._parse_bulk_food_input(message, state)
        collected = state["collected"]
        cuisines = collected.get("cuisine_preferences", [])
        
        # Fallback manual parse if bulk missed simple list
        if not cuisines:
            msg_lower = message.lower().strip()
            raw = [c.strip().lower().replace("-", "_").replace(" ", "_") 
                   for c in msg_lower.split(",")]
            valid = {"italian", "japanese", "chinese", "indian", "mexican",
                    "thai", "mediterranean", "american", "korean", "vietnamese",
                    "french", "greek", "spanish", "middle_eastern"}
            cuisines = [c.title() for c in raw if c in valid]
            if cuisines:
                collected["cuisine_preferences"] = cuisines
                state["collected"] = collected
        
        if not collected.get("cuisine_preferences"):
             return {
                "message": (
                    "I didn't recognize any cuisines. Please try again with "
                    "options like: italian, japanese, thai, indian, mexican"
                ),
                "state": state
            }
            
        state["step"] = "budget"
        
        # Check if budget was already extracted
        if collected.get("monthly_budget"):
             # Done!
            state["step"] = "confirm"
            return self._handle_budget_input("fake_trigger", state)

        return {
            "message": (
                f"✅ Great choices! Cuisines: **{', '.join(collected['cuisine_preferences'])}**\n\n"
                "Last question: What's your **monthly dining budget** (in dollars)?\n\n"
                "Just enter a number (e.g., '500' or '750'):"
            ),
            "state": state
        }
    
    def _handle_budget_input(self, message: str, state: Dict) -> Dict:
        """Parse and store monthly budget."""
        # If triggered with fake msg from auto-skip, skip parsing
        collected = state["collected"]
        
        if message != "fake_trigger":
             self._parse_bulk_food_input(message, state)
             
        # Check if we have budget now
        if not collected.get("monthly_budget"):
             # Fallback explicit parse
            try:
                budget_str = message.strip().replace("$", "").replace(",", "")
                budget = float(budget_str)
                if budget > 0:
                    collected["monthly_budget"] = budget
            except:
                return {
                    "message": (
                        "I couldn't understand that budget. Please enter a number "
                        "like '500' or '750':"
                    ),
                    "state": state
                }

        budget = collected["monthly_budget"]
        state["step"] = "confirm"
        
        # Build confirmation summary
        dietary = collected.get("dietary_restrictions", [])
        cuisines = collected.get("cuisine_preferences", [])
        
        return {
            "message": (
                f"✅ Budget set to **${budget:.2f}/month**\n\n"
                "---\n"
                "📋 **Your Preferences Summary:**\n\n"
                f"🥗 Dietary: {', '.join(dietary) if dietary else 'None'}\n"
                f"🍽️ Cuisines: {', '.join(cuisines)}\n"
                f"💰 Budget: ${budget:.2f}/month\n\n"
                "---\n\n"
                "To save these preferences, I'll establish a **TrustLink** to securely store this data in your encrypted vault."
            ),
            "state": state,
            "ui_type": "buttons",
            "options": ["💾 Save Preference", "✏️ Edit"],
            "needs_consent": True,
            "consent_scope": [
                ConsentScope.VAULT_WRITE_FOOD.value,
                ConsentScope.VAULT_WRITE_FINANCE.value
            ]
        }
    
    def _handle_confirmation(
        self,
        message: str,
        state: Dict,
        user_id: UserID
    ) -> Dict:
        """Handle save confirmation - ISSUES CONSENT TOKEN on save."""
        msg_lower = message.lower().strip()
        
        if msg_lower in ["save", "yes", "confirm", "ok", "y"]:
            # === CONSENT PROTOCOL: Issue signed token ===
            consent_token = issue_token(
                user_id=user_id,
                agent_id=self.agent_id,
                scope=ConsentScope.VAULT_WRITE_FOOD
            )
            
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"🔐 Issued consent token for user {user_id}: {consent_token.token[:50]}...")
            
            # Mark as complete - include token for vault operations
            return {
                "message": (
                    "🎉 **Preferences saved successfully!**\n\n"
                    "I'll now use these to give you personalized restaurant "
                    "recommendations that match your dietary needs, favorite "
                    "cuisines, and budget.\n\n"
                    "🔐 *Private and secure via Hushh Consent Protocol*\n\n"
                    "Try asking me: 'Find me a good restaurant for dinner!'"
                ),
                "state": {"step": "complete", "collected": state["collected"]},
                "is_complete": True,
                # Include real consent token
                "consent_token": consent_token.token,
                "consent_scope": ConsentScope.VAULT_WRITE_FOOD.value,
                "consent_issued_at": consent_token.issued_at,
                "consent_expires_at": consent_token.expires_at
            }
        elif msg_lower in ["edit", "change", "redo"]:
            # Clear collected data and restart from dietary question
            new_state = {"step": "dietary", "collected": {}}
            return {
                "message": (
                    "No problem! Let's start over.\n\n"
                    "**Dietary Restrictions**\n\n"
                    "Do you have any of these?\n"
                    "• Vegetarian\n"
                    "• Vegan\n"
                    "• Gluten-free\n"
                    "• Dairy-free\n"
                    "• Nut-free\n"
                    "• Halal\n"
                    "• Kosher\n"
                    "• None\n\n"
                    "Just type them (e.g., 'vegan, gluten-free') or 'none':"
                ),
                "state": new_state
            }
        else:
            return {
                "message": "Please type **'save'** to establish TrustLink or **'edit'** to start over:",
                "state": state
            }


# Lazy loading to avoid heavy instantiation at import time
# (Critical for Cloud Run container startup)
_food_dining_agent = None

def get_food_dining_agent():
    """Get or create the singleton food dining agent instance."""
    global _food_dining_agent
    if _food_dining_agent is None:
        _food_dining_agent = HushhFoodDiningAgent()
    return _food_dining_agent
