# api/routes/developer.py
"""
Developer API v1 endpoints for external access with consent.
"""

import logging
import os
import time
import uuid

from fastapi import APIRouter, HTTPException

from api.models import ConsentRequest, ConsentResponse, DataAccessRequest, DataAccessResponse
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.services.consent_db import ConsentDBService
from shared import REGISTERED_DEVELOPERS

logger = logging.getLogger(__name__)

# Consent timeout from env var (synced with frontend and SSE)
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

router = APIRouter(prefix="/api/v1", tags=["Developer API"])

# Map underscore API format to ConsentScope enum for dot notation conversion
SCOPE_TO_ENUM = {
    "vault_read_food": ConsentScope.VAULT_READ_FOOD,
    "vault_read_professional": ConsentScope.VAULT_READ_PROFESSIONAL,
    "vault_read_finance": ConsentScope.VAULT_READ_FINANCE,
    "vault_write_food": ConsentScope.VAULT_WRITE_FOOD,
    "vault_write_professional": ConsentScope.VAULT_WRITE_PROFESSIONAL,
}


def get_scope_description(scope: str) -> str:
    """Human-readable scope descriptions."""
    descriptions = {
        # Dot notation (canonical)
        "vault.read.food": "Read your food preferences (dietary, cuisines, budget)",
        "vault.read.professional": "Read your professional profile (title, skills, experience)",
        "vault.write.food": "Write to your food preferences",
        "vault.write.professional": "Write to your professional profile",
        # Underscore notation (legacy fallback)
        "vault_read_food": "Read your food preferences (dietary, cuisines, budget)",
        "vault_read_professional": "Read your professional profile (title, skills, experience)",
        "vault_write_food": "Write to your food preferences",
        "vault_write_professional": "Write to your professional profile",
    }
    return descriptions.get(scope, f"Access: {scope}")


@router.get("")
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


@router.post("/request-consent", response_model=ConsentResponse)
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
    
    # Convert underscore scope to dot notation for consistent DB storage
    scope_enum = SCOPE_TO_ENUM.get(request.scope)
    scope_dot = scope_enum.value if scope_enum else request.scope
    
    # Check if consent already granted (query database with dot notation)
    service = ConsentDBService()
    is_active = await service.is_token_active(request.user_id, scope_dot)
    if is_active:
        # Fetch the active token to return it
        active_tokens = await service.get_active_tokens(request.user_id)
        existing_token = None
        expires_at = None
        
        for t in active_tokens:
            if t.get("scope") == scope_dot:
                existing_token = t.get("token_id")
                expires_at = t.get("expires_at")
                break
        
        if existing_token:
            return ConsentResponse(
                status="already_granted",
                message="User has already granted consent for this scope.",
                consent_token=existing_token,
                expires_at=expires_at
            )
    
    
    # Check if request already pending (query database with dot notation)
    service = ConsentDBService()
    pending = await service.get_pending_requests(request.user_id)
    pending_for_scope = [p for p in pending if p.get("scope") == scope_dot]
    if pending_for_scope:
        return ConsentResponse(
            status="pending",
            message="Consent request already pending. Waiting for user approval."
        )
    
    # Generate a request ID
    request_id = str(uuid.uuid4())[:8]
    
    # Calculate MCP poll timeout from env var
    now_ms = int(time.time() * 1000)
    poll_timeout_at = now_ms + (CONSENT_TIMEOUT_SECONDS * 1000)
    
    # Store in database with dot notation scope (mandatory)
    service = ConsentDBService()
    await service.insert_event(
        user_id=request.user_id,
        agent_id=dev_info["name"],
        scope=scope_dot,
        action="REQUESTED",
        request_id=request_id,
        scope_description=get_scope_description(scope_dot),
        poll_timeout_at=poll_timeout_at,
        metadata={"developer_token": request.developer_token, "expiry_hours": request.expiry_hours}
    )
    logger.info(f"📋 Consent request saved to DB: {request.user_id}:{scope_dot} (request_id={request_id})")
    
    return ConsentResponse(
        status="pending",
        message=f"Consent request submitted. User must approve in their dashboard. Request ID: {request_id}"
    )


@router.post("/food-data", response_model=DataAccessResponse)
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
    
    # PRODUCTION: These endpoints are deprecated - use MCP tools instead
    # The MCP flow uses /api/consent/data with zero-knowledge exports
    logger.warning("⚠️ Deprecated endpoint called: /api/v1/food-data - use MCP tools instead")
    return DataAccessResponse(
        status_code=501,
        error="This endpoint is deprecated. Use MCP tools (get_food_preferences) for data access with zero-knowledge exports."
    )


@router.post("/professional-data", response_model=DataAccessResponse)
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
    
    # PRODUCTION: These endpoints are deprecated - use MCP tools instead
    # The MCP flow uses /api/consent/data with zero-knowledge exports
    logger.warning("⚠️ Deprecated endpoint called: /api/v1/professional-data - use MCP tools instead")
    return DataAccessResponse(
        status_code=501,
        error="This endpoint is deprecated. Use MCP tools (get_professional_profile) for data access with zero-knowledge exports."
    )


@router.get("/list-scopes")
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
