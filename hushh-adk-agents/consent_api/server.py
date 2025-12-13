"""
Hushh Consent API
=================

FastAPI server that exposes the consent-protocol (HushhMCP) as a REST API.
This imports from the consent-protocol submodule and exposes endpoints
for the hushh-webapp to consume.

Run: python -m consent_api.server
"""

import sys
from pathlib import Path

# Add consent-protocol to path so we can import from it
CONSENT_PROTOCOL_PATH = Path(__file__).parent.parent.parent / "consent-protocol"
sys.path.insert(0, str(CONSENT_PROTOCOL_PATH))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

# Import from consent-protocol
from hushh_mcp.consent.token import issue_token, validate_token, revoke_token
from hushh_mcp.trust.link import create_trust_link
from hushh_mcp.constants import ConsentScope

# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="Hushh Consent API",
    description="REST API for the Hushh AI Consent Protocol (HushhMCP)",
    version="1.0.0",
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Request/Response Models
# =============================================================================

class IssueTokenRequest(BaseModel):
    user_id: str
    agent_id: str
    scope: str  # e.g., "vault.read.email"
    expires_in_ms: Optional[int] = None


class IssueTokenResponse(BaseModel):
    token: str
    user_id: str
    agent_id: str
    scope: str
    issued_at: int
    expires_at: int


class ValidateTokenRequest(BaseModel):
    token: str
    expected_scope: Optional[str] = None


class ValidateTokenResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    scope: Optional[str] = None


class RevokeTokenRequest(BaseModel):
    token: str


class CreateTrustLinkRequest(BaseModel):
    from_agent: str
    to_agent: str
    scope: str
    signed_by_user: str


class TrustLinkResponse(BaseModel):
    from_agent: str
    to_agent: str
    scope: str
    signed_by_user: str
    signature: str
    expires_at: int


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "hushh-consent-api", "version": "1.0.0"}


@app.get("/api/consent/scopes")
def list_available_scopes():
    """List all available consent scopes."""
    return {
        "scopes": [
            {"value": scope.value, "name": scope.name}
            for scope in ConsentScope
        ]
    }


@app.post("/api/consent/issue", response_model=IssueTokenResponse)
def api_issue_token(request: IssueTokenRequest):
    """Issue a new consent token for a user/agent/scope combination."""
    try:
        scope = ConsentScope(request.scope)
        
        kwargs = {"user_id": request.user_id, "agent_id": request.agent_id, "scope": scope}
        if request.expires_in_ms:
            kwargs["expires_in_ms"] = request.expires_in_ms
        
        token_obj = issue_token(**kwargs)
        
        return IssueTokenResponse(
            token=token_obj.token,
            user_id=token_obj.user_id,
            agent_id=token_obj.agent_id,
            scope=token_obj.scope.value if hasattr(token_obj.scope, 'value') else str(token_obj.scope),
            issued_at=token_obj.issued_at,
            expires_at=token_obj.expires_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {request.scope}. Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/consent/validate", response_model=ValidateTokenResponse)
def api_validate_token(request: ValidateTokenRequest):
    """Validate a consent token."""
    try:
        expected_scope = None
        if request.expected_scope:
            expected_scope = ConsentScope(request.expected_scope)
        
        is_valid, error, token_obj = validate_token(request.token, expected_scope)
        
        if is_valid and token_obj:
            return ValidateTokenResponse(
                valid=True,
                user_id=token_obj.user_id,
                agent_id=token_obj.agent_id,
                scope=token_obj.scope.value if hasattr(token_obj.scope, 'value') else str(token_obj.scope),
            )
        else:
            return ValidateTokenResponse(valid=False, error=error)
    except Exception as e:
        return ValidateTokenResponse(valid=False, error=str(e))


@app.post("/api/consent/revoke")
def api_revoke_token(request: RevokeTokenRequest):
    """Revoke a consent token."""
    try:
        revoke_token(request.token)
        return {"success": True, "message": "Token revoked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trust/link", response_model=TrustLinkResponse)
def api_create_trust_link(request: CreateTrustLinkRequest):
    """Create a trust link between two agents."""
    try:
        scope = ConsentScope(request.scope)
        
        trust_link = create_trust_link(
            from_agent=request.from_agent,
            to_agent=request.to_agent,
            scope=scope,
            signed_by_user=request.signed_by_user,
        )
        
        return TrustLinkResponse(
            from_agent=trust_link.from_agent,
            to_agent=trust_link.to_agent,
            scope=trust_link.scope.value if hasattr(trust_link.scope, 'value') else str(trust_link.scope),
            signed_by_user=trust_link.signed_by_user,
            signature=trust_link.signature,
            expires_at=trust_link.expires_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {request.scope}. Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Food API Endpoints
# =============================================================================

# Add operons to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from operons.food.dietary_profile import GetDietaryProfileOperon
from operons.food.food_preferences import GetFoodPreferencesOperon
from operons.food.dining_history import GetDiningHistoryOperon


class FoodDataRequest(BaseModel):
    user_id: str  # Phone number in E.164 format
    token: str    # Consent token


class DiningHistoryRequest(BaseModel):
    user_id: str
    token: str
    limit: Optional[int] = 10
    meal_type: Optional[str] = None
    start_date: Optional[str] = None


@app.post("/api/food/profile")
def get_dietary_profile(request: FoodDataRequest):
    """Get user's dietary profile (diet type, allergies, restrictions)."""
    operon = GetDietaryProfileOperon()
    result = operon.run(token=request.token, user_id=request.user_id)
    
    if result.success:
        return {"status": "success", "data": result.data, "scope_used": result.scope_used}
    else:
        raise HTTPException(status_code=403, detail=result.error)


@app.post("/api/food/preferences")
def get_food_preferences(request: FoodDataRequest):
    """Get user's food preferences (cuisines, ingredients, spice level)."""
    operon = GetFoodPreferencesOperon()
    result = operon.run(token=request.token, user_id=request.user_id)
    
    if result.success:
        return {"status": "success", "data": result.data, "scope_used": result.scope_used}
    else:
        raise HTTPException(status_code=403, detail=result.error)


@app.post("/api/food/history")
def get_dining_history(request: DiningHistoryRequest):
    """Get user's dining history (restaurant visits, orders, spend)."""
    operon = GetDiningHistoryOperon()
    result = operon.run(
        token=request.token, 
        user_id=request.user_id,
        limit=request.limit,
        meal_type=request.meal_type,
        start_date=request.start_date
    )
    
    if result.success:
        return {"status": "success", "data": result.data, "count": len(result.data)}
    else:
        raise HTTPException(status_code=403, detail=result.error)


# =============================================================================
# Run Server
# =============================================================================

def main():
    """Run the consent API server."""
    print("🚀 Starting Hushh Consent API on http://localhost:8000")
    print("📖 API docs: http://localhost:8000/docs")
    print("🍽️  Food endpoints: /api/food/profile, /api/food/preferences, /api/food/history")
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
