# consent-protocol/server.py
"""
FastAPI Server for Hushh Consent Protocol Agents

Modular architecture with routes organized in api/routes/ directory.
Run with: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import route modules
from api.routes import health, agents, consent, developer, session, db_proxy, sse, kai

# Import rate limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.middlewares.rate_limit import limiter

# Dynamic root_path for Swagger docs in production
# Set ROOT_PATH env var to your production URL to fix Swagger showing localhost
root_path = os.environ.get("ROOT_PATH", "")

app = FastAPI(
    title="Hushh Consent Protocol API",
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

# Kai investor onboarding routes (/api/kai/...)
app.include_router(kai.router)

logger.info("🚀 Hushh Consent Protocol server initialized with modular routes")


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
