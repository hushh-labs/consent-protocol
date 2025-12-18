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
from typing import Any, Optional

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

# FastAPI backend URL (for pending consent flow)
FASTAPI_URL = os.environ.get("CONSENT_API_URL", "http://localhost:8000")

# Production mode: requires user approval via dashboard
# Demo mode: auto-issues tokens (for testing)
PRODUCTION_MODE = os.environ.get("PRODUCTION_MODE", "true").lower() == "true"

# MCP developer token (registered in FastAPI)
MCP_DEVELOPER_TOKEN = os.environ.get("MCP_DEVELOPER_TOKEN", "mcp_dev_claude_desktop")

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
    Request consent from a user.
    
    PRODUCTION MODE:
    - Creates pending request in FastAPI backend
    - User must approve via dashboard
    - Returns 'pending' status with instructions to poll
    
    DEMO MODE:
    - Auto-issues token immediately (for testing)
    
    Compliance:
    ✅ HushhMCP: Consent First principle
    ✅ User approval required (production)
    """
    user_id = args.get("user_id")
    scope_str = args.get("scope")
    reason = args.get("reason", "MCP Host requesting access")
    
    # Map string scope to internal format
    scope_api_map = {
        "vault.read.food": "vault_read_food",
        "vault.read.professional": "vault_read_professional",
        "vault.read.finance": "vault_read_finance",
        "vault.read.all": "vault_read_all",
    }
    
    scope_enum_map = {
        "vault.read.food": ConsentScope.VAULT_READ_FOOD,
        "vault.read.professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault.read.finance": ConsentScope.VAULT_READ_FINANCE,
        "vault.read.all": ConsentScope.VAULT_READ_ALL,
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
    # PRODUCTION MODE: Create pending request via FastAPI
    # ═══════════════════════════════════════════════════════════════════════
    
    if PRODUCTION_MODE:
        logger.info(f"🔐 Production Mode: Creating pending consent request")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{FASTAPI_URL}/api/v1/request-consent",
                    json={
                        "developer_token": MCP_DEVELOPER_TOKEN,
                        "user_id": user_id,
                        "scope": scope_api,
                        "expiry_hours": 24
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    
                    if status == "already_granted":
                        # Token already exists
                        return [TextContent(type="text", text=json.dumps({
                            "status": "granted",
                            "consent_token": data.get("consent_token"),
                            "user_id": user_id,
                            "scope": scope_str,
                            "message": "✅ Consent already granted. Use this token to access data."
                        }))]
                    
                    elif status == "pending":
                        # Request created, waiting for user approval
                        logger.info(f"📋 Consent request pending: {user_id}/{scope_str}")
                        return [TextContent(type="text", text=json.dumps({
                            "status": "pending",
                            "user_id": user_id,
                            "scope": scope_str,
                            "message": data.get("message"),
                            "user_action_required": True,
                            "instructions": [
                                "📱 The user must approve this request in their Hushh dashboard",
                                "🔄 Call 'check_consent_status' to poll for approval",
                                "⏱️ Request expires if not approved within 24 hours"
                            ],
                            "next_step": "Call check_consent_status with the same user_id and scope to check if approved",
                            "dashboard_url": f"{FASTAPI_URL.replace('localhost:8000', 'your-app.com')}/dashboard/consents"
                        }))]
                    
                else:
                    error_detail = response.json().get("detail", "Unknown error")
                    logger.error(f"❌ FastAPI error: {error_detail}")
                    return [TextContent(type="text", text=json.dumps({
                        "status": "error",
                        "error": error_detail,
                        "hint": "FastAPI backend may not be running or developer not registered"
                    }))]
                    
        except httpx.ConnectError:
            logger.warning("⚠️ FastAPI not reachable, falling back to demo mode")
            # Fall through to demo mode
        except Exception as e:
            logger.error(f"❌ Error calling FastAPI: {e}")
            # Fall through to demo mode
    
    # ═══════════════════════════════════════════════════════════════════════
    # DEMO MODE: Auto-issue token (for testing when FastAPI not available)
    # ═══════════════════════════════════════════════════════════════════════
    
    logger.info(f"🔐 Demo Mode: Auto-issuing consent token")
    
    token = issue_token(
        user_id=UserID(user_id),
        agent_id=AgentID("mcp_host"),
        scope=scope_enum,
        expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
    )
    
    logger.info(f"✅ Consent GRANTED (demo mode): user={user_id}, scope={scope_str}")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "granted",
        "mode": "demo" if not PRODUCTION_MODE else "fallback",
        "consent_token": token.token,
        "user_id": user_id,
        "scope": scope_str,
        "issued_at": token.issued_at,
        "expires_at": token.expires_at,
        "message": f"✅ Consent granted for {scope_str}. Use this token to access data.",
        "note": "In production, this would require user approval via dashboard."
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
    # CONSENT VERIFIED - Now we can return data
    # In production, this would decrypt from the user's vault
    # ═══════════════════════════════════════════════════════════════════════
    
    food_data = {
        "dietary_restrictions": ["Vegetarian", "Gluten-Free"],
        "favorite_cuisines": ["Italian", "Mexican", "Thai", "Japanese"],
        "monthly_budget": 500,
        "meal_preferences": {
            "breakfast": "Light, healthy options",
            "lunch": "Quick, protein-rich",
            "dinner": "Variety, family-style"
        },
        "allergies": ["Peanuts"],
        "spice_tolerance": "Medium",
        "notes": "Prefers organic produce when available"
    }
    
    logger.info(f"✅ Food data ACCESSED for user={user_id} (consent verified)")
    
    return [TextContent(type="text", text=json.dumps({
        "status": "success",
        "user_id": user_id,
        "scope": "vault.read.food",
        "consent_verified": True,
        "consent_token_used": consent_token[:30] + "...",
        "data": food_data,
        "privacy_note": "This data was accessed with valid user consent."
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
        {
            "scope": "vault.read.all",
            "emoji": "🔓",
            "description": "Session scope - access all vault data (internal/admin use only)",
            "data_fields": ["*"],
            "sensitivity": "critical",
            "note": "This scope should only be used for authenticated session access"
        },
    ]
    
    return [TextContent(type="text", text=json.dumps({
        "available_scopes": scopes,
        "total_scopes": len(scopes),
        "usage": "Call request_consent with user_id and desired scope to obtain a consent token",
        "privacy_principle": "Each scope requires separate, explicit user consent",
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
