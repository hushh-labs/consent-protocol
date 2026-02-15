# api/routes/health.py
"""
Health check endpoints.
"""

import os

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
def health_check():
    """Root health check."""
    return {"status": "ok", "service": "hushh-consent-protocol"}


@router.get("/health")
def health():
    """Detailed health check with agent list."""
    return {"status": "healthy", "agents": ["kai"]}


@router.get("/api/app-config/review-mode")
def app_review_mode_config():
    """Runtime app-review-mode config served from backend env (not frontend build env)."""
    enabled = str(
        os.getenv("APP_REVIEW_MODE")
        or os.getenv("HUSHH_APP_REVIEW_MODE")
        or "false"
    ).lower() in {"1", "true", "yes", "on"}
    payload = {"enabled": enabled}
    if enabled:
        payload["reviewer_email"] = os.getenv("REVIEWER_EMAIL", "")
        payload["reviewer_password"] = os.getenv("REVIEWER_PASSWORD", "")
    return payload
