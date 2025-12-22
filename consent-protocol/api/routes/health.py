# api/routes/health.py
"""
Health check endpoints.
"""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
def health_check():
    """Root health check."""
    return {"status": "ok", "service": "hushh-consent-protocol"}


@router.get("/health")
def health():
    """Detailed health check with agent list."""
    return {"status": "healthy", "agents": ["food_dining", "professional_profile"]}
