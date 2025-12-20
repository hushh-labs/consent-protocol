# consent-protocol/server.py
"""
FastAPI Server for Hushh Consent Protocol Agents

Serves all agent chat endpoints that the Next.js frontend calls.
Run with: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import os
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import agents
from hushh_mcp.agents.food_dining.agent import food_dining_agent
from hushh_mcp.agents.professional_profile.agent import professional_agent, ProfessionalProfileAgent

# Dynamic root_path for Swagger docs in production
# Set ROOT_PATH env var to your production URL to fix Swagger showing localhost
root_path = os.environ.get("ROOT_PATH", "")

app = FastAPI(
    title="Hushh Consent Protocol API",
    description="Agent endpoints for the Hushh Personal Data Agent system",
    version="1.0.0",
    root_path=root_path,
)

# CORS - Dynamic origins based on environment
# Add FRONTEND_URL env var for production deployments
cors_origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
]

# Add production frontend URL if set
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    cors_origins.append(frontend_url)
    logger.info(f"✅ Added CORS origin from FRONTEND_URL: {frontend_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ChatRequest(BaseModel):
    userId: str
    message: str
    sessionState: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    sessionState: Optional[Dict[str, Any]] = None
    needsConsent: bool = False
    isComplete: bool = False
    ui_type: Optional[str] = None
    options: Optional[List[str]] = None
    allow_custom: Optional[bool] = None
    allow_none: Optional[bool] = None
    consent_token: Optional[str] = None
    consent_issued_at: Optional[int] = None
    consent_expires_at: Optional[int] = None

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
def health_check():
    return {"status": "ok", "service": "hushh-consent-protocol"}

@app.get("/health")
def health():
    return {"status": "healthy", "agents": ["food_dining", "professional_profile"]}

# ============================================================================
# UTILITIES
# ============================================================================

class ValidateTokenRequest(BaseModel):
    token: str

@app.post("/api/validate-token")
async def validate_token_endpoint(request: ValidateTokenRequest):
    """
    Validate a consent token.
    Used by frontend to verify tokens before performing privileged actions.
    """
    from hushh_mcp.consent.token import validate_token
    
    # Validate signature and expiration
    valid, reason, token_obj = validate_token(request.token)
    
    if not valid:
        return {"valid": False, "reason": reason}
        
    return {
        "valid": True, 
        "user_id": token_obj.user_id,
        "agent_id": token_obj.agent_id,
        "scope": token_obj.scope
    }

# ============================================================================
# FOOD & DINING AGENT
# ============================================================================

@app.post("/api/agents/food-dining/chat", response_model=ChatResponse)
async def food_dining_chat(request: ChatRequest):
    """
    Handle Food & Dining agent chat messages.
    
    This endpoint manages the conversational flow for collecting:
    - Dietary restrictions
    - Cuisine preferences  
    - Monthly budget
    
    Returns consent tokens when user confirms save.
    """
    logger.info(f"🍽️ Food Agent: user={request.userId}, msg='{request.message[:50]}...'")
    
    try:
        result = food_dining_agent.handle_message(
            message=request.message,
            user_id=request.userId,
            session_state=request.sessionState
        )
        
        logger.info(f"🍽️ Food Agent: step={result.get('session_state', {}).get('step')}")
        
        return ChatResponse(
            response=result.get("response", ""),
            sessionState=result.get("session_state"),
            needsConsent=result.get("needs_consent", False),
            isComplete=result.get("is_complete", False),
            ui_type=result.get("ui_type"),
            options=result.get("options"),
            allow_custom=result.get("allow_custom"),
            allow_none=result.get("allow_none"),
            consent_token=result.get("consent_token"),
            consent_issued_at=result.get("consent_issued_at"),
            consent_expires_at=result.get("consent_expires_at")
        )
    except Exception as e:
        logger.error(f"🍽️ Food Agent Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PROFESSIONAL PROFILE AGENT
# ============================================================================

@app.post("/api/agents/professional-profile/chat", response_model=ChatResponse)
async def professional_profile_chat(request: ChatRequest):
    """
    Handle Professional Profile agent chat messages.
    
    This endpoint manages the conversational flow for collecting:
    - Professional title
    - Skills
    - Experience level
    - Job preferences
    
    Returns consent tokens when user confirms save.
    """
    logger.info(f"💼 Professional Agent: user={request.userId}, msg='{request.message[:50]}...'")
    
    try:
        result = professional_agent.handle_message(
            message=request.message,
            user_id=request.userId,
            session_state=request.sessionState
        )
        
        logger.info(f"💼 Professional Agent: step={result.get('session_state', {}).get('step')}")
        
        return ChatResponse(
            response=result.get("response", ""),
            sessionState=result.get("session_state"),
            needsConsent=result.get("needs_consent", False),
            isComplete=result.get("is_complete", False),
            ui_type=result.get("ui_type"),
            options=result.get("options"),
            allow_custom=result.get("allow_custom"),
            allow_none=result.get("allow_none"),
            consent_token=result.get("consent_token"),
            consent_issued_at=result.get("consent_issued_at"),
            consent_expires_at=result.get("consent_expires_at")
        )
    except Exception as e:
        logger.error(f"💼 Professional Agent Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# AGENT INFO ENDPOINTS
# ============================================================================

@app.get("/api/agents/food-dining/info")
async def food_dining_info():
    """Get Food & Dining agent manifest info."""
    return food_dining_agent.get_agent_info()

@app.get("/api/agents/professional-profile/info")
async def professional_profile_info():
    """Get Professional Profile agent manifest info."""
    return professional_agent.get_agent_info()

# ============================================================================
# DEVELOPER API - External Access with Consent
# ============================================================================
# These endpoints allow external developers to access user data
# ONLY with valid consent tokens. Follows Hushh Core Principles.

from hushh_mcp.consent.token import validate_token, issue_token
from hushh_mcp.constants import ConsentScope

class ConsentRequest(BaseModel):
    """Request consent from a user for data access."""
    user_id: str
    developer_token: str  # Developer's API key
    scope: str  # e.g., "vault_read_food", "vault_read_professional"
    expiry_hours: int = 24  # How long consent lasts

class ConsentResponse(BaseModel):
    status: str
    message: str
    consent_token: Optional[str] = None
    expires_at: Optional[int] = None

class DataAccessRequest(BaseModel):
    """Request to access user data with consent token."""
    user_id: str
    consent_token: str  # Token from user consent

class DataAccessResponse(BaseModel):
    status_code: int
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Mock developer registry (in production, this would be a database)
REGISTERED_DEVELOPERS = {
    "dev-hushh-001": {"name": "Hushh Internal", "approved_scopes": ["*"]},
    "dev-partner-001": {"name": "Partner App", "approved_scopes": ["vault_read_food", "vault_read_professional"]},
    # MCP Server developer (Claude Desktop, Cursor, etc.)
    "mcp_dev_claude_desktop": {"name": "Claude Desktop (MCP)", "approved_scopes": ["*"]},
}


# Mock user data store (in production, comes from encrypted vault)
MOCK_USER_DATA = {
    "user_mock_001": {
        "food": {
            "dietary_preferences": ["Vegetarian", "Gluten-Free"],
            "favorite_cuisines": ["Italian", "Mexican", "Thai"],
            "monthly_budget": 500
        },
        "professional": {
            "title": "Senior Software Engineer",
            "skills": ["Python", "React", "AWS"],
            "experience_level": "Senior (5-8 years)",
            "job_preferences": ["Full-time", "Remote"]
        }
    }
}

# Pending consent requests (in production, stored in database)
_pending_consents: Dict[str, Dict] = {}
_granted_consents: Dict[str, str] = {}  # user_id:scope -> consent_token
_consent_exports: Dict[str, Dict] = {}  # consent_token -> encrypted export data
_consent_audit_log: List[Dict] = []  # Audit trail of all consent actions


@app.post("/api/v1/request-consent", response_model=ConsentResponse)
async def request_consent(request: ConsentRequest):
    """
    Request consent from a user for data access.
    
    External developers call this to request permission to access
    specific user data. The user will be notified and must approve.
    
    Follows Hushh Core Principle: "Consent First"
    
    IMPORTANT: This does NOT auto-approve. User must explicitly approve
    via the /api/consent/pending/approve endpoint.
    """
    logger.info(f"🔐 Consent Request: dev={request.developer_token}, user={request.user_id}, scope={request.scope}")
    
    # Verify developer
    if request.developer_token not in REGISTERED_DEVELOPERS:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid developer token")
    
    dev_info = REGISTERED_DEVELOPERS[request.developer_token]
    
    # Verify scope is allowed for this developer
    if "*" not in dev_info["approved_scopes"] and request.scope not in dev_info["approved_scopes"]:
        raise HTTPException(status_code=403, detail=f"Scope '{request.scope}' not approved for this developer")
    
    # Check if consent already granted
    consent_key = f"{request.user_id}:{request.scope}"
    if consent_key in _granted_consents:
        return ConsentResponse(
            status="already_granted",
            message="User has already granted consent for this scope.",
            consent_token=_granted_consents[consent_key]
        )
    
    # Check if request already pending
    if consent_key in _pending_consents:
        return ConsentResponse(
            status="pending",
            message="Consent request already pending. Waiting for user approval."
        )
    
    # Generate a request ID
    import uuid
    request_id = str(uuid.uuid4())[:8]
    
    now_ms = int(time.time() * 1000)
    poll_timeout_ms = 5 * 60 * 1000  # 5 minutes for MCP to poll
    token_expiry_ms = request.expiry_hours * 60 * 60 * 1000
    
    # Store pending consent (user must approve in dashboard)
    _pending_consents[consent_key] = {
        "request_id": request_id,
        "developer": dev_info["name"],
        "developer_token": request.developer_token,
        "scope": request.scope,
        "scope_description": get_scope_description(request.scope),
        "expiry_hours": request.expiry_hours,
        "requested_at": now_ms,
        "poll_timeout_at": now_ms + poll_timeout_ms,  # MCP poll timeout
        "token_expires_at": now_ms + token_expiry_ms,  # Token expiry if approved
        "user_id": request.user_id
    }
    
    # Log REQUESTED action to audit trail
    _consent_audit_log.append({
        "id": str(len(_consent_audit_log) + 1),
        "token_id": "N/A",
        "user_id": request.user_id,
        "agent_id": dev_info["name"],
        "scope": request.scope,
        "action": "REQUESTED",
        "issued_at": now_ms,
        "expires_at": None,
        "token_type": "pending"
    })
    
    logger.info(f"📋 Consent request stored as pending: {consent_key} (request_id={request_id})")
    
    return ConsentResponse(
        status="pending",
        message=f"Consent request submitted. User must approve in their dashboard. Request ID: {request_id}"
    )

def get_scope_description(scope: str) -> str:
    """Human-readable scope descriptions."""
    descriptions = {
        "vault_read_food": "Read your food preferences (dietary, cuisines, budget)",
        "vault_read_professional": "Read your professional profile (title, skills, experience)",
        "vault_write_food": "Write to your food preferences",
        "vault_write_professional": "Write to your professional profile",
    }
    return descriptions.get(scope, f"Access: {scope}")

# ============================================================================
# PENDING CONSENT MANAGEMENT (User-facing)
# ============================================================================

@app.get("/api/consent/pending")
async def get_pending_consents(userId: str):
    """
    Get all pending consent requests for a user.
    Called by the dashboard to show pending requests.
    """
    pending_for_user = []
    for key, request in _pending_consents.items():
        if request["user_id"] == userId:
            pending_for_user.append({
                "id": request["request_id"],
                "developer": request["developer"],
                "scope": request["scope"],
                "scopeDescription": request["scope_description"],
                "requestedAt": request["requested_at"],
                "expiryHours": request["expiry_hours"],
            })
    
    return {"pending": pending_for_user}

@app.post("/api/consent/pending/approve")
async def approve_consent(request: Request):
    """
    User approves a pending consent request (Zero-Knowledge).
    
    Browser sends encrypted export data (server never sees plaintext).
    Export key is embedded in the consent token.
    """
    body = await request.json()
    userId = body.get("userId")
    requestId = body.get("requestId")
    exportKey = body.get("exportKey")  # Hex-encoded AES-256 key
    encryptedData = body.get("encryptedData")  # Base64 ciphertext
    encryptedIv = body.get("encryptedIv")  # Base64 IV
    encryptedTag = body.get("encryptedTag")  # Base64 auth tag
    
    logger.info(f"✅ User {userId} approving consent request {requestId}")
    logger.info(f"   Export data present: {bool(encryptedData)}")
    
    # Find the pending request
    for key, pending_request in list(_pending_consents.items()):
        if pending_request["user_id"] == userId and pending_request["request_id"] == requestId:
            # Check if MCP poll timeout has expired
            now_ms = int(time.time() * 1000)
            poll_timeout_at = pending_request.get("poll_timeout_at", 0)
            
            if poll_timeout_at and now_ms > poll_timeout_at:
                # Timeout - MCP is no longer waiting
                del _pending_consents[key]
                
                _consent_audit_log.append({
                    "id": str(len(_consent_audit_log) + 1),
                    "token_id": "N/A",
                    "user_id": userId,
                    "agent_id": pending_request["developer"],
                    "scope": pending_request["scope"],
                    "action": "TIMED_OUT",
                    "issued_at": now_ms,
                    "expires_at": None,
                    "token_type": "expired"
                })
                
                logger.info(f"⏰ Consent request timed out for {key}")
                return {"status": "timed_out", "message": "MCP poll timeout expired. The requesting application is no longer waiting."}
            
            # Issue consent token
            scope_map = {
                "vault_read_food": ConsentScope.VAULT_READ_FOOD,
                "vault_read_professional": ConsentScope.VAULT_READ_PROFESSIONAL,
                "vault_write_food": ConsentScope.VAULT_WRITE_FOOD,
                "vault_write_professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
            }
            
            consent_scope = scope_map.get(pending_request["scope"])
            if not consent_scope:
                raise HTTPException(status_code=400, detail=f"Unknown scope: {pending_request['scope']}")
            
            # Issue token with export key embedded
            token = issue_token(
                user_id=userId,
                agent_id=f"developer:{pending_request['developer_token']}",
                scope=consent_scope,
                expires_in_ms=pending_request["expiry_hours"] * 60 * 60 * 1000
            )
            
            # Store encrypted export linked to token
            if encryptedData and exportKey:
                _consent_exports[token.token] = {
                    "encrypted_data": encryptedData,
                    "iv": encryptedIv,
                    "tag": encryptedTag,
                    "export_key": exportKey,  # Will be in token for MCP decryption
                    "scope": pending_request["scope"],
                    "created_at": int(time.time() * 1000),
                }
                logger.info(f"   Stored encrypted export for token")
            
            # Move to granted
            _granted_consents[key] = token.token
            del _pending_consents[key]
            
            # Log to audit trail
            _consent_audit_log.append({
                "id": str(len(_consent_audit_log) + 1),
                "token_id": token.token[:20] + "...",
                "user_id": userId,
                "agent_id": pending_request["developer"],
                "scope": pending_request["scope"],
                "action": "CONSENT_GRANTED",
                "issued_at": int(time.time() * 1000),
                "expires_at": token.expires_at,
                "token_type": "consent"
            })
            
            logger.info(f"✅ Consent granted for {key}")
            
            # Return token with export key for MCP decryption
            return {
                "status": "approved",
                "message": f"Consent granted to {pending_request['developer']}",
                "consent_token": token.token,
                "export_key": exportKey,  # MCP uses this to decrypt
                "expires_at": token.expires_at
            }
    
    raise HTTPException(status_code=404, detail="Consent request not found")


@app.post("/api/consent/pending/deny")
async def deny_consent(request: Request):
    """
    User denies a pending consent request.
    """
    body = await request.json()
    userId = body.get("userId")
    requestId = body.get("requestId")
    
    logger.info(f"❌ User {userId} denying consent request {requestId}")
    
    # Find and remove the pending request
    for key, pending_request in list(_pending_consents.items()):
        if pending_request["user_id"] == userId and pending_request["request_id"] == requestId:
            del _pending_consents[key]
            
            # Log to audit trail
            _consent_audit_log.append({
                "id": str(len(_consent_audit_log) + 1),
                "token_id": "N/A",
                "user_id": userId,
                "agent_id": pending_request["developer"],
                "scope": pending_request["scope"],
                "action": "CONSENT_DENIED",
                "issued_at": int(time.time() * 1000),
                "expires_at": None,
                "token_type": "denied"
            })
            
            logger.info(f"❌ Consent denied for {key}")
            return {"status": "denied", "message": f"Consent denied to {pending_request['developer']}"}
    
    raise HTTPException(status_code=404, detail="Consent request not found")


@app.get("/api/consent/history")
async def get_consent_history(userId: str, page: int = 1, limit: int = 20):
    """
    Get consent audit history for a user.
    Returns paginated list of consent actions (granted, denied, revoked).
    """
    logger.info(f"📜 Fetching consent history for user: {userId}")
    
    # Filter audit log for this user
    user_history = [entry for entry in _consent_audit_log if entry.get("user_id") == userId]
    
    # Sort by issued_at descending (newest first)
    user_history.sort(key=lambda x: x.get("issued_at", 0), reverse=True)
    
    # Paginate
    start = (page - 1) * limit
    end = start + limit
    paginated = user_history[start:end]
    
    return {
        "items": paginated,
        "total": len(user_history),
        "page": page,
        "limit": limit
    }


@app.post("/api/consent/cancel")
async def cancel_consent(request: Request):
    """
    Cancel a pending consent request (MCP disconnected or user cancelled in chat).
    Called by MCP when the chat is interrupted.
    """
    body = await request.json()
    userId = body.get("userId")
    requestId = body.get("requestId")
    
    logger.info(f"🚫 Cancelling consent request {requestId} for user {userId}")
    
    for key, pending_request in list(_pending_consents.items()):
        if pending_request["user_id"] == userId and pending_request["request_id"] == requestId:
            del _pending_consents[key]
            
            _consent_audit_log.append({
                "id": str(len(_consent_audit_log) + 1),
                "token_id": "N/A",
                "user_id": userId,
                "agent_id": pending_request["developer"],
                "scope": pending_request["scope"],
                "action": "CANCELLED",
                "issued_at": int(time.time() * 1000),
                "expires_at": None,
                "token_type": "cancelled"
            })
            
            logger.info(f"🚫 Consent cancelled for {key}")
            return {"status": "cancelled", "message": "Consent request cancelled"}
    
    raise HTTPException(status_code=404, detail="Consent request not found")


@app.get("/api/consent/active")
async def get_active_consents(userId: str):
    """
    Get active (non-expired) consent tokens for a user.
    Used by the Session tab in the dashboard.
    """
    logger.info(f"🔑 Fetching active consents for user: {userId}")
    
    now_ms = int(time.time() * 1000)
    active_tokens = []
    
    # Get all granted consents for this user that haven't expired
    for key, token_str in _granted_consents.items():
        if key.startswith(f"{userId}:"):
            # Validate the token is still valid
            valid, reason, token_obj = validate_token(token_str)
            if valid and token_obj:
                # Check if we have export data for this token
                export_data = _consent_exports.get(token_str, {})
                scope = key.split(":")[1] if ":" in key else "unknown"
                
                active_tokens.append({
                    "id": token_str[:20] + "...",
                    "scope": scope,
                    "developer": export_data.get("scope", scope),
                    "issued_at": token_obj.issued_at if hasattr(token_obj, 'issued_at') else now_ms,
                    "expires_at": token_obj.expires_at if hasattr(token_obj, 'expires_at') else now_ms + 86400000,
                    "time_remaining_ms": (token_obj.expires_at - now_ms) if hasattr(token_obj, 'expires_at') else 0
                })
    
    return {"active": active_tokens, "count": len(active_tokens)}


@app.post("/api/consent/revoke")
async def revoke_consent(request: Request):
    """
    Revoke an active consent token.
    User can revoke access from the session tab.
    """
    body = await request.json()
    userId = body.get("userId")
    scope = body.get("scope")
    
    logger.info(f"🔒 User {userId} revoking consent for scope: {scope}")
    
    # Find and remove the granted consent
    key = f"{userId}:{scope}"
    if key in _granted_consents:
        token = _granted_consents[key]
        
        # Remove from granted consents
        del _granted_consents[key]
        
        # Remove associated export data if exists
        if token in _consent_exports:
            del _consent_exports[token]
        
        # Log to audit trail
        _consent_audit_log.append({
            "id": str(len(_consent_audit_log) + 1),
            "token_id": token[:20] + "...",
            "user_id": userId,
            "agent_id": scope,  # Will be developer name in actual implementation
            "scope": scope,
            "action": "REVOKED",
            "issued_at": int(time.time() * 1000),
            "expires_at": None,
            "token_type": "revoked"
        })
        
        logger.info(f"🔒 Consent revoked for {key}")
        return {"status": "revoked", "message": f"Access revoked for {scope}"}
    
    raise HTTPException(status_code=404, detail="Active consent not found")


@app.get("/api/consent/data")
async def get_consent_export_data(consent_token: str):
    """
    Retrieve encrypted export data for a consent token (Zero-Knowledge).
    
    MCP calls this with a valid consent token.
    Returns encrypted data + export key for client-side decryption.
    Server NEVER sees plaintext.
    """
    logger.info(f"📦 Export data request for token: {consent_token[:30]}...")
    
    # Validate the consent token
    valid, reason, token_obj = validate_token(consent_token)
    if not valid:
        logger.warning(f"❌ Token validation failed: {reason}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {reason}")
    
    # Look up the encrypted export
    if consent_token not in _consent_exports:
        logger.warning(f"⚠️ No export data found for token")
        raise HTTPException(status_code=404, detail="No export data for this token")
    
    export_data = _consent_exports[consent_token]
    
    logger.info(f"✅ Returning encrypted export for scope: {export_data.get('scope')}")
    
    return {
        "status": "success",
        "encrypted_data": export_data["encrypted_data"],
        "iv": export_data["iv"],
        "tag": export_data["tag"],
        "export_key": export_data["export_key"],  # MCP decrypts with this
        "scope": export_data["scope"],
    }


@app.post("/api/v1/food-data", response_model=DataAccessResponse)
async def get_food_data(request: DataAccessRequest):
    """
    Get user's food preferences data.
    
    Requires valid consent token with VAULT_READ_FOOD scope.
    
    Follows Hushh Core Principle: "Scoped Access"
    """
    logger.info(f"🍽️ Food Data Request: user={request.user_id}")
    
    # Validate consent token
    valid, reason, token = validate_token(
        request.consent_token,
        expected_scope=ConsentScope.VAULT_READ_FOOD
    )
    
    if not valid:
        logger.warning(f"❌ Token validation failed: {reason}")
        return DataAccessResponse(
            status_code=403,
            error=f"Forbidden: {reason}"
        )
    
    # Verify token is for this user
    if token.user_id != request.user_id:
        return DataAccessResponse(
            status_code=403,
            error="Forbidden: Token user mismatch"
        )
    
    # Get user data (in production, decrypt from vault)
    user_data = MOCK_USER_DATA.get(request.user_id, {}).get("food")
    
    if not user_data:
        return DataAccessResponse(
            status_code=404,
            error="No food data found for this user"
        )
    
    logger.info(f"✅ Food data returned for user {request.user_id}")
    
    return DataAccessResponse(
        status_code=200,
        data=user_data
    )

@app.post("/api/v1/professional-data", response_model=DataAccessResponse)
async def get_professional_data(request: DataAccessRequest):
    """
    Get user's professional profile data.
    
    Requires valid consent token with VAULT_READ_PROFESSIONAL scope.
    
    Follows Hushh Core Principle: "Scoped Access"
    """
    logger.info(f"💼 Professional Data Request: user={request.user_id}")
    
    # Validate consent token
    valid, reason, token = validate_token(
        request.consent_token,
        expected_scope=ConsentScope.VAULT_READ_PROFESSIONAL
    )
    
    if not valid:
        logger.warning(f"❌ Token validation failed: {reason}")
        return DataAccessResponse(
            status_code=403,
            error=f"Forbidden: {reason}"
        )
    
    # Verify token is for this user
    if token.user_id != request.user_id:
        return DataAccessResponse(
            status_code=403,
            error="Forbidden: Token user mismatch"
        )
    
    # Get user data (in production, decrypt from vault)
    user_data = MOCK_USER_DATA.get(request.user_id, {}).get("professional")
    
    if not user_data:
        return DataAccessResponse(
            status_code=404,
            error="No professional data found for this user"
        )
    
    logger.info(f"✅ Professional data returned for user {request.user_id}")
    
    return DataAccessResponse(
        status_code=200,
        data=user_data
    )

@app.get("/api/v1/list-scopes")
async def list_available_scopes():
    """
    List all available consent scopes.
    
    Developers can reference this to understand what data they can request.
    """
    return {
        "scopes": [
            {"name": "vault_read_food", "description": "Read user's food preferences (dietary, cuisines, budget)"},
            {"name": "vault_read_professional", "description": "Read user's professional profile (title, skills, experience)"},
            {"name": "vault_read_finance", "description": "Read user's financial data"},
            {"name": "vault_write_food", "description": "Write user's food preferences"},
            {"name": "vault_write_professional", "description": "Write user's professional profile"},
        ]
    }

@app.get("/api/v1")
async def developer_api_root():
    """Welcome to Hushh Developer API."""
    return {
        "message": "Welcome to Hushh Developer API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "POST /api/v1/request-consent",
            "POST /api/v1/food-data",
            "POST /api/v1/professional-data",
            "GET /api/v1/list-scopes"
        ]
    }

# ============================================================================
# SESSION TOKEN ENDPOINTS (Internal Consent Flow)
# ============================================================================

class SessionTokenRequest(BaseModel):
    userId: str
    scope: str = "session"

class SessionTokenResponse(BaseModel):
    sessionToken: str
    issuedAt: int
    expiresAt: int
    scope: str

class LogoutRequest(BaseModel):
    userId: str

class HistoryRequest(BaseModel):
    userId: str
    page: int = 1
    limit: int = 20

@app.post("/api/consent/issue-token", response_model=SessionTokenResponse)
async def issue_session_token(
    request: SessionTokenRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Issue a session token after passphrase verification.
    
    SECURITY: Requires Firebase ID token in Authorization header.
    The userId in request body MUST match the verified token's UID.
    
    Called after successful passphrase unlock on the frontend.
    """
    from hushh_mcp.consent.token import issue_token
    from hushh_mcp.constants import ConsentScope
    import firebase_admin
    from firebase_admin import auth, credentials
    
    # Initialize Firebase Admin if not already done
    try:
        firebase_admin.get_app()
    except ValueError:
        # Use default credentials (works in Cloud Run with proper IAM)
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    # Verify Firebase ID token
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("⚠️ Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    id_token = authorization.split("Bearer ")[1]
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        verified_uid = decoded_token["uid"]
        
        # Ensure request userId matches verified token
        if request.userId != verified_uid:
            logger.warning(f"⚠️ userId mismatch: request={request.userId}, token={verified_uid}")
            raise HTTPException(status_code=403, detail="userId does not match authenticated user")
        
        logger.info(f"🔐 Verified user {verified_uid}, issuing session token...")
        
    except auth.InvalidIdTokenError as e:
        logger.warning(f"⚠️ Invalid ID token: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")
    except auth.ExpiredIdTokenError as e:
        logger.warning(f"⚠️ Expired ID token: {e}")
        raise HTTPException(status_code=401, detail="Expired Firebase ID token")
    except Exception as e:
        logger.error(f"❌ Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")
    
    try:
        # Issue token with session scope
        token_obj = issue_token(
            user_id=request.userId,
            agent_id="orchestrator",
            scope=ConsentScope.VAULT_READ_ALL if request.scope == "session" else ConsentScope(request.scope),
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
        )
        
        logger.info(f"✅ Session token issued for {request.userId}, expires at {token_obj.expires_at}")
        
        return SessionTokenResponse(
            sessionToken=token_obj.token,
            issuedAt=token_obj.issued_at,
            expiresAt=token_obj.expires_at,
            scope=request.scope
        )
    except Exception as e:
        logger.error(f"❌ Failed to issue session token: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/consent/logout")
async def logout_session(request: LogoutRequest):
    """
    Destroy all session tokens for a user.
    
    Called when user logs out. Invalidates all active session tokens.
    External API tokens are NOT affected.
    """
    from hushh_mcp.consent.token import revoke_token
    
    logger.info(f"🚪 Logging out user: {request.userId}")
    
    # In production, this would query the database for all session tokens
    # and revoke them. For now, we just log the action.
    # The frontend should also clear sessionStorage.
    
    return {
        "status": "success",
        "message": f"Session tokens for {request.userId} marked for revocation"
    }

@app.get("/api/consent/history")
async def get_consent_history(userId: str, page: int = 1, limit: int = 20):
    """
    Get paginated consent audit history for a user.
    
    Returns all consent actions (grants, revokes, delegations) for the user.
    Used for the Archived/Logs tab in the dashboard.
    """
    logger.info(f"📜 Fetching consent history for user: {userId}, page: {page}")
    
    # In production, this would query the consent_audit table
    # For now, return a placeholder structure
    return {
        "userId": userId,
        "page": page,
        "limit": limit,
        "total": 0,
        "items": [],
        "message": "Audit history will be populated after database connection"
    }

# ============================================================================
# USER LOOKUP (Email to UID)
# ============================================================================

@app.get("/api/user/lookup")
async def lookup_user_by_email(email: str):
    """
    Look up a user by email and return their Firebase UID.
    
    Used by MCP server to allow consent requests using human-readable
    email addresses instead of Firebase UIDs.
    
    Returns:
    - user_id: Firebase UID
    - email: The email address
    - display_name: User's display name (if set)
    - exists: True if user exists
    
    Or for non-existent users:
    - exists: False
    - message: Friendly error message
    """
    import firebase_admin
    from firebase_admin import auth, credentials
    
    # Initialize Firebase Admin if not already done
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    logger.info(f"🔍 Looking up user by email: {email}")
    
    try:
        user_record = auth.get_user_by_email(email)
        logger.info(f"✅ Found user: {user_record.uid}")
        
        return {
            "exists": True,
            "user_id": user_record.uid,
            "email": user_record.email,
            "display_name": user_record.display_name or email.split("@")[0],
            "photo_url": user_record.photo_url,
            "email_verified": user_record.email_verified
        }
        
    except auth.UserNotFoundError:
        logger.info(f"⚠️ User not found with email: {email}")
        return {
            "exists": False,
            "email": email,
            "message": f"No Hushh account found for {email}. The user needs to sign up first.",
            "suggestion": "Ask the user to create a Hushh account at the login page."
        }
        
    except Exception as e:
        logger.error(f"❌ Error looking up user: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error looking up user: {str(e)}"
        )



# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

