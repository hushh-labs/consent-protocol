# mcp/resources.py
"""
MCP Resources (informational endpoints).
"""

import json

from mcp.types import Resource

from mcp_modules.config import SERVER_INFO


async def list_resources() -> list[Resource]:
    """List available MCP resources."""
    return [
        Resource(
            uri="hushh://info/server",
            name="Server Information",
            description="Hushh MCP Server version and capabilities",
            mimeType="application/json",
        ),
        Resource(
            uri="hushh://info/protocol",
            name="Protocol Information",
            description="HushhMCP protocol compliance details",
            mimeType="application/json",
        ),
        Resource(
            uri="hushh://info/connector",
            name="Connector usage and capabilities",
            description="What the Hushh connector does, tool list, recommended flow, and supported scopes",
            mimeType="application/json",
        ),
        Resource(
            uri="hushh://info/developer-api",
            name="Developer API Contract",
            description="Versioned developer API contract for dynamic scope discovery and consent requests",
            mimeType="application/json",
        ),
    ]


async def read_resource(uri: str) -> str:
    """Read MCP resource content by URI."""
    import logging

    logger = logging.getLogger("hushh-mcp-server")

    # Normalize: MCP SDK may pass AnyUrl; some hosts add trailing slash
    uri_str = str(uri).strip().rstrip("/")
    logger.info(f"📖 Reading resource: {uri_str}")

    if uri_str == "hushh://info/server":
        return json.dumps(SERVER_INFO, indent=2)

    elif uri_str == "hushh://info/protocol":
        protocol_info = {
            "name": "HushhMCP Protocol",
            "version": "1.0.0",
            "core_principles": [
                "🔐 Consent First - No data access without explicit user approval",
                "🎯 Scoped Access - Each data category requires separate consent",
                "✍️ Cryptographic Signatures - Tokens signed with HMAC-SHA256",
                "⏱️ Time-Limited - Tokens expire after configurable duration",
                "🔗 TrustLinks - Agent-to-agent delegation with proof",
            ],
            "token_format": "HCT:base64(user|agent|scope|issued|expires).signature",
            "scopes_are_dynamic": True,
            "scope_note": "Scopes are NOT a fixed list. They come from the world model registry and per-user metadata. Always use discover_user_domains(user_id) or GET /api/v1/user-scopes/{user_id} to get the actual scope strings for a user. Domains come from world_model_index_v2.available_domains; optional subintent scopes are inferred from domain summaries + domain_registry metadata.",
            "scope_examples": [
                "world_model.read - Full world model (all domains)",
                "world_model.write - Write to world model",
                "attr.{domain}.* - One discovered domain branch",
                "attr.{domain}.{subintent}.* - One discovered nested branch when metadata exposes subintents",
            ],
            "zero_knowledge": True,
            "server_sees_plaintext": False,
        }
        return json.dumps(protocol_info, indent=2)

    elif uri_str == "hushh://info/connector":
        connector_info = {
            "what": "The Hushh connector provides consent-first personal data access for AI agents. Data is only returned after explicit user approval. Zero-knowledge and scoped access apply where applicable.",
            "tools": [
                {
                    "name": "request_consent",
                    "purpose": "Request user consent for a scope",
                    "when_to_use": "Before accessing any user data; pass one scope returned by discover_user_domains(user_id)",
                },
                {
                    "name": "validate_token",
                    "purpose": "Validate a consent token",
                    "when_to_use": "Before using a token with get_scoped_data, compatibility tools, or external APIs",
                },
                {
                    "name": "discover_user_domains",
                    "purpose": "Discover user domains and scope strings",
                    "when_to_use": "First step to know which scopes to request for a user",
                },
                {
                    "name": "list_scopes",
                    "purpose": "List canonical dynamic scope patterns",
                    "when_to_use": "Static reference for scope shapes only; not a substitute for per-user scope discovery",
                },
                {
                    "name": "get_scoped_data",
                    "purpose": "Get the approved export payload for any valid consent token",
                    "when_to_use": "Recommended for all new integrations after consent is granted",
                },
                {
                    "name": "check_consent_status",
                    "purpose": "Check current status of pending consent",
                    "when_to_use": "After request_consent when status is pending",
                },
                {
                    "name": "get_financial_profile",
                    "purpose": "Compatibility-only named getter for finance-root integrations",
                    "when_to_use": "Only when maintaining an older named financial integration",
                },
                {
                    "name": "get_food_preferences",
                    "purpose": "Compatibility-only named getter for legacy food/dining integrations",
                    "when_to_use": "Only when maintaining an older named-domain integration",
                },
                {
                    "name": "get_professional_profile",
                    "purpose": "Compatibility-only named getter for legacy professional integrations",
                    "when_to_use": "Only when maintaining an older named-domain integration",
                },
                {
                    "name": "delegate_to_agent",
                    "purpose": "Create TrustLink for agent delegation",
                    "when_to_use": "When one agent needs to delegate access to another",
                },
                {
                    "name": "list_ria_profiles",
                    "purpose": "List discoverable RIA marketplace profiles (read-only)",
                    "when_to_use": "When building advisor discovery experiences",
                },
                {
                    "name": "get_ria_profile",
                    "purpose": "Get discoverable RIA profile details by id (read-only)",
                    "when_to_use": "After advisor selection from marketplace search",
                },
                {
                    "name": "list_marketplace_investors",
                    "purpose": "List discoverable opt-in investor profiles (read-only)",
                    "when_to_use": "When building RIA client discovery experiences",
                },
                {
                    "name": "get_ria_verification_status",
                    "purpose": "Get RIA verification status for a user (read-only)",
                    "when_to_use": "With same-user VAULT_OWNER token during advisor control-plane checks",
                },
                {
                    "name": "get_ria_client_access_summary",
                    "purpose": "Get RIA relationship/access summary (read-only)",
                    "when_to_use": "With same-user VAULT_OWNER token before advisor workspace actions",
                },
            ],
            "recommended_flow": [
                "1. discover_user_domains(user_id) to get domains and scope strings for this user",
                "2. request_consent(user_id, scope) for each scope needed (e.g. world_model.read or one discovered attr scope)",
                "3. If status is pending, return control to caller; user approves in app and caller can re-check status later",
                "4. Use the returned consent_token with get_scoped_data (recommended) or compatibility-only named getters",
            ],
            "scopes_are_dynamic": True,
            "supported_scopes": "world_model.read, world_model.write, attr.{domain}.*, attr.{domain}.{subintent}.*, and attr.{domain}.{path}. No fixed domain list.",
            "discover_scopes": "Call discover_user_domains(user_id) first to get this user's domains and scope strings. Backend uses GET /api/v1/user-scopes/{user_id} (developer-auth) and validates against world_model_index_v2 + domain_registry metadata.",
            "server_backend": "Backend: FastAPI consent API. Set CONSENT_API_URL if not using default (e.g. http://localhost:8000).",
            "consent_ui_required": "When request_consent returns 'pending', the user must approve in the Hushh app (consents/dashboard). Delivery is FCM-first in production; consent SSE/polling is disabled for this flow.",
            "compatibility_policy": "Named getters such as get_food_preferences and get_professional_profile remain compatibility surfaces only. New integrations should use get_scoped_data.",
        }
        return json.dumps(connector_info, indent=2)

    elif uri_str == "hushh://info/developer-api":
        developer_api_info = {
            "version": "v1",
            "base_path": "/api/v1",
            "dynamic_scopes": True,
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/api/v1/list-scopes",
                    "auth": "Developer API enabled",
                    "purpose": "Public generic scope catalog (patterns only, no user data)",
                },
                {
                    "method": "GET",
                    "path": "/api/v1/user-scopes/{user_id}",
                    "auth": "X-MCP-Developer-Token",
                    "purpose": "Per-user discovered scopes and available domains",
                },
                {
                    "method": "POST",
                    "path": "/api/v1/request-consent",
                    "auth": "developer_token body field or X-MCP-Developer-Token header",
                    "purpose": "Create or reuse consent for one discovered scope",
                },
            ],
            "requestable_scopes": [
                "world_model.read",
                "world_model.write",
                "attr.{domain}.*",
                "attr.{domain}.{subintent}.*",
                "attr.{domain}.{path}",
            ],
            "recommended_mcp_flow": [
                "discover_user_domains",
                "request_consent",
                "check_consent_status",
                "get_scoped_data",
            ],
            "scale_notes": [
                "Prefer discovered scopes over hardcoded domain keys.",
                "Treat named domain getters as compatibility-only surfaces.",
                "Use agent_id per integrating app or MCP server to keep consent state partitioned at scale.",
                "Cache scope catalogs briefly, but always expect runtime change when user data changes.",
            ],
        }
        return json.dumps(developer_api_info, indent=2)

    else:
        logger.warning(f"❌ Unknown resource URI: {uri_str}")
        return json.dumps({"error": f"Unknown resource: {uri_str}"})
