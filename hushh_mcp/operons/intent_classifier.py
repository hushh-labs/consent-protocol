# hushh_mcp/operons/intent_classifier.py

"""
Intent Classification Operon

Pure function to classify user intent and route to the appropriate domain agent.
This is the core logic for the Orchestrator's routing decisions.
"""

from typing import Tuple
from enum import Enum


class IntentDomain(str, Enum):
    """Supported intent domains"""
    FOOD_DINING = "food_dining"
    PROFESSIONAL = "professional"
    FINANCE = "finance"
    HEALTH = "health"
    TRAVEL = "travel"
    GENERAL = "general"
    UNKNOWN = "unknown"


# Domain keywords for classification
DOMAIN_KEYWORDS = {
    IntentDomain.FOOD_DINING: [
        "food", "eat", "restaurant", "dining", "diet", "dietary", "cuisine",
        "meal", "vegetarian", "vegan", "gluten", "allergy", "allergies",
        "budget", "cooking", "recipe", "lunch", "dinner", "breakfast",
        "snack", "nutrition", "hungry", "preference", "preferences"
    ],
    IntentDomain.PROFESSIONAL: [
        "resume", "job", "career", "work", "experience", "skill", "skills",
        "education", "degree", "certification", "linkedin", "portfolio",
        "interview", "salary", "employment", "professional", "hire"
    ],
    IntentDomain.FINANCE: [
        "money", "spend", "spending", "bank", "account", "investment",
        "savings", "expense", "expenses", "transaction", "credit",
        "debit", "loan", "mortgage", "stock", "crypto", "financial"
    ],
    IntentDomain.HEALTH: [
        "health", "fitness", "exercise", "workout", "wellness", "medical",
        "doctor", "medicine", "sleep", "meditation", "mental", "therapy"
    ],
    IntentDomain.TRAVEL: [
        "travel", "trip", "vacation", "flight", "hotel", "booking",
        "destination", "airport", "passport", "visa", "tourism"
    ]
}

# Agent mapping
DOMAIN_TO_AGENT = {
    IntentDomain.FOOD_DINING: "agent_food_dining",
    IntentDomain.PROFESSIONAL: "agent_professional_profile",
    IntentDomain.FINANCE: "agent_finance",
    IntentDomain.HEALTH: "agent_health_wellness",
    IntentDomain.TRAVEL: "agent_travel",
    IntentDomain.GENERAL: "agent_orchestrator",
    IntentDomain.UNKNOWN: "agent_orchestrator"
}


def classify_intent(user_message: str) -> Tuple[IntentDomain, str, float]:
    """
    Classify user intent to determine which domain agent should handle it.
    
    Args:
        user_message: The user's input text
        
    Returns:
        Tuple of (domain, agent_id, confidence)
        
    Example:
        >>> domain, agent, conf = classify_intent("I want to set my food preferences")
        >>> print(domain)
        IntentDomain.FOOD_DINING
        >>> print(agent)
        agent_food_dining
        >>> print(conf)
        0.85
    """
    if not user_message or not isinstance(user_message, str):
        return IntentDomain.UNKNOWN, DOMAIN_TO_AGENT[IntentDomain.UNKNOWN], 0.0
    
    message_lower = user_message.lower()
    
    # Score each domain
    scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in message_lower)
        if score > 0:
            scores[domain] = score
    
    if not scores:
        return IntentDomain.GENERAL, DOMAIN_TO_AGENT[IntentDomain.GENERAL], 0.3
    
    # Get domain with highest score
    best_domain = max(scores, key=scores.get)
    best_score = scores[best_domain]
    
    # Calculate confidence (0-1 scale)
    # More keyword matches = higher confidence
    confidence = min(1.0, 0.5 + (best_score * 0.1))
    
    return best_domain, DOMAIN_TO_AGENT[best_domain], confidence


def get_domain_description(domain: IntentDomain) -> str:
    """
    Get a human-readable description for a domain.
    
    Args:
        domain: The intent domain
        
    Returns:
        Human-readable description
    """
    descriptions = {
        IntentDomain.FOOD_DINING: "Food & Dining preferences, dietary restrictions, and restaurant recommendations",
        IntentDomain.PROFESSIONAL: "Professional profile, resume, skills, and career data",
        IntentDomain.FINANCE: "Financial data, spending analysis, and budget management",
        IntentDomain.HEALTH: "Health, fitness, and wellness information",
        IntentDomain.TRAVEL: "Travel preferences and trip planning",
        IntentDomain.GENERAL: "General assistance and information",
        IntentDomain.UNKNOWN: "Unclear intent - please clarify"
    }
    return descriptions.get(domain, "Unknown domain")


def should_delegate(domain: IntentDomain) -> bool:
    """
    Check if this domain should be delegated to a specialized agent.
    
    Args:
        domain: The classified domain
        
    Returns:
        True if delegation is needed, False if orchestrator should handle
    """
    return domain not in [IntentDomain.GENERAL, IntentDomain.UNKNOWN]
