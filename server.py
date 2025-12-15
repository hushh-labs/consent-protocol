# consent-protocol/server.py
"""
FastAPI Server for Hushh Consent Protocol Agents

Serves all agent chat endpoints that the Next.js frontend calls.
Run with: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import os

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

# Also keep the hardcoded Cloud Run URL for backward compatibility
cors_origins.append("https://hushh-webapp-1006304528804.us-central1.run.app")

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

@app.post("/api/v1/request-consent", response_model=ConsentResponse)
async def request_consent(request: ConsentRequest):
    """
    Request consent from a user for data access.
    
    External developers call this to request permission to access
    specific user data. The user will be notified and must approve.
    
    Follows Hushh Core Principle: "Consent First"
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
    
    # Store pending consent (in production, send notification to user)
    _pending_consents[consent_key] = {
        "developer": dev_info["name"],
        "scope": request.scope,
        "expiry_hours": request.expiry_hours,
        "requested_at": int(__import__("time").time() * 1000)
    }
    
    # For demo: auto-approve consent (in production, user must approve)
    # Issue consent token
    scope_map = {
        "vault_read_food": ConsentScope.VAULT_READ_FOOD,
        "vault_read_professional": ConsentScope.VAULT_READ_PROFESSIONAL,
        "vault_write_food": ConsentScope.VAULT_WRITE_FOOD,
        "vault_write_professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
    }
    
    consent_scope = scope_map.get(request.scope)
    if not consent_scope:
        raise HTTPException(status_code=400, detail=f"Unknown scope: {request.scope}")
    
    token = issue_token(
        user_id=request.user_id,
        agent_id=f"developer:{request.developer_token}",
        scope=consent_scope,
        expires_in_ms=request.expiry_hours * 60 * 60 * 1000
    )
    
    # Store granted consent
    _granted_consents[consent_key] = token.token
    
    logger.info(f"✅ Consent granted: {consent_key}")
    
    return ConsentResponse(
        status="granted",
        message=f"Consent granted. Token expires in {request.expiry_hours} hours.",
        consent_token=token.token,
        expires_at=token.expires_at
    )

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
# RUN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

