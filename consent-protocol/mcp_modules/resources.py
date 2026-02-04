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
            mimeType="application/json"
        ),
        Resource(
            uri="hushh://info/protocol",
            name="Protocol Information",
            description="HushhMCP protocol compliance details",
            mimeType="application/json"
        ),
        Resource(
            uri="hushh://info/connector",
            name="Connector usage and capabilities",
            description="What the Hushh connector does, tool list, recommended flow, and supported scopes",
            mimeType="application/json"
        ),
    ]


async def read_resource(uri: str) -> str:
    """Read MCP resource content by URI."""
    import logging
    logger = logging.getLogger("hushh-mcp-server")
    
    logger.info(f"📖 Reading resource: {uri}")
    
    if uri == "hushh://info/server":
        return json.dumps(SERVER_INFO, indent=2)
    
    elif uri == "hushh://info/protocol":
        protocol_info = {
            "name": "HushhMCP Protocol",
            "version": "1.0.0",
            "core_principles": [
                "🔐 Consent First - No data access without explicit user approval",
                "🎯 Scoped Access - Each data category requires separate consent",
                "✍️ Cryptographic Signatures - Tokens signed with HMAC-SHA256",
                "⏱️ Time-Limited - Tokens expire after configurable duration",
                "🔗 TrustLinks - Agent-to-agent delegation with proof"
            ],
            "token_format": "HCT:base64(user|agent|scope|issued|expires).signature",
            "supported_scopes": [
                "world_model.read - Full world model (all domains)",
                "world_model.write - Write to world model",
                "attr.financial.* - Financial domain attributes",
                "attr.food.* - Food/dining domain attributes",
                "attr.health.* - Health domain attributes",
                "attr.professional.* - Professional profile domain attributes",
                "attr.kai_decisions.* - Kai decision history and writes"
            ],
            "scope_note": "Domains are dynamic; use discover_user_domains(user_id) or GET /api/world-model/metadata/{user_id} or GET /api/world-model/scopes/{user_id} to get per-user domains and scope strings.",
            "zero_knowledge": True,
            "server_sees_plaintext": False
        }
        return json.dumps(protocol_info, indent=2)

    elif uri == "hushh://info/connector":
        connector_info = {
            "what": "The Hushh connector provides consent-first personal data access for AI agents. Data is only returned after explicit user approval. Zero-knowledge and scoped access apply where applicable.",
            "tools": [
                {"name": "request_consent", "purpose": "Request user consent for a scope", "when_to_use": "Before accessing any user data; pass scope from discover_user_domains or list_scopes"},
                {"name": "validate_token", "purpose": "Validate a consent token", "when_to_use": "Before using a token with get_* tools or external APIs"},
                {"name": "discover_user_domains", "purpose": "Discover user domains and scope strings", "when_to_use": "First step to know which scopes to request for a user"},
                {"name": "list_scopes", "purpose": "List available scope categories", "when_to_use": "Static reference for scope names if not using discover_user_domains"},
                {"name": "check_consent_status", "purpose": "Poll pending consent until granted/denied", "when_to_use": "After request_consent when status is pending"},
                {"name": "get_food_preferences", "purpose": "Get food/dining preferences", "when_to_use": "After consent for attr.food.* or world_model.read"},
                {"name": "get_professional_profile", "purpose": "Get professional profile", "when_to_use": "After consent for attr.professional.* or world_model.read"},
                {"name": "delegate_to_agent", "purpose": "Create TrustLink for agent delegation", "when_to_use": "When one agent needs to delegate access to another"},
            ],
            "recommended_flow": [
                "1. discover_user_domains(user_id) to get domains and scope strings for this user",
                "2. request_consent(user_id, scope) for each scope needed (e.g. world_model.read or attr.food.*)",
                "3. If status is pending, poll check_consent_status(user_id, scope) until granted or denied",
                "4. Use the returned consent_token with get_* tools or world-model data APIs",
            ],
            "supported_scopes": [
                "world_model.read",
                "world_model.write",
                "attr.{domain}.* (e.g. attr.financial.*, attr.food.*, attr.kai_decisions.*; domain from discover_user_domains or metadata)"
            ],
            "server_backend": "Backend: FastAPI consent API. Set CONSENT_API_URL if not using default (e.g. http://localhost:8000)."
        }
        return json.dumps(connector_info, indent=2)

    else:
        logger.warning(f"❌ Unknown resource URI: {uri}")
        return json.dumps({"error": f"Unknown resource: {uri}"})
