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
    "tools_count": 7,
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

# Map MCP scope strings to API format
SCOPE_API_MAP = {
    "vault.read.food": "vault_read_food",
    "vault.read.professional": "vault_read_professional",
    "vault.read.finance": "vault_read_finance",
    # "vault.read.all" - DISABLED for MCP (security)
}
