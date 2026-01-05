# hushh_mcp/operons/kai/__init__.py

"""
Kai Operons

Consent-first, composable business logic for investment analysis.
Each operon is a single-purpose function with explicit TrustLink requirements.

Operons are the building blocks of Agent Kai's analysis pipeline.
"""

from .analysis import (
    analyze_fundamentals,
    analyze_sentiment,
    analyze_valuation,
)

from .calculators import (
    calculate_financial_ratios,
    calculate_sentiment_score,
    calculate_valuation_metrics,
)

from .storage import (
    store_decision_card,
    retrieve_decision_card,
    retrieve_decision_history,
)

__all__ = [
    # Analysis operons
    "analyze_fundamentals",
    "analyze_sentiment",
    "analyze_valuation",
    
    # Calculator operons
    "calculate_financial_ratios",
    "calculate_sentiment_score",
    "calculate_valuation_metrics",
    
    # Storage operons
    "store_decision_card",
    "retrieve_decision_card",
    "retrieve_decision_history",
]
