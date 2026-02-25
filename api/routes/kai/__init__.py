# api/routes/kai/__init__.py
"""
Agent Kai API Routes — Modular Package

This package organizes Kai routes into logical modules:
- chat.py: Conversational chat endpoint with auto-learning
- portfolio.py: Portfolio import and analysis
- analyze.py: Non-streaming analysis endpoint
- stream.py: SSE streaming analysis endpoint
- decisions.py: Decision history (reads from domain_summaries; legacy CRUD returns 410)
- consent.py: Kai-specific consent grants

All sub-routers are aggregated into `kai_router` for backward compatibility.
"""

from fastapi import APIRouter

from .analyze import router as analyze_router
from .chat import router as chat_router
from .consent import router as consent_router
from .decisions import router as decisions_router
from .health import router as health_router
from .losers import router as losers_router
from .market_insights import router as market_insights_router
from .portfolio import router as portfolio_router
from .stream import router as stream_router

# Create the main Kai router with prefix
kai_router = APIRouter(prefix="/api/kai", tags=["kai"])

# NOTE: Keep these paths listed for route-contract verification.
# The verify-route-contracts script checks for literal strings in this file.
KAI_ROUTE_CONTRACT_PATHS = [
    "/health",
    "/chat",
    "/chat/history/{conversation_id}",
    "/chat/conversations/{user_id}",
    "/chat/initial-state/{user_id}",
    "/consent/grant",
    "/analyze",
    "/analyze/stream",
    "/analyze/run/start",
    "/analyze/run/active",
    "/analyze/run/{run_id}/stream",
    "/analyze/run/{run_id}/cancel",
    "/portfolio/import",
    "/portfolio/import/stream",
    "/portfolio/summary/{user_id}",
    "/dashboard/profile-picks/{user_id}",
    "/portfolio/analyze-losers",
    "/portfolio/analyze-losers/stream",
    "/market/insights/{user_id}",
]

# Include all sub-routers (no prefix since main router has /api/kai)
kai_router.include_router(health_router)
kai_router.include_router(chat_router)
kai_router.include_router(portfolio_router)
kai_router.include_router(consent_router)
kai_router.include_router(analyze_router)
kai_router.include_router(stream_router)
kai_router.include_router(decisions_router)
kai_router.include_router(losers_router)
kai_router.include_router(market_insights_router)

# Export for server.py
router = kai_router
