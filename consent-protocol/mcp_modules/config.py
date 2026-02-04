# mcp/config.py
"""
MCP Server configuration.
"""

import os

# FastAPI backend URL (for consent API calls)
FASTAPI_URL = os.environ.get("CONSENT_API_URL", "http://localhost:8000")

# Frontend URL (for user-facing links - MUST match your deployment)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Production mode: requires user approval via dashboard
PRODUCTION_MODE = os.environ.get("PRODUCTION_MODE", "true").lower() == "true"

# MCP developer token (registered in FastAPI)
MCP_DEVELOPER_TOKEN = os.environ.get("MCP_DEVELOPER_TOKEN", "mcp_dev_claude_desktop")

# ============================================================================
# CONSENT POLLING CONFIGURATION
# ============================================================================

# How long to wait for user to approve consent (in seconds)
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

# How often to poll for consent approval (in seconds)
CONSENT_POLL_INTERVAL_SECONDS = int(os.environ.get("CONSENT_POLL_INTERVAL_SECONDS", "5"))

# ============================================================================
# SERVER INFO
# ============================================================================

SERVER_INFO = {
    "name": "Hushh Consent MCP Server",
    "version": "1.0.0",
    "protocol": "HushhMCP",
    "transport": "stdio",
    "description": "Consent-first personal data access for AI agents; no data without explicit user approval.",
    "tools_count": 8,
    "tools": [
        {"name": "request_consent", "purpose": "Request user consent for a data scope"},
        {"name": "validate_token", "purpose": "Validate a consent token (signature, expiry, scope)"},
        {"name": "discover_user_domains", "purpose": "Discover which domains a user has and scope strings to request"},
        {"name": "list_scopes", "purpose": "List available consent scope categories (static examples)"},
        {"name": "check_consent_status", "purpose": "Poll status of a pending consent request until granted or denied"},
        {"name": "get_food_preferences", "purpose": "Get food/dining preferences (requires consent token)"},
        {"name": "get_professional_profile", "purpose": "Get professional profile (requires consent token)"},
        {"name": "delegate_to_agent", "purpose": "Create TrustLink for agent-to-agent delegation"},
    ],
    "compliance": [
        "Consent First",
        "Scoped Access",
        "Zero Knowledge",
        "Cryptographic Signatures",
        "TrustLink Delegation"
    ]
}

# ============================================================================
# SCOPE MAPPINGS
# ============================================================================

# Map MCP scope strings (dot notation) to API format. Only world-model scopes are supported.
SCOPE_API_MAP = {
    "world_model.read": "world_model_read",
    "attr.food.*": "attr_food",
    "attr.professional.*": "attr_professional",
    "attr.financial.*": "attr_financial",
    "attr.health.*": "attr_health",
    "attr.kai_decisions.*": "attr_kai_decisions",
}
