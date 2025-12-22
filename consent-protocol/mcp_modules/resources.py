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
        )
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
                "vault.read.food - Food & dining preferences",
                "vault.read.professional - Professional profile",
                "vault.read.finance - Financial data",
                "vault.write.* - Write scopes for each domain"
            ],
            "zero_knowledge": True,
            "server_sees_plaintext": False
        }
        return json.dumps(protocol_info, indent=2)
    
    else:
        logger.warning(f"❌ Unknown resource URI: {uri}")
        return json.dumps({"error": f"Unknown resource: {uri}"})
