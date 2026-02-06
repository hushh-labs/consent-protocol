# consent-protocol/server.py
"""
FastAPI Server for Hushh Consent Protocol Agents

Modular architecture with routes organized in api/routes/ directory.
Run with: uvicorn server:app --reload --port 8000
"""

import logging
import os
import time

from dotenv import load_dotenv

# Load .env file before any other imports that might depend on it
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import route modules
# Import rate limiting
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

from api.middlewares.rate_limit import limiter  # noqa: E402
from api.routes import (  # noqa: E402
    agents,
    consent,
    db_proxy,
    debug_firebase,
    developer,
    health,
    notifications,
    session,
    sse,
)

# Dynamic root_path for Swagger docs in production
# Set ROOT_PATH env var to your production URL to fix Swagger showing localhost
root_path = os.environ.get("ROOT_PATH", "")

app = FastAPI(
    title="Hushh Consent Protocol API - DIAGNOSTICS",
    description="Agent endpoints for the Hushh Personal Data Agent system",
    version="1.0.0",
    root_path=root_path,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - Dynamic origins based on environment
# Add FRONTEND_URL env var for production deployments
cors_origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "http://10.0.0.177:3000",
]

# Add production frontend URL if set
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    cors_origins.append(frontend_url)
    logger.info(f"✅ Added CORS origin from FRONTEND_URL: {frontend_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.run\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# REGISTER ROUTERS
# ============================================================================

# Health check routes (/, /health)
app.include_router(health.router)

# Agent chat routes (/api/agents/...)
app.include_router(agents.router)

# Consent management routes (/api/consent/...)
app.include_router(consent.router)

# Developer API v1 routes (/api/v1/...)
app.include_router(developer.router)

# Session token routes (/api/consent/issue-token, /api/user/lookup, etc.)
app.include_router(session.router)

# Database proxy routes (/db/vault/...) - for iOS native app
app.include_router(db_proxy.router)

# SSE routes for real-time consent notifications (/api/consent/events/...)
app.include_router(sse.router)

# Push notification token registration (/api/notifications/register)
app.include_router(notifications.router)

# Dev-only debug routes (/api/_debug/...)
app.include_router(debug_firebase.router)

# Kai investor analysis routes (/api/kai/...) - NEW MODULAR STRUCTURE
# This imports the combined router from the kai package which includes:
# - health, consent, analyze, stream, decisions, preferences
from api.routes.kai import router as kai_router  # noqa: E402

app.include_router(kai_router)

# Phase 2: Investor Profiles (Public Discovery Layer)
from api.routes import investors  # noqa: E402

app.include_router(investors.router)

# Phase 2: Identity Resolution (Consent-then-encrypt flow)
from api.routes import identity  # noqa: E402

app.include_router(identity.router)

# Phase 6: Fundamental Analysis Agent
from api.routes import analysis  # noqa: E402

app.include_router(analysis.router)

# Phase 7: World Model (Dynamic Domain Management)
from api.routes import world_model  # noqa: E402

app.include_router(world_model.router)

# Onboarding Tour (User onboarding completion tracking)
from api.routes import onboarding  # noqa: E402

app.include_router(onboarding.router)

# Force reload check - onboarding registered

logger.info("🚀 Hushh Consent Protocol server initialized with modular routes - KAI V2 + PHASE 2 + WORLD MODEL ENABLED")


# ============================================================================
# CONSENT NOTIFY LISTENER (event-driven SSE + push)
# ============================================================================

@app.on_event("startup")
async def startup_consent_listener():
    """Start background task that LISTENs to consent_audit_new (NOTIFY)."""
    import asyncio
    from api.consent_listener import run_consent_listener
    asyncio.create_task(run_consent_listener())


# ============================================================================
# RUN
# ============================================================================

@app.get("/debug/diagnostics", tags=["Debug"])
async def diagnostics():
    """List all registered routes to debug 404s."""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "name": route.name,
                "methods": list(route.methods) if route.methods else []
            })
            
    return {
        "status": "ok",
        "timestamp": time.time(),
        "routes_count": len(routes),
        "routes": sorted(routes, key=lambda x: x["path"])
    }


@app.get("/debug/consent-listener", tags=["Debug"])
async def debug_consent_listener():
    """Consent NOTIFY listener status: listener_active, queue_count, notify_received_count.
    Use to confirm the listener is running and that NOTIFY is being received."""
    from api.consent_listener import get_consent_listener_status
    return get_consent_listener_status()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104
