# api/routes/kai/__init__.py
"""
Agent Kai API Routes — Modular Package

This package organizes Kai routes into logical modules:
- analyze.py: Non-streaming analysis endpoint
- stream.py: SSE streaming analysis endpoint
- decisions.py: Decision history CRUD
- preferences.py: User preferences CRUD
- consent.py: Kai-specific consent grants

All sub-routers are aggregated into `kai_router` for backward compatibility.
"""

from fastapi import APIRouter

# Create the main Kai router with prefix
kai_router = APIRouter(prefix="/api/kai", tags=["kai"])

# Import and include sub-routers
from .consent import router as consent_router
from .analyze import router as analyze_router
from .stream import router as stream_router
from .decisions import router as decisions_router
from .preferences import router as preferences_router
from .health import router as health_router

# Include all sub-routers (no prefix since main router has /api/kai)
kai_router.include_router(health_router)
kai_router.include_router(consent_router)
kai_router.include_router(analyze_router)
kai_router.include_router(stream_router)
kai_router.include_router(decisions_router)
kai_router.include_router(preferences_router)

# Export for server.py
router = kai_router
