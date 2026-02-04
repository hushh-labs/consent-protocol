# mcp/tools/definitions.py
"""
MCP Tool definitions (JSON schemas for Claude/Cursor).
"""

from mcp.types import Tool


def get_tool_definitions() -> list[Tool]:
    """
    Return all Hushh consent tools for MCP hosts.
    
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
                        "description": "The user's unique identifier or Email Address (e.g., user@example.com)"
                    },
                    "scope": {
                        "type": "string",
                        "description": (
                            "Data scope to access. Use world_model.read for full world model, "
                            "or attr.{domain}.* for one domain (e.g. attr.financial.*, attr.food.*). "
                            "Domains per user from discover_user_domains(user_id). Each scope requires separate consent."
                        ),
                        "examples": ["world_model.read", "attr.financial.*", "attr.food.*", "attr.health.*"]
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
                "REQUIRES: Valid consent token with attr.food.* or world_model.read scope. "
                "Will be DENIED without proper consent."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier or Email Address"
                    },
                    "consent_token": {
                        "type": "string",
                        "description": "Valid consent token with attr.food.* or world_model.read scope"
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
                "REQUIRES: Valid consent token with attr.professional.* or world_model.read scope. "
                "A food token WILL NOT work - scopes are isolated."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier or Email Address"
                    },
                    "consent_token": {
                        "type": "string",
                        "description": "Valid consent token with attr.professional.* or world_model.read scope"
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
                        "description": "User authorizing the delegation (or Email Address)"
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
        
        # Tool 6b: Discover user's domains and scopes (per-user discovery)
        Tool(
            name="discover_user_domains",
            description=(
                "Discover which domains a user has and the scope strings to request. "
                "Call this before request_consent to know which scopes (e.g. attr.financial.*, attr.food.*) "
                "are available for that user. Returns user_id, list of domain keys, and available_scopes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's unique identifier (Firebase UID or email to resolve)"
                    }
                },
                "required": ["user_id"]
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
                        "description": "The user's unique identifier or Email Address"
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
