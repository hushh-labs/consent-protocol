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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import database module for consent audit
import consent_db

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

# Export data storage (still in-memory - small amount of temporary encrypted data)
_consent_exports: Dict[str, Dict] = {}  # consent_token -> encrypted export data


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
    
    # Check if consent already granted (query database)
    is_active = await consent_db.is_token_active(request.user_id, request.scope)
    if is_active:
        return ConsentResponse(
            status="already_granted",
            message="User has already granted consent for this scope."
        )
    
    # Check if request already pending (query database)
    pending = await consent_db.get_pending_requests(request.user_id)
    pending_for_scope = [p for p in pending if p.get("scope") == request.scope]
    if pending_for_scope:
        return ConsentResponse(
            status="pending",
            message="Consent request already pending. Waiting for user approval."
        )
    
    # Generate a request ID
    import uuid
    import time
    request_id = str(uuid.uuid4())[:8]
    
    # Calculate MCP poll timeout (120 seconds from now)
    now_ms = int(time.time() * 1000)
    poll_timeout_at = now_ms + (120 * 1000)  # 120 seconds MCP timeout
    
    # Store in database (mandatory)
    await consent_db.insert_event(
        user_id=request.user_id,
        agent_id=dev_info["name"],
        scope=request.scope,
        action="REQUESTED",
        request_id=request_id,
        scope_description=get_scope_description(request.scope),
        poll_timeout_at=poll_timeout_at,
        metadata={"developer_token": request.developer_token, "expiry_hours": request.expiry_hours}
    )
    logger.info(f"📋 Consent request saved to DB: {request.user_id}:{request.scope} (request_id={request_id})")
    
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
    Uses database via consent_db module for persistence.
    """
    pending_from_db = await consent_db.get_pending_requests(userId)
    logger.info(f"📋 Found {len(pending_from_db)} pending requests in DB for {userId}")
    return {"pending": pending_from_db}

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
    
    import time  # For timestamp
    
    # Get pending request from database
    pending_request = await consent_db.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
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
    
    # Get developer token from metadata or use developer name
    metadata = pending_request.get("metadata", {})
    developer_token = metadata.get("developer_token", pending_request["developer"])
    expiry_hours = metadata.get("expiry_hours", 24)
    
    # Issue token with export key embedded
    token = issue_token(
        user_id=userId,
        agent_id=f"developer:{developer_token}",
        scope=consent_scope,
        expires_in_ms=expiry_hours * 60 * 60 * 1000
    )
    
    # Store encrypted export linked to token (still in-memory for export data)
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
    
    # Log CONSENT_GRANTED to database
    await consent_db.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CONSENT_GRANTED",
        token_id=token.token,
        request_id=requestId,
        expires_at=token.expires_at
    )
    logger.info(f"✅ CONSENT_GRANTED event saved to DB")
    
    # Return token with export key for MCP decryption
    return {
        "status": "approved",
        "message": f"Consent granted to {pending_request['developer']}",
        "consent_token": token.token,
        "export_key": exportKey,  # MCP uses this to decrypt
        "expires_at": token.expires_at
    }


@app.post("/api/consent/pending/deny")
async def deny_consent(userId: str, requestId: str):
    """
    User denies a pending consent request.
    """
    logger.info(f"❌ User {userId} denying consent request {requestId}")
    
    # Get pending request from database
    pending_request = await consent_db.get_pending_by_request_id(userId, requestId)
    
    if not pending_request:
        raise HTTPException(status_code=404, detail="Consent request not found")
    
    # Log CONSENT_DENIED to database
    await consent_db.insert_event(
        user_id=userId,
        agent_id=pending_request["developer"],
        scope=pending_request["scope"],
        action="CONSENT_DENIED",
        request_id=requestId
    )
    logger.info(f"❌ CONSENT_DENIED event saved to DB")
    
    return {"status": "denied", "message": f"Consent denied to {pending_request['developer']}"}


@app.post("/api/consent/revoke")
async def revoke_consent(request: Request):
    """
    User revokes an active consent token.
    
    This removes access for the app that was previously granted consent.
    """
    body = await request.json()
    userId = body.get("userId")
    scope = body.get("scope")
    
    if not userId or not scope:
        raise HTTPException(status_code=400, detail="userId and scope are required")
    
    logger.info(f"🔒 User {userId} revoking consent for scope: {scope}")
    
    # Get the active token for this scope
    active_tokens = await consent_db.get_active_tokens(userId)
    token_to_revoke = None
    for token in active_tokens:
        if token.get("scope") == scope:
            token_to_revoke = token
            break
    
    if not token_to_revoke:
        raise HTTPException(status_code=404, detail=f"No active consent found for scope: {scope}")
    
    # Log REVOKED event to database (link to original request_id for trail)
    await consent_db.insert_event(
        user_id=userId,
        agent_id=token_to_revoke.get("agent_id", token_to_revoke.get("developer", "Unknown")),
        scope=scope,
        action="REVOKED",
        token_id=token_to_revoke.get("token_id"),
        request_id=token_to_revoke.get("request_id")  # Link to original request
    )
    logger.info(f"🔒 REVOKED event saved to DB for scope: {scope}, request_id: {token_to_revoke.get('request_id')}")
    
    return {"status": "revoked", "message": f"Consent for {scope} has been revoked"}

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
async def get_consent_history(userId: str, page: int = 1, limit: int = 50):
    """
    Get paginated consent audit history for a user.
    
    Returns all consent actions grouped by app for the Audit Log tab.
    Uses database via consent_db module for persistence.
    """
    logger.info(f"📜 Fetching consent history for user: {userId}, page: {page}")
    
    try:
        result = await consent_db.get_audit_log(userId, page, limit)
        
        # Group by agent_id for frontend display
        grouped = {}
        for item in result.get("items", []):
            agent = item.get("agent_id", "Unknown")
            if agent not in grouped:
                grouped[agent] = []
            grouped[agent].append(item)
        
        return {
            "userId": userId,
            "page": result.get("page", page),
            "limit": result.get("limit", limit),
            "total": result.get("total", 0),
            "items": result.get("items", []),
            "grouped": grouped
        }
    except Exception as e:
        logger.error(f"❌ Failed to fetch consent history: {e}")
        return {
            "userId": userId,
            "page": page,
            "limit": limit,
            "total": 0,
            "items": [],
            "grouped": {},
            "error": str(e)
        }


@app.get("/api/consent/active")
async def get_active_consents(userId: str):
    """
    Get active (non-expired) consent tokens for a user.
    
    Returns consents grouped by app for the Session tab.
    Uses database via consent_db module for persistence.
    """
    logger.info(f"🔓 Fetching active consents for user: {userId}")
    
    try:
        active_tokens = await consent_db.get_active_tokens(userId)
        
        # Group by developer/app
        grouped = {}
        for token in active_tokens:
            app = token.get("developer", "Unknown App")
            if app not in grouped:
                grouped[app] = {
                    "appName": app.replace("developer:", ""),
                    "scopes": []
                }
            grouped[app]["scopes"].append({
                "scope": token.get("scope"),
                "tokenPreview": token.get("id"),
                "issuedAt": token.get("issued_at"),
                "expiresAt": token.get("expires_at"),
                "timeRemainingMs": token.get("time_remaining_ms", 0)
            })
        
        return {"grouped": grouped, "active": active_tokens}
    except Exception as e:
        logger.error(f"❌ Failed to fetch active consents: {e}")
        return {"grouped": {}, "active": [], "error": str(e)}

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

