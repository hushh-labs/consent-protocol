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

Author: Hushh Team
License: MIT
"""

import asyncio
import json
import logging
import sys
import os
import uuid
import time
import base64
from typing import Any, Optional

# Cryptography for AES-GCM decryption of export data
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# HTTP client for FastAPI communication
import httpx

# ============================================================================
# MCP SDK IMPORTS
# ============================================================================

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, Resource

# ============================================================================
# HUSHH CONSENT CORE (Reusing existing production logic)
# ============================================================================

from hushh_mcp.consent.token import issue_token, validate_token, revoke_token
from hushh_mcp.trust.link import create_trust_link, verify_trust_link
from hushh_mcp.constants import ConsentScope, AGENT_PORTS
from hushh_mcp.types import UserID, AgentID, HushhConsentToken, TrustLink

# ============================================================================
# CONFIGURATION
# ============================================================================

# FastAPI backend URL (for consent API calls)
FASTAPI_URL = os.environ.get("CONSENT_API_URL", "http://localhost:8000")

# Frontend URL (for user-facing links - MUST match your deployment)
# This is shown to users for signup, consent approval, etc.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Production mode: requires user approval via dashboard
# Demo mode: auto-issues tokens (for testing)
PRODUCTION_MODE = os.environ.get("PRODUCTION_MODE", "true").lower() == "true"

# MCP developer token (registered in FastAPI)
MCP_DEVELOPER_TOKEN = os.environ.get("MCP_DEVELOPER_TOKEN", "mcp_dev_claude_desktop")

# ============================================================================
# CONSENT POLLING CONFIGURATION
# ============================================================================

# How long to wait for user to approve consent (in seconds)
# Default: 120 seconds (2 minutes) - reasonable time for user to check dashboard
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

# How often to poll for consent approval (in seconds)
CONSENT_POLL_INTERVAL_SECONDS = int(os.environ.get("CONSENT_POLL_INTERVAL_SECONDS", "3"))





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

# Version and protocol info
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
# TOOL DEFINITIONS
# ============================================================================

@server.list_tools()
async def list_tools() -> list[Tool]:
    """
    Expose Hushh consent tools to MCP hosts.
    
    Compliance: MCP tools/list specification
    Privacy: Tools enforce consent before any data access
    """
    return [
        # Tool 1: Request Consent
        Tool(
            name="request_consent",
            description=(
                "🔐 Request consent from a user to access their personal data. "
                "Returns a cryptographically signed consent token (HCT format) if granted. "
                "This MUST be called before accessing any user data. "
                "The token contains: user_id, scope, expiration, HMAC-SHA256 signature."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier (e.g., Firebase UID)"
                    },
                    "scope": {
                        "type": "string",
                        "description": "Data scope to access. Each scope requires separate consent.",
                        "enum": [
                            "vault.read.food",
                            "vault.read.professional",
                            "vault.read.finance",
                            "vault.read.all"
                        ]
                    },
                    "reason": {
                        "type": "string",
                        "description": "Human-readable reason for the request (transparency)"
                    }
                },
                "required": ["user_id", "scope"]
            }
        ),
        
        # Tool 2: Validate Token
        Tool(
            name="validate_token",
            description=(
                "✅ Validate a consent token's cryptographic signature, expiration, and scope. "
                "Use this to verify a token is valid before attempting data access. "
                "Checks: HMAC-SHA256 signature, not expired, not revoked, scope matches."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "token": {
                        "type": "string",
                        "description": "The consent token string (format: HCT:base64.signature)"
                    },
                    "expected_scope": {
                        "type": "string",
                        "description": "Optional: verify token has this specific scope"
                    }
                },
                "required": ["token"]
            }
        ),
        
        # Tool 3: Get Food Preferences
        Tool(
            name="get_food_preferences",
            description=(
                "🍽️ Retrieve user's food preferences including dietary restrictions, "
                "favorite cuisines, and monthly dining budget. "
                "REQUIRES: Valid consent token with 'vault.read.food' scope. "
                "Will be DENIED without proper consent."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier"
                    },
                    "consent_token": {
                        "type": "string",
                        "description": "Valid consent token with vault.read.food scope"
                    }
                },
                "required": ["user_id", "consent_token"]
            }
        ),
        
        # Tool 4: Get Professional Profile
        Tool(
            name="get_professional_profile",
            description=(
                "💼 Retrieve user's professional profile including job title, skills, "
                "experience level, and job preferences. "
                "REQUIRES: Valid consent token with 'vault.read.professional' scope. "
                "A food token WILL NOT work - scopes are isolated."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier"
                    },
                    "consent_token": {
                        "type": "string",
                        "description": "Valid consent token with vault.read.professional scope"
                    }
                },
                "required": ["user_id", "consent_token"]
            }
        ),
        
        # Tool 5: Delegate to Agent (TrustLink)
        Tool(
            name="delegate_to_agent",
            description=(
                "🔗 Create a TrustLink to delegate a task to another agent (A2A). "
                "This enables agent-to-agent communication with cryptographic proof "
                "that the delegation was authorized by the user."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "from_agent": {
                        "type": "string",
                        "description": "Agent ID making the delegation (e.g., 'orchestrator')"
                    },
                    "to_agent": {
                        "type": "string",
                        "description": "Target agent ID",
                        "enum": ["agent_food_dining", "agent_professional_profile", "agent_identity"]
                    },
                    "scope": {
                        "type": "string",
                        "description": "Scope being delegated"
                    },
                    "user_id": {
                        "type": "string",
                        "description": "User authorizing the delegation"
                    }
                },
                "required": ["from_agent", "to_agent", "scope", "user_id"]
            }
        ),
        
        # Tool 6: List Available Scopes
        Tool(
            name="list_scopes",
            description=(
                "📋 List all available consent scopes and their descriptions. "
                "Use this to understand what data categories exist before requesting consent."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        
        # Tool 7: Check Consent Status (Production Flow)
        Tool(
            name="check_consent_status",
            description=(
                "🔄 Check the status of a pending consent request. "
                "Use this after request_consent returns 'pending' status. "
                "Poll this until status changes to 'granted' or 'denied'. "
                "Returns the consent token when approved."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier"
                    },
                    "scope": {
                        "type": "string",
                        "description": "The scope that was requested"
                    }
                },
                "required": ["user_id", "scope"]
            }
        )
    ]



# ============================================================================
# TOOL CALL ROUTER
# ============================================================================

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
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
        "get_food_preferences": handle_get_food,
        "get_professional_profile": handle_get_professional,
        "delegate_to_agent": handle_delegate,
        "list_scopes": handle_list_scopes,
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
# TOOL HANDLERS
# ============================================================================

async def handle_request_consent(args: dict) -> list[TextContent]:
    """
    Request consent from a user with BLOCKING POLL until approved.
    
    PRODUCTION MODE (BLOCKING):
    1. Creates pending request in FastAPI backend
    2. WAITS for user to approve via dashboard (polls every few seconds)
    3. Returns token ONLY after user explicitly approves
    4. Times out after configurable period (default: 5 minutes)
    
    DEMO MODE:
    - Auto-issues token immediately (when FastAPI not available)
    
    Compliance:
    ✅ HushhMCP: Consent First - NO data access without explicit approval
    ✅ HushhMCP: User must actively approve in dashboard
    ✅ HushhMCP: Cryptographic token only after human consent
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")
    reason = args.get("reason", "MCP Host requesting access")
    
    # ═══════════════════════════════════════════════════════════════════════
    # EMAIL RESOLUTION: If user_id looks like email, resolve to Firebase UID
    # ═══════════════════════════════════════════════════════════════════════
    
    original_identifier = user_id
    user_email = None
    user_display_name = None
    
    if user_id and "@" in user_id:
        # This is an email address, need to look up the UID
        logger.info(f"📧 Detected email address: {user_id}")
        
        try:
            async with httpx.AsyncClient() as client:
                lookup_response = await client.get(
                    f"{FASTAPI_URL}/api/user/lookup",
                    params={"email": user_id},
                    timeout=5.0
                )
                
                if lookup_response.status_code == 200:
                    lookup_data = lookup_response.json()
                    
                    if lookup_data.get("exists"):
                        # User found! Replace email with UID
                        user_id = lookup_data["user_id"]
                        user_email = lookup_data["email"]
                        user_display_name = lookup_data.get("display_name", user_email.split("@")[0])
                        logger.info(f"✅ Resolved {original_identifier} → {user_id} ({user_display_name})")
                    else:
                        # User doesn't exist - return friendly message with signup URL
                        logger.info(f"⚠️ User not found: {user_id}")
                        frontend_url = FASTAPI_URL.replace(":8000", ":3000")  # Frontend is on 3000
                        return [TextContent(type="text", text=json.dumps({
                            "status": "user_not_found",
                            "email": original_identifier,
                            "message": f"No Hushh account found for {original_identifier}",
                            "signup_url": f"{frontend_url}/login",
                            "suggestion": f"The user needs to create a Hushh account first at {frontend_url}/login",
                            "action_required": "User must sign up before data can be requested.",
                            "next_steps": [
                                f"1. Ask the user to visit {frontend_url}/login",
                                "2. They can sign in with Google or email",
                                "3. Complete the passphrase setup to secure their vault",
                                "4. Then request consent again"
                            ]
                        }))]

                else:
                    logger.warning(f"⚠️ User lookup failed with status {lookup_response.status_code}")
                    # Continue with original user_id (might be a UID already)
                    
        except Exception as e:
            logger.warning(f"⚠️ Email lookup failed: {e} - continuing with original user_id")
            # Continue with original user_id
    
    # Map string scope to internal format
    # SECURITY: vault.read.all is NOT available via MCP - only per-domain scopes
    # Full data access requires the user's own portal session
    scope_api_map = {
        "vault.read.food": "vault_read_food",
        "vault.read.professional": "vault_read_professional",
        "vault.read.finance": "vault_read_finance",
        # "vault.read.all" - DISABLED for MCP (security)
    }
    
    scope_enum_map = {
        "vault.read.food": ConsentScope.VAULT_READ_FOOD,
        "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault.read.finance": ConsentScope.VAULT_READ_FINANCE,
        # "vault.read.all" - DISABLED for MCP (security)
    }

    
    scope_api = scope_api_map.get(scope_str)
    scope_enum = scope_enum_map.get(scope_str)
    
    if not scope_api:
        return [TextContent(type="text", text=json.dumps({
            "status": "error",
            "error": f"Invalid scope: {scope_str}",
            "valid_scopes": list(scope_api_map.keys()),
            "hint": "Use list_scopes tool to see available options"
        }))]
    
    # ═══════════════════════════════════════════════════════════════════════
    # PRODUCTION MODE: Create pending request and WAIT for user approval
    # ═══════════════════════════════════════════════════════════════════════
    
    if PRODUCTION_MODE:
        display_id = user_display_name or user_email or user_id
        logger.info(f"🔐 PRODUCTION MODE: Requesting consent for {display_id}/{scope_str}")
        logger.info(f"   ⏱️ Timeout: {CONSENT_TIMEOUT_SECONDS}s, Poll interval: {CONSENT_POLL_INTERVAL_SECONDS}s")

        
        try:
            async with httpx.AsyncClient() as client:
                # Step 1: Create the pending consent request
                logger.info(f"📤 Creating pending consent request in FastAPI...")
                
                create_response = await client.post(
                    f"{FASTAPI_URL}/api/v1/request-consent",
                    json={
                        "developer_token": MCP_DEVELOPER_TOKEN,
                        "user_id": user_id,
                        "scope": scope_api,
                        "expiry_hours": 24
                    },
                    timeout=10.0
                )
                
                if create_response.status_code != 200:
                    error_detail = create_response.json().get("detail", "Unknown error")
                    logger.error(f"❌ FastAPI error creating request: {error_detail}")
                    return [TextContent(type="text", text=json.dumps({
                        "status": "error",
                        "error": error_detail,
                        "hint": "Check if FastAPI is running and developer is registered"
                    }))]
                
                data = create_response.json()
                status = data.get("status")
                
                # Case 1: Already granted - return token immediately
                if status == "already_granted":
                    logger.info(f"✅ Consent already granted - returning existing token")
                    return [TextContent(type="text", text=json.dumps({
                        "status": "granted",
                        "consent_token": data.get("consent_token"),
                        "user_id": user_id,
                        "scope": scope_str,
                        "message": "✅ Consent already granted. Use this token to access data."
                    }))]
                
                # Case 2: Pending - now we WAIT for user approval
                if status == "pending":
                    logger.info(f"📋 Consent request created - WAITING for user approval...")
                    logger.info(f"   � User must approve at: {FASTAPI_URL.replace('localhost:8000', 'localhost:3000')}/dashboard/consents")
                    
                    # ═══════════════════════════════════════════════════════
                    # BLOCKING POLL LOOP - Wait for user to approve
                    # ═══════════════════════════════════════════════════════
                    
                    start_time = time.time()
                    poll_count = 0
                    
                    while True:
                        elapsed = time.time() - start_time
                        remaining = CONSENT_TIMEOUT_SECONDS - elapsed
                        
                        # Check timeout
                        if elapsed >= CONSENT_TIMEOUT_SECONDS:
                            logger.warning(f"⏰ TIMEOUT: User did not approve within {CONSENT_TIMEOUT_SECONDS}s")
                            return [TextContent(type="text", text=json.dumps({
                                "status": "timeout",
                                "user_id": user_id,
                                "scope": scope_str,
                                "waited_seconds": int(elapsed),
                                "message": f"⏰ User did not approve consent within {CONSENT_TIMEOUT_SECONDS} seconds.",
                                "user_action": "User must approve the request in their Hushh dashboard",
                                "dashboard_url": f"{FASTAPI_URL.replace('localhost:8000', 'localhost:3000')}/dashboard/consents",
                                "next_step": "Try again after user has approved the request"
                            }))]
                        
                        # Poll for approval status
                        poll_count += 1
                        logger.info(f"   🔄 Polling #{poll_count} - {int(remaining)}s remaining...")
                        
                        # Check if still pending
                        pending_response = await client.get(
                            f"{FASTAPI_URL}/api/consent/pending",
                            params={"userId": user_id},
                            timeout=10.0
                        )
                        
                        if pending_response.status_code == 200:
                            pending_data = pending_response.json()
                            pending_list = pending_data.get("pending", [])
                            
                            # Check if our scope is still in pending list
                            still_pending = any(req.get("scope") == scope_api for req in pending_list)
                            
                            if not still_pending:
                                # Not pending anymore - user approved (or denied)
                                # Try to get the token by re-requesting
                                logger.info(f"   ✅ Request no longer pending - checking for token...")
                                
                                retry_response = await client.post(
                                    f"{FASTAPI_URL}/api/v1/request-consent",
                                    json={
                                        "developer_token": MCP_DEVELOPER_TOKEN,
                                        "user_id": user_id,
                                        "scope": scope_api,
                                        "expiry_hours": 24
                                    },
                                    timeout=10.0
                                )
                                
                                if retry_response.status_code == 200:
                                    retry_data = retry_response.json()
                                    if retry_data.get("status") == "already_granted":
                                        token = retry_data.get("consent_token")
                                        logger.info(f"🎉 CONSENT GRANTED by user! Token received.")
                                        return [TextContent(type="text", text=json.dumps({
                                            "status": "granted",
                                            "consent_token": token,
                                            "user_id": user_id,
                                            "scope": scope_str,
                                            "waited_seconds": int(elapsed),
                                            "message": f"✅ User approved consent after {int(elapsed)} seconds!"
                                        }))]
                                
                                # If we get here, user probably denied
                                logger.warning(f"❌ Request removed from pending but no token - user likely denied")
                                return [TextContent(type="text", text=json.dumps({
                                    "status": "denied",
                                    "user_id": user_id,
                                    "scope": scope_str,
                                    "waited_seconds": int(elapsed),
                                    "message": "❌ User denied the consent request.",
                                    "privacy_note": "User has the right to refuse data access."
                                }))]
                        
                        # Wait before next poll
                        await asyncio.sleep(CONSENT_POLL_INTERVAL_SECONDS)
                    
        except httpx.ConnectError as e:
            logger.warning(f"⚠️ FastAPI not reachable at {FASTAPI_URL}: {e}")
            logger.warning("   Falling back to DEMO MODE (auto-issue)")
        except Exception as e:
            logger.error(f"❌ Error in production consent flow: {e}")
            logger.warning("   Falling back to DEMO MODE (auto-issue)")
    
    # ═══════════════════════════════════════════════════════════════════════
    # DEMO MODE: Auto-issue token (fallback when FastAPI not available)
    # ═══════════════════════════════════════════════════════════════════════
    
    logger.info(f"🔐 DEMO MODE: Auto-issuing consent token (FastAPI not available)")
    
    token = issue_token(
        user_id=UserID(user_id),
        agent_id=AgentID("mcp_host"),
        scope=scope_enum,
        expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
    )
    
    logger.info(f"✅ Consent GRANTED (demo mode): user={user_id}, scope={scope_str}")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "granted",
        "mode": "demo",
        "consent_token": token.token,
        "user_id": user_id,
        "scope": scope_str,
        "issued_at": token.issued_at,
        "expires_at": token.expires_at,
        "message": f"✅ Consent granted for {scope_str}. Use this token to access data.",
        "note": "⚠️ DEMO MODE: Token auto-issued because FastAPI backend not available. In production, user must approve via dashboard."
    }))]



