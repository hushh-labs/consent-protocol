# consent-protocol/hushh_mcp/services/domain_inferrer.py
"""
Domain Inferrer - Auto-categorizes attributes into domains.

Uses a rule engine with keywords and regex patterns to infer
the appropriate domain for an attribute key.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


# Domain inference rules
# Each domain has keywords and regex patterns for matching
DOMAIN_RULES: dict[str, dict] = {
    "financial": {
        "keywords": [
            "portfolio", "stock", "investment", "holdings", "risk", "dividend",
            "equity", "bond", "fund", "etf", "401k", "ira", "roth", "brokerage",
            "trading", "shares", "ticker", "market", "asset", "wealth", "capital",
            "return", "yield", "profit", "loss", "gain", "balance", "net_worth",
        ],
        "patterns": [
            r".*_ticker$",
            r".*_shares$",
            r".*_value$",
            r".*_portfolio.*",
            r".*_investment.*",
            r".*_stock.*",
            r"risk_.*",
            r".*_allocation$",
        ],
        "display_name": "Financial",
        "icon": "wallet",
        "color": "#D4AF37",
    },
    "subscriptions": {
        "keywords": [
            "subscription", "netflix", "spotify", "hulu", "disney", "hbo", "amazon",
            "prime", "apple", "youtube", "twitch", "patreon", "membership", "plan",
            "recurring", "monthly", "annual", "streaming", "service",
        ],
        "patterns": [
            r".*_subscription$",
            r".*_plan$",
            r".*_membership$",
            r".*_streaming$",
            r".*_service$",
        ],
        "display_name": "Subscriptions",
        "icon": "credit-card",
        "color": "#6366F1",
    },
    "health": {
        "keywords": [
            "health", "fitness", "weight", "blood", "heart", "sleep", "steps",
            "calories", "exercise", "workout", "gym", "nutrition", "diet",
            "bmi", "pulse", "pressure", "glucose", "cholesterol", "medication",
            "doctor", "medical", "wellness", "mental", "stress", "anxiety",
        ],
        "patterns": [
            r".*_health$",
            r".*_vitals$",
            r".*_fitness$",
            r".*_medical$",
            r"blood_.*",
            r"heart_.*",
        ],
        "display_name": "Health & Wellness",
        "icon": "heart",
        "color": "#EF4444",
    },
    "travel": {
        "keywords": [
            "travel", "flight", "hotel", "miles", "points", "rewards", "airline",
            "airport", "destination", "trip", "vacation", "booking", "reservation",
            "passport", "visa", "luggage", "itinerary", "cruise", "rental",
        ],
        "patterns": [
            r".*_miles$",
            r".*_points$",
            r".*_travel$",
            r".*_flight$",
            r".*_hotel$",
            r".*_booking$",
        ],
        "display_name": "Travel",
        "icon": "plane",
        "color": "#0EA5E9",
    },
    "food": {
        "keywords": [
            "food", "restaurant", "cuisine", "dietary", "meal", "recipe", "cooking",
            "ingredient", "allergy", "vegetarian", "vegan", "gluten", "organic",
            "delivery", "takeout", "reservation", "menu", "dish", "beverage",
        ],
        "patterns": [
            r".*_food$",
            r".*_cuisine$",
            r".*_dietary$",
            r".*_meal$",
            r".*_restaurant$",
            r"favorite_.*food.*",
        ],
        "display_name": "Food & Dining",
        "icon": "utensils",
        "color": "#F97316",
    },
    "professional": {
        "keywords": [
            "professional", "career", "job", "work", "skill", "experience",
            "resume", "linkedin", "employer", "salary", "title", "industry",
            "education", "degree", "certification", "portfolio", "project",
        ],
        "patterns": [
            r".*_professional$",
            r".*_career$",
            r".*_job$",
            r".*_skill.*",
            r".*_experience$",
            r"work_.*",
        ],
        "display_name": "Professional",
        "icon": "briefcase",
        "color": "#8B5CF6",
    },
    "entertainment": {
        "keywords": [
            "movie", "music", "game", "gaming", "show", "series", "podcast",
            "book", "reading", "concert", "event", "theater", "genre", "artist",
            "album", "playlist", "favorite", "watch", "listen", "play",
        ],
        "patterns": [
            r".*_movie.*",
            r".*_music.*",
            r".*_game.*",
            r".*_show.*",
            r"favorite_.*",
            r".*_genre$",
        ],
        "display_name": "Entertainment",
        "icon": "tv",
        "color": "#EC4899",
    },
    "shopping": {
        "keywords": [
            "shopping", "purchase", "order", "cart", "wishlist", "brand", "product",
            "price", "discount", "coupon", "sale", "store", "retail", "ecommerce",
            "amazon", "ebay", "etsy", "size", "color", "preference",
        ],
        "patterns": [
            r".*_shopping$",
            r".*_purchase.*",
            r".*_order.*",
            r".*_wishlist$",
            r".*_brand$",
            r"preferred_.*",
        ],
        "display_name": "Shopping",
        "icon": "shopping-bag",
        "color": "#14B8A6",
    },
    "social": {
        "keywords": [
            "social", "friend", "contact", "network", "connection", "follower",
            "following", "post", "share", "like", "comment", "message", "chat",
            "group", "community", "profile", "bio", "status",
        ],
        "patterns": [
            r".*_social$",
            r".*_friend.*",
            r".*_contact.*",
            r".*_network$",
        ],
        "display_name": "Social",
        "icon": "users",
        "color": "#3B82F6",
    },
    "location": {
        "keywords": [
            "location", "address", "city", "country", "zip", "postal", "region",
            "state", "latitude", "longitude", "gps", "checkin", "place", "venue",
            "home", "office", "favorite_place",
        ],
        "patterns": [
            r".*_location$",
            r".*_address$",
            r".*_city$",
            r".*_country$",
            r"home_.*",
            r"work_.*address.*",
        ],
        "display_name": "Location",
        "icon": "map-pin",
        "color": "#10B981",
    },
}


class DomainInferrer:
    """
    Infers the appropriate domain for an attribute key.
    
    Uses a rule engine with keywords and regex patterns to
    automatically categorize attributes into domains.
    """
    
    def __init__(self, rules: Optional[dict] = None):
        """
        Initialize the inferrer with optional custom rules.
        
        Args:
            rules: Custom domain rules to use instead of defaults
        """
        self.rules = rules or DOMAIN_RULES
        self._compiled_patterns: dict[str, list[re.Pattern]] = {}
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        for domain, config in self.rules.items():
            patterns = config.get("patterns", [])
            self._compiled_patterns[domain] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]
    
    def infer(self, attribute_key: str, value_hint: Optional[str] = None) -> str:
        """
        Infer the domain for an attribute key.
        
        Args:
            attribute_key: The attribute key to categorize
            value_hint: Optional hint from the value (e.g., for ambiguous keys)
        
        Returns:
            The inferred domain key, or 'general' if no match
        """
        # Normalize the key
        key_lower = attribute_key.lower().strip()
        key_parts = set(key_lower.replace("_", " ").replace("-", " ").split())
        
        # Track scores for each domain
        scores: dict[str, int] = {}
        
        for domain, config in self.rules.items():
            score = 0
            
            # Check keywords
            keywords = set(config.get("keywords", []))
            keyword_matches = key_parts & keywords
            score += len(keyword_matches) * 2  # Keywords worth 2 points each
            
            # Check if any keyword is a substring of the key
            for keyword in keywords:
                if keyword in key_lower:
                    score += 1
            
            # Check patterns
            for pattern in self._compiled_patterns.get(domain, []):
                if pattern.match(key_lower):
                    score += 3  # Pattern match worth 3 points
            
            # Check value hint if provided
            if value_hint:
                value_lower = value_hint.lower()
                for keyword in keywords:
                    if keyword in value_lower:
                        score += 1
            
            if score > 0:
                scores[domain] = score
        
        # Return domain with highest score, or 'general' if no matches
        if not scores:
            return "general"
        
        return max(scores, key=scores.get)
    
    def infer_with_confidence(
        self, attribute_key: str, value_hint: Optional[str] = None
    ) -> tuple[str, float]:
        """
        Infer domain with confidence score.
        
        Returns:
            Tuple of (domain_key, confidence) where confidence is 0.0-1.0
        """
        key_lower = attribute_key.lower().strip()
        key_parts = set(key_lower.replace("_", " ").replace("-", " ").split())
        
        scores: dict[str, int] = {}
        max_possible_score = 0
        
        for domain, config in self.rules.items():
            score = 0
            domain_max = 0
            
            # Keywords
            keywords = set(config.get("keywords", []))
            keyword_matches = key_parts & keywords
            score += len(keyword_matches) * 2
            domain_max += len(keywords) * 2
            
            # Substring matches
            for keyword in keywords:
                if keyword in key_lower:
                    score += 1
                    domain_max += 1
            
            # Patterns
            patterns = self._compiled_patterns.get(domain, [])
            for pattern in patterns:
                if pattern.match(key_lower):
                    score += 3
                domain_max += 3
            
            if score > 0:
                scores[domain] = score
            max_possible_score = max(max_possible_score, domain_max)
        
        if not scores:
            return ("general", 0.0)
        
        best_domain = max(scores, key=scores.get)
        best_score = scores[best_domain]
        
        # Calculate confidence as ratio of score to max possible
        confidence = min(1.0, best_score / max(1, max_possible_score))
        
        return (best_domain, confidence)
    
    def get_domain_metadata(self, domain_key: str) -> dict:
        """Get display metadata for a domain."""
        config = self.rules.get(domain_key, {})
        return {
            "display_name": config.get("display_name", domain_key.title()),
            "icon": config.get("icon", "folder"),
            "color": config.get("color", "#6B7280"),
        }
    
    def add_rule(
        self,
        domain_key: str,
        keywords: Optional[list[str]] = None,
        patterns: Optional[list[str]] = None,
        display_name: Optional[str] = None,
        icon: Optional[str] = None,
        color: Optional[str] = None,
    ):
        """
        Add or update a domain rule.
        
        Args:
            domain_key: The domain key
            keywords: List of keywords to match
            patterns: List of regex patterns to match
            display_name: Display name for UI
            icon: Lucide icon name
            color: Hex color code
        """
        if domain_key not in self.rules:
            self.rules[domain_key] = {
                "keywords": [],
                "patterns": [],
                "display_name": domain_key.title(),
                "icon": "folder",
                "color": "#6B7280",
            }
        
        if keywords:
            existing = set(self.rules[domain_key].get("keywords", []))
            existing.update(keywords)
            self.rules[domain_key]["keywords"] = list(existing)
        
        if patterns:
            existing = self.rules[domain_key].get("patterns", [])
            existing.extend(patterns)
            self.rules[domain_key]["patterns"] = list(set(existing))
            # Recompile patterns
            self._compiled_patterns[domain_key] = [
                re.compile(p, re.IGNORECASE) for p in self.rules[domain_key]["patterns"]
            ]
        
        if display_name:
            self.rules[domain_key]["display_name"] = display_name
        if icon:
            self.rules[domain_key]["icon"] = icon
        if color:
            self.rules[domain_key]["color"] = color
    
    def list_domains(self) -> list[str]:
        """List all known domain keys."""
        return list(self.rules.keys())


# Singleton instance
_domain_inferrer: Optional[DomainInferrer] = None


def get_domain_inferrer() -> DomainInferrer:
    """Get singleton DomainInferrer instance."""
    global _domain_inferrer
    if _domain_inferrer is None:
        _domain_inferrer = DomainInferrer()
    return _domain_inferrer
