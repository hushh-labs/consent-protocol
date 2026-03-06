# mcp/config.py
"""
MCP Server configuration.
"""

import os


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.environ.get(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


# FastAPI backend URL (for consent API calls)
FASTAPI_URL = os.environ.get("CONSENT_API_URL", "http://localhost:8000")

# Frontend URL (for user-facing links - MUST match your deployment)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Production mode: requires user approval via dashboard
PRODUCTION_MODE = os.environ.get("PRODUCTION_MODE", "true").lower() == "true"
ENVIRONMENT = str(os.environ.get("ENVIRONMENT", "development")).strip().lower()
DEVELOPER_API_ENABLED = (
    False if ENVIRONMENT == "production" else _env_truthy("DEVELOPER_API_ENABLED", "true")
)

# MCP developer token (registered in FastAPI)
MCP_DEVELOPER_TOKEN = str(os.environ.get("MCP_DEVELOPER_TOKEN", "")).strip()

# How long to wait for user to approve consent (in seconds)
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

# ============================================================================
# SERVER INFO
# ============================================================================

SERVER_INFO = {
    "name": "Hushh Consent MCP Server",
    "version": "1.0.0",
    "protocol": "HushhMCP",
    "transport": "stdio",
    "description": "Consent-first personal data access for AI agents; no data without explicit user approval. Scopes are dynamic (from world model/registry); use discover_user_domains to get per-user scope strings.",
    "tools_count": 13,
    "tools": [
        {"name": "request_consent", "purpose": "Request user consent for a data scope"},
        {
            "name": "validate_token",
            "purpose": "Validate a consent token (signature, expiry, scope)",
        },
        {
            "name": "discover_user_domains",
            "purpose": "Discover which domains a user has and scope strings to request",
        },
        {
            "name": "list_scopes",
            "purpose": "List dynamic consent scope categories from backend registry",
        },
        {
            "name": "check_consent_status",
            "purpose": "Check status of a pending consent request",
        },
        {
            "name": "get_food_preferences",
            "purpose": "Get food/dining preferences (requires consent token)",
        },
        {
            "name": "get_professional_profile",
            "purpose": "Get professional profile (requires consent token)",
        },
        {"name": "delegate_to_agent", "purpose": "Create TrustLink for agent-to-agent delegation"},
        {"name": "list_ria_profiles", "purpose": "List discoverable marketplace RIA profiles"},
        {"name": "get_ria_profile", "purpose": "Get a discoverable RIA profile by ID"},
        {
            "name": "list_marketplace_investors",
            "purpose": "List discoverable opt-in investor marketplace profiles",
        },
        {
            "name": "get_ria_verification_status",
            "purpose": "Read verification status for an RIA user (requires VAULT_OWNER token)",
        },
        {
            "name": "get_ria_client_access_summary",
            "purpose": "Read relationship/access summary for an RIA user (requires VAULT_OWNER token)",
        },
    ],
    "compliance": [
        "Consent First",
        "Scoped Access",
        "Zero Knowledge",
        "Cryptographic Signatures",
        "TrustLink Delegation",
    ],
}

# ============================================================================
# SCOPE MAPPINGS
# ============================================================================

# Canonical scopes and legacy aliases.
# We keep legacy underscore inputs for backward compatibility, but normalize
# everything to canonical dot notation before sending to backend.
SCOPE_API_MAP = {
    "world_model.read": "world_model.read",
    "world_model.write": "world_model.write",
    "vault.owner": "vault.owner",
    "world_model_read": "world_model.read",
    "world_model_write": "world_model.write",
    "vault_owner": "vault.owner",
}


def resolve_scope_api(scope: str) -> str | None:
    """Resolve scope input to canonical dot notation.

    Accepts:
    - canonical static scopes (world_model.read/write, vault.owner)
    - canonical dynamic scopes (attr.{domain}.*, attr.{domain}.{subintent}.*,
      or specific paths like attr.{domain}.{attribute})
    - legacy underscore aliases (world_model_read, attr_financial, etc.)

    Returns None if scope format is invalid.
    """
    import re

    value = str(scope or "").strip()
    if not value:
        return None

    # Static / legacy alias normalization
    static = SCOPE_API_MAP.get(value)
    if static:
        return static

    # Canonical dynamic scope (domain, nested subintent, optional wildcard)
    if re.match(r"^attr\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*(?:\.\*)?$", value):
        return value

    # Legacy dynamic API format:
    # - attr_financial -> attr.financial.*
    # - attr_financial__profile -> attr.financial.profile.*
    legacy_match = re.match(r"^attr_([a-z][a-z0-9_]*(?:__[a-z][a-z0-9_]*)*)$", value)
    if legacy_match:
        parts = [segment for segment in legacy_match.group(1).split("__") if segment]
        if not parts:
            return None
        if len(parts) == 1:
            return f"attr.{parts[0]}.*"
        return f"attr.{parts[0]}.{'.'.join(parts[1:])}.*"

    return None