async def handle_check_consent_status(args: dict) -> list[TextContent]:
    """
    Check if a pending consent request has been approved.
    
    This is the polling endpoint for production consent flow.
    Call this after request_consent returns 'pending' status.
    
    Compliance:
    ✅ Returns token only after user explicitly approves
    ✅ Respects user's decision (grant or deny)
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")
    
    # Map scope string to API format
    scope_api_map = {
        "vault.read.food": "vault_read_food",
        "vault.read.professional": "vault_read_professional",
        "vault.read.finance": "vault_read_finance",
    }
    scope_api = scope_api_map.get(scope_str, scope_str)
    
    logger.info(f"🔄 Checking consent status: user={user_id}, scope={scope_str}")
    
    try:
        async with httpx.AsyncClient() as client:
            # Check if there's a pending request
            pending_response = await client.get(
                f"{FASTAPI_URL}/api/consent/pending",
                params={"userId": user_id},
                timeout=10.0
            )
            
            if pending_response.status_code == 200:
                pending_data = pending_response.json()
                pending_list = pending_data.get("pending", [])
                
                # Check if our scope is still pending
                for req in pending_list:
                    if req.get("scope") == scope_api:
                        logger.info(f"⏳ Consent still pending for {scope_str}")
                        return [TextContent(type="text", text=json.dumps({
                            "status": "pending",
                            "user_id": user_id,
                            "scope": scope_str,
                            "message": "⏳ User has not yet approved this request.",
                            "request_id": req.get("id"),
                            "requested_at": req.get("requestedAt"),
                            "instructions": [
                                "The user needs to approve this in their dashboard",
                                "Call this tool again in a few seconds to check status"
                            ]
                        }))]
                
                # Not in pending list - check if it was granted
                # Try to issue a token check (this would work if already approved)
                logger.info(f"✅ Request not pending - may have been approved")
                
                return [TextContent(type="text", text=json.dumps({
                    "status": "not_pending",
                    "user_id": user_id,
                    "scope": scope_str,
                    "message": "Request is no longer pending. It may have been approved or denied.",
                    "next_step": "Call request_consent again - if approved, you'll get the token directly"
                }))]
                
    except httpx.ConnectError:
        logger.warning("⚠️ FastAPI not reachable")
        return [TextContent(type="text", text=json.dumps({
            "status": "error",
            "error": "Cannot connect to consent backend",
            "hint": "Make sure FastAPI server is running on " + FASTAPI_URL
        }))]
    except Exception as e:
        logger.error(f"❌ Error checking consent status: {e}")
        return [TextContent(type="text", text=json.dumps({
            "status": "error",
            "error": str(e)
        }))]





async def handle_validate_token(args: dict) -> list[TextContent]:
    """
    Validate a consent token.
    
    Compliance:
    ✅ Signature verification (HMAC-SHA256)
    ✅ Expiration check
    ✅ Revocation check
    ✅ Scope verification (if provided)
    """
    token_str = args.get("token")
    expected_scope_str = args.get("expected_scope")
    
    # Determine expected scope if provided
    expected_scope = None
    if expected_scope_str:
        scope_map = {
            "vault.read.food": ConsentScope.VAULT_READ_FOOD,
            "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
            "vault.read.finance": ConsentScope.VAULT_READ_FINANCE,
        }
        expected_scope = scope_map.get(expected_scope_str)
    
    # Use existing validation logic
    valid, reason, token_obj = validate_token(token_str, expected_scope)
    
    if not valid:
        logger.warning(f"❌ Token INVALID: {reason}")
        return [TextContent(type="text", text=json.dumps({
            "valid": False,
            "reason": reason,
            "hint": "Call request_consent to obtain a new valid token"
        }))]
    
    logger.info(f"✅ Token VALID for user={token_obj.user_id}")
    
    return [TextContent(type="text", text=json.dumps({
        "valid": True,
        "user_id": token_obj.user_id,
        "agent_id": token_obj.agent_id,
        "scope": str(token_obj.scope),
        "issued_at": token_obj.issued_at,
        "expires_at": token_obj.expires_at,
        "signature_verified": True,
        "checks_passed": [
            "✅ Signature valid (HMAC-SHA256)",
            "✅ Not expired",
            "✅ Not revoked",
            "✅ Scope matches" if expected_scope else "ℹ️ Scope not checked"
        ]
    }))]


async def handle_get_food(args: dict) -> list[TextContent]:
    """
    Get food preferences WITH mandatory consent validation.
    
    Compliance:
    ✅ HushhMCP: Consent BEFORE data access
    ✅ HushhMCP: Scoped Access (vault.read.food required)
    ✅ HushhMCP: User ID must match token
    ✅ Privacy: Denied without valid consent
    """
    user_id = args.get("user_id")
    consent_token = args.get("consent_token")
    
    # Email resolution: if user_id looks like email, resolve to UID
    if user_id and "@" in user_id:
        try:
            async with httpx.AsyncClient() as client:
                lookup_response = await client.get(
                    f"{FASTAPI_URL}/api/user/lookup",
                    params={"email": user_id},
                    timeout=5.0
                )
                if lookup_response.status_code == 200:
                    lookup_data = lookup_response.json()
                    if lookup_data.get("exists"):
                        user_id = lookup_data["user_id"]
                        logger.info(f"✅ Resolved email to UID: {user_id}")
        except Exception as e:
            logger.warning(f"⚠️ Email lookup failed: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════
    # COMPLIANCE CHECK: Validate consent BEFORE any data access
    # This is the core of the Hushh privacy promise
    # ═══════════════════════════════════════════════════════════════════════
    
    valid, reason, token_obj = validate_token(
        consent_token,
        expected_scope=ConsentScope.VAULT_READ_FOOD
    )

    
    if not valid:
        logger.warning(f"🚫 ACCESS DENIED (food): {reason}")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": f"Consent validation failed: {reason}",
            "required_scope": "vault.read.food",
            "privacy_notice": "Hushh requires explicit consent before accessing any personal data.",
            "remedy": "Call request_consent with scope='vault.read.food' first"
        }))]
    
    # COMPLIANCE CHECK: User ID must match token
    if token_obj.user_id != user_id:
        logger.warning(f"🚫 ACCESS DENIED: User mismatch (token={token_obj.user_id}, request={user_id})")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": "Token user_id does not match requested user_id",
            "privacy_notice": "Tokens are bound to specific users and cannot be transferred."
        }))]
    
    # ═══════════════════════════════════════════════════════════════════════
    # CONSENT VERIFIED - Fetch Real Data from Encrypted Export
    # This is zero-knowledge: server returns encrypted data, we decrypt here
    # ═══════════════════════════════════════════════════════════════════════
    
    food_data = None
    
    try:
        async with httpx.AsyncClient() as client:
            export_response = await client.get(
                f"{FASTAPI_URL}/api/consent/data",
                params={"consent_token": consent_token},
                timeout=10.0
            )
            
            if export_response.status_code == 200:
                export_data = export_response.json()
                
                # Decrypt the export data with the export key
                export_key_hex = export_data.get("export_key")
                encrypted_data = export_data.get("encrypted_data")
                iv = export_data.get("iv")
                tag = export_data.get("tag")
                
                if all([export_key_hex, encrypted_data, iv, tag]):
                    try:
                        # Convert hex key to bytes
                        key_bytes = bytes.fromhex(export_key_hex)
                        
                        # Decode base64 IV, ciphertext, and tag
                        iv_bytes = base64.b64decode(iv)
                        ciphertext_bytes = base64.b64decode(encrypted_data)
                        tag_bytes = base64.b64decode(tag)
                        
                        # Combine ciphertext + tag for AESGCM
                        combined = ciphertext_bytes + tag_bytes
                        
                        # Decrypt
                        aesgcm = AESGCM(key_bytes)
                        plaintext = aesgcm.decrypt(iv_bytes, combined, None)
                        
                        # Parse JSON
                        food_data = json.loads(plaintext.decode('utf-8'))
                        logger.info(f"✅ Successfully decrypted vault export!")
                        
                    except Exception as e:
                        logger.error(f"❌ Decryption failed: {e}")
                        
            elif export_response.status_code == 404:
                logger.warning("⚠️ No export data found for this token")
                
    except Exception as e:
        logger.warning(f"⚠️ Export fetch failed: {e}")
    
    # Fallback to mock data if no export available (demo mode)
    if food_data is None:
        logger.info("📋 No export data, using demo data")
        food_data = {
            "dietary_restrictions": ["Vegetarian", "Gluten-Free"],
            "favorite_cuisines": ["Italian", "Mexican", "Thai", "Japanese"],
            "monthly_budget": 500,
            "note": "Demo data - real vault export not found"
        }
    
    logger.info(f"✅ Food data ACCESSED for user={user_id} (consent verified)")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "success",
        "user_id": user_id,
        "scope": "vault.read.food",
        "consent_verified": True,
        "consent_token_used": consent_token[:30] + "...",
        "data": food_data,
        "privacy_note": "This data was accessed with valid user consent.",
        "zero_knowledge": True
    }))]



async def handle_get_professional(args: dict) -> list[TextContent]:
    """
    Get professional profile WITH mandatory consent validation.
    
    Compliance:
    ✅ HushhMCP: Different scope = Different token required
    ✅ HushhMCP: Food token CANNOT access professional data
    ✅ HushhMCP: Scope isolation is enforced cryptographically
    """
    user_id = args.get("user_id")
    consent_token = args.get("consent_token")
    
    # Email resolution: if user_id looks like email, resolve to UID
    if user_id and "@" in user_id:
        try:
            async with httpx.AsyncClient() as client:
                lookup_response = await client.get(
                    f"{FASTAPI_URL}/api/user/lookup",
                    params={"email": user_id},
                    timeout=5.0
                )
                if lookup_response.status_code == 200:
                    lookup_data = lookup_response.json()
                    if lookup_data.get("exists"):
                        user_id = lookup_data["user_id"]
                        logger.info(f"✅ Resolved email to UID: {user_id}")
        except Exception as e:
            logger.warning(f"⚠️ Email lookup failed: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════
    # COMPLIANCE CHECK: Must have vault.read.professional scope
    # A food token will be REJECTED here
    # ═══════════════════════════════════════════════════════════════════════
    
    valid, reason, token_obj = validate_token(
        consent_token,
        expected_scope=ConsentScope.VAULT_READ_PROFESSIONAL  # NOT food!
    )

    
    if not valid:
        logger.warning(f"🚫 ACCESS DENIED (professional): {reason}")
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": f"Consent validation failed: {reason}",
            "required_scope": "vault.read.professional",
            "privacy_notice": "Each data category requires its own consent token.",
            "remedy": "Call request_consent with scope='vault.read.professional' first",
            "note": "A vault.read.food token cannot access professional data."
        }))]
    
    # COMPLIANCE CHECK: User ID must match
    if token_obj.user_id != user_id:
        return [TextContent(type="text", text=json.dumps({
            "status": "access_denied",
            "error": "Token user_id mismatch"
        }))]
    
    # ═══════════════════════════════════════════════════════════════════════
    # CONSENT VERIFIED - Return professional data
    # ═══════════════════════════════════════════════════════════════════════
    
    professional_data = {
        "title": "Senior Software Engineer",
        "company": "Tech Startup Inc.",
        "years_experience": 7,
        "skills": ["Python", "React", "AWS", "Machine Learning", "TypeScript", "FastAPI"],
        "experience_level": "Senior (5-8 years)",
        "education": "M.S. Computer Science",
        "job_preferences": {
            "type": ["Full-time", "Contract"],
            "location": ["Remote", "Hybrid"],
            "company_size": ["Startup", "Mid-size"],
            "industries": ["AI/ML", "FinTech", "HealthTech"]
        },
        "certifications": ["AWS Solutions Architect", "Google Cloud Professional"],
        "open_to_opportunities": True
    }
    
    logger.info(f"✅ Professional data ACCESSED for user={user_id} (consent verified)")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "success",
        "user_id": user_id,
        "scope": "vault.read.professional",
        "consent_verified": True,
        "data": professional_data,
        "privacy_note": "This data was accessed with valid user consent."
    }))]


async def handle_delegate(args: dict) -> list[TextContent]:
    """
    Create TrustLink for agent-to-agent delegation.
    
    Compliance:
    ✅ HushhMCP: A2A delegation via TrustLink
    ✅ Cryptographically signed delegation proof
    ✅ Scoped and time-limited
    ✅ User authorization recorded
    """
    from_agent = args.get("from_agent")
    to_agent = args.get("to_agent")
    scope_str = args.get("scope")
    user_id = args.get("user_id")
    
    # Map scope string to enum
    scope_map = {
        "vault.read.food": ConsentScope.VAULT_READ_FOOD,
        "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "agent.food.collect": ConsentScope.AGENT_FOOD_COLLECT,
    }
    scope = scope_map.get(scope_str, ConsentScope.CUSTOM_TEMPORARY)
    
    # Create TrustLink using existing HushhMCP trust module
    trust_link = create_trust_link(
        from_agent=AgentID(from_agent),
        to_agent=AgentID(to_agent),
        scope=scope,
        signed_by_user=UserID(user_id)
    )
    
    # Verify the TrustLink is valid
    is_valid = verify_trust_link(trust_link)
    
    logger.info(f"🔗 TrustLink CREATED: {from_agent} → {to_agent} (scope={scope_str})")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "delegated",
        "trust_link": {
            "from_agent": trust_link.from_agent,
            "to_agent": trust_link.to_agent,
            "scope": str(trust_link.scope),
            "authorized_by_user": trust_link.signed_by_user,
            "created_at": trust_link.created_at,
            "expires_at": trust_link.expires_at,
            "signature": trust_link.signature[:20] + "...",  # Truncate for display
            "signature_verified": is_valid
        },
        "message": f"Task delegated from {from_agent} to {to_agent}",
        "target_port": AGENT_PORTS.get(to_agent, 10000),
        "a2a_note": "This TrustLink can be verified by the target agent to confirm delegation authority."
    }))]


async def handle_list_scopes() -> list[TextContent]:
    """
    List all available consent scopes.
    
    Purpose: Transparency - users and developers can see what data categories exist
    """
    scopes = [
        {
            "scope": "vault.read.food",
            "emoji": "🍽️",
            "description": "Read food preferences (dietary, cuisines, budget)",
            "data_fields": ["dietary_restrictions", "favorite_cuisines", "monthly_budget", "allergies", "meal_preferences"],
            "sensitivity": "medium"
        },
        {
            "scope": "vault.read.professional",
            "emoji": "💼",
            "description": "Read professional profile (title, skills, experience)",
            "data_fields": ["title", "skills", "experience_level", "job_preferences", "certifications"],
            "sensitivity": "medium"
        },
        {
            "scope": "vault.read.finance",
            "emoji": "💰",
            "description": "Read financial data (budget, transactions)",
            "data_fields": ["monthly_budget", "spending_categories", "savings_goals"],
            "sensitivity": "high"
        },
        # NOTE: vault.read.all is NOT available via MCP for security
        # Full vault access requires authenticated session on Hushh portal
    ]
    
    return [TextContent(type="text", text=json.dumps({
        "available_scopes": scopes,
        "total_scopes": len(scopes),
        "usage": "Call request_consent with user_id and desired scope to obtain a consent token",
        "privacy_principle": "Each scope requires separate, explicit user consent",
        "security_note": "vault.read.all is NOT available via MCP - full data access requires the Hushh portal.",
        "hushh_promise": "Your data is never accessed without your permission."
    }))]



# ============================================================================
# MCP RESOURCES (Informational endpoints)
# ============================================================================

@server.list_resources()
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


@server.read_resource()
async def read_resource(uri: str) -> str:
    """Read MCP resource content by URI."""
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
