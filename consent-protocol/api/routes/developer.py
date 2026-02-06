# api/routes/developer.py
"""
Developer API v1 endpoints for external access with consent.

Only world-model scopes are supported: world_model.read, world_model.write, attr.{domain}.*
"""

import logging
import os
import time
import uuid

from fastapi import APIRouter, HTTPException

from api.models import ConsentRequest, ConsentResponse, DataAccessRequest
from hushh_mcp.consent.scope_helpers import get_scope_description as get_dynamic_scope_description
from hushh_mcp.consent.scope_helpers import normalize_scope, resolve_scope_to_enum
from hushh_mcp.services.consent_db import ConsentDBService
from shared import REGISTERED_DEVELOPERS

# World-model scopes only (dot notation). API accepts these or API-format equivalents (e.g. attr_food).
VALID_WORLD_MODEL_SCOPES = {
    "world_model.read",
    "world_model.write",
    "attr.food.*",
    "attr.professional.*",
    "attr.financial.*",
    "attr.health.*",
    "attr.kai_decisions.*",
}

logger = logging.getLogger(__name__)

# Consent timeout from env var (synced with frontend and SSE)
CONSENT_TIMEOUT_SECONDS = int(os.environ.get("CONSENT_TIMEOUT_SECONDS", "120"))

router = APIRouter(prefix="/api/v1", tags=["Developer API"])


def get_scope_description(scope: str) -> str:
    """
    Human-readable scope descriptions.
    
    Delegated to centralized dynamic scope resolution.
    """
    return get_dynamic_scope_description(scope)


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
    
    # Normalize to dot notation for storage and validation (e.g. attr_food -> attr.food.*)
    scope_dot = normalize_scope(request.scope)
    if scope_dot not in VALID_WORLD_MODEL_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scope: {request.scope}. Use world_model.read, world_model.write, or attr.{{domain}}.* (e.g. attr.food.*)"
        )

    # Verify scope is allowed for this developer
    approved = dev_info["approved_scopes"]
    if "*" not in approved and scope_dot not in approved:
        raise HTTPException(status_code=403, detail=f"Scope '{scope_dot}' not approved for this developer")

    # Resolve to enum for token issuance
    scope_enum = resolve_scope_to_enum(scope_dot)
    
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
        existing_id = pending_for_scope[0].get("id") or pending_for_scope[0].get("request_id")
        return ConsentResponse(
            status="pending",
            message="Consent request already pending. Waiting for user approval.",
            request_id=existing_id
        )
    
    # Generate a request ID
    request_id = str(uuid.uuid4())[:8]
    
    # Pending request lifetime: use expiry_hours (capped at 24) so request stays pending for long timeouts
    now_ms = int(time.time() * 1000)
    pending_hours = min(max(1, request.expiry_hours), 24)
    poll_timeout_at = now_ms + int(pending_hours * 3600 * 1000)
    
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
        message=f"Consent request submitted. User must approve in their dashboard. Request ID: {request_id}",
        request_id=request_id
    )


@router.post("/food-data")
async def get_food_data(_request: DataAccessRequest):
    """Removed: use world-model for domain data."""
    raise HTTPException(status_code=410, detail="Gone. Use world-model API for domain data.")


@router.post("/professional-data")
async def get_professional_data(_request: DataAccessRequest):
    """Removed: use world-model for domain data."""
    raise HTTPException(status_code=410, detail="Gone. Use world-model API for domain data.")


@router.get("/list-scopes")
async def list_available_scopes():
    """
    List all available consent scopes (world-model only).

    Developers can reference this to understand what data they can request.
    """
    return {
        "scopes": [
            {"name": "world_model.read", "description": "Read full world model (all domains)"},
            {"name": "world_model.write", "description": "Write to world model"},
            {"name": "attr.food.*", "description": "Read user's food preferences (dietary, cuisines, budget)"},
            {"name": "attr.professional.*", "description": "Read user's professional profile (title, skills, experience)"},
            {"name": "attr.financial.*", "description": "Read user's financial data"},
            {"name": "attr.health.*", "description": "Read user's health and wellness data"},
            {"name": "attr.kai_decisions.*", "description": "Read/write Kai decision history"},
        ]
    }
