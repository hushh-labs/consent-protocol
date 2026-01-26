# api/routes/agents.py
"""
Agent chat endpoints for Food & Dining and Professional Profile agents.
"""

import logging

from fastapi import APIRouter, HTTPException

from api.models import ChatRequest, ChatResponse, ValidateTokenRequest
from hushh_mcp.agents.food_dining.agent import get_food_dining_agent
from hushh_mcp.agents.professional_profile.agent import get_professional_agent
from hushh_mcp.agents.kai.agent import get_kai_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Agents"])


# ============================================================================
# TOKEN VALIDATION
# ============================================================================

@router.post("/validate-token")
async def validate_token_endpoint(request: ValidateTokenRequest):
    """
    Validate a consent token.
    Used by frontend to verify tokens before performing privileged actions.
    """
    from hushh_mcp.consent.token import validate_token
    
    try:
        # Validate signature and expiration
        valid, reason, token_obj = validate_token(request.token)
        
        if not valid:
            # SECURITY: Return generic message, log detailed reason server-side
            logger.warning(f"Token validation failed: {reason}")
            return {"valid": False, "reason": "Token validation failed"}
            
        return {
            "valid": True, 
            "user_id": token_obj.user_id,
            "agent_id": token_obj.agent_id,
            "scope": token_obj.scope
        }
    except Exception as e:
        # SECURITY: Never expose exception details to client (CodeQL fix)
        logger.error(f"Token validation error: {e}")
        return {"valid": False, "reason": "Token validation failed"}


# ============================================================================
# FOOD & DINING AGENT
# ============================================================================

@router.post("/agents/food-dining/chat", response_model=ChatResponse)
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
        result = get_food_dining_agent().handle_message(
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

@router.post("/agents/professional-profile/chat", response_model=ChatResponse)
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
        result = get_professional_agent().handle_message(
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

@router.get("/agents/food-dining/info")
async def food_dining_info():
    """Get Food & Dining agent manifest info."""
    return get_food_dining_agent().get_agent_info()


@router.get("/agents/professional-profile/info")
async def professional_profile_info():
    """Get Professional Profile agent manifest info."""
    return get_professional_agent().get_agent_info()


# ============================================================================
# KAI FINANCIAL AGENT
# ============================================================================

@router.post("/agents/kai/chat", response_model=ChatResponse)
async def kai_chat(request: ChatRequest):
    """
    Handle Kai Financial agent chat messages.
    
    This endpoint manages the agentic flow for:
    - Fundamental Analysis
    - Sentiment Analysis
    - Valuation Analysis
    
    Orchestrates tools via Gemini 3 Flash.
    """
    logger.info(f"📈 Kai Agent: user={request.userId}, msg='{request.message[:50]}...'")
    
    try:
        result = get_kai_agent().handle_message(
            message=request.message,
            user_id=request.userId,
            # session_state=request.sessionState # Kai likely manages state in context/memory
        )
        
        # Kai's ADK agent returns 'is_complete' when tools are done.
        
        return ChatResponse(
            response=result.get("response", ""),
            sessionState=None, # Kai uses internal ADK memory
            needsConsent=False, # Handled via tools if needed in future
            isComplete=result.get("is_complete", True),
            # UI hints (Optional for Kai)
            ui_type=None, 
            options=[],
        )
    except Exception as e:
        logger.error(f"📈 Kai Agent Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents/kai/info")
async def kai_info():
    """Get Kai Financial agent manifest info."""
    return get_kai_agent().get_agent_info()
