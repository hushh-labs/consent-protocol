#!/usr/bin/env python3
"""
Hushh MCP Server - Production Grade
====================================

Consent-first personal data access for AI agents.

This MCP Server exposes the Hushh consent protocol to any MCP Host,
enabling AI agents to access user data ONLY with explicit, cryptographic consent.

Compliant with:
- MCP Specification (JSON-RPC 2.0, stdio transport)
- HushhMCP Protocol (consent tokens, TrustLinks, scoped access)

Run with: python mcp_server.py
Configure Claude Desktop: See docs/mcp-setup.md

Modular architecture:
- mcp/config.py: Server configuration
- mcp/tools/: Tool handlers
- mcp/resources.py: MCP resources
"""

import asyncio
import json
import logging
import sys

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent

from mcp_modules import resources as mcp_resources

# Import modular components
from mcp_modules.config import SERVER_INFO
from mcp_modules.tools import (
    get_tool_definitions,
    handle_check_consent_status,
    handle_delegate,
    handle_discover_user_domains,
    handle_get_financial,
    handle_get_food,
    handle_get_professional,
    handle_list_scopes,
    handle_request_consent,
    handle_validate_token,
)

# ============================================================================
# LOGGING CONFIGURATION
# IMPORTANT: Only use stderr - stdout is reserved for JSON-RPC messages
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='[HUSHH-MCP] %(levelname)s: %(message)s',
    stream=sys.stderr  # CRITICAL: Don't pollute stdout
)
logger = logging.getLogger("hushh-mcp-server")


# ============================================================================
# SERVER INITIALIZATION
# ============================================================================

server = Server("hushh-consent")


# ============================================================================
# TOOL DEFINITIONS
# ============================================================================

@server.list_tools()
async def list_tools():
    """Expose Hushh consent tools to MCP hosts."""
    return get_tool_definitions()


# ============================================================================
# TOOL CALL ROUTER
# ============================================================================

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """
    Route tool calls to appropriate handlers.
    
    Compliance: MCP tools/call specification
    Logging: All calls logged for audit trail
    """
    logger.info(f"🔧 Tool called: {name}")
    logger.info(f"   Arguments: {json.dumps(arguments, default=str)}")
    
    handlers = {
        "request_consent": handle_request_consent,
        "validate_token": handle_validate_token,
        "get_financial_profile": handle_get_financial,
        "get_food_preferences": handle_get_food,
        "get_professional_profile": handle_get_professional,
        "delegate_to_agent": handle_delegate,
        "list_scopes": handle_list_scopes,
        "discover_user_domains": handle_discover_user_domains,
        "check_consent_status": handle_check_consent_status,
    }
    
    handler = handlers.get(name)
    if not handler:
        logger.warning(f"❌ Unknown tool requested: {name}")
        return [TextContent(type="text", text=json.dumps({
            "error": f"Unknown tool: {name}",
            "available_tools": list(handlers.keys())
        }))]
    
    try:
        result = await handler(arguments)
        logger.info(f"✅ Tool {name} completed successfully")
        return result
    except Exception as e:
        logger.error(f"❌ Tool {name} failed: {str(e)}")
        return [TextContent(type="text", text=json.dumps({
            "error": str(e),
            "tool": name,
            "status": "failed"
        }))]


# ============================================================================
# MCP RESOURCES
# ============================================================================

@server.list_resources()
async def list_resources():
    """List available MCP resources."""
    return await mcp_resources.list_resources()


@server.read_resource()
async def read_resource(uri: str):
    """Read MCP resource content by URI."""
    return await mcp_resources.read_resource(uri)


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

async def main():
    """
    Run the Hushh MCP Server.
    
    Transport: stdio (for Claude Desktop, Cursor, and other MCP hosts)
    Protocol: JSON-RPC 2.0
    Compliance: HushhMCP (consent-first personal data access)
    """
    logger.info("=" * 60)
    logger.info("🚀 HUSHH MCP SERVER STARTING")
    logger.info("=" * 60)
    logger.info(f"   Name: {SERVER_INFO['name']}")
    logger.info(f"   Version: {SERVER_INFO['version']}")
    logger.info(f"   Protocol: {SERVER_INFO['protocol']}")
    logger.info(f"   Transport: {SERVER_INFO['transport']}")
    logger.info(f"   Tools: {SERVER_INFO['tools_count']} consent tools exposed")
    logger.info("")
    logger.info("   Compliance:")
    for item in SERVER_INFO['compliance']:
        logger.info(f"     ✅ {item}")
    logger.info("")
    logger.info("   Ready to receive connections from MCP hosts...")
    logger.info("=" * 60)
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
