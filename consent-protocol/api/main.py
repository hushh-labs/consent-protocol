# Backend API for Food Dining Agent
# Exposes consent-protocol agent as REST API

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional

# Import from parent consent-protocol directory
from hushh_mcp.agents.food_dining import HushhFoodDiningAgent
from hushh_mcp.types import EncryptedPayload

app = FastAPI(title="Hushh Food Agent API")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class EncryptedPayloadModel(BaseModel):
    ciphertext: str
    iv: str
    tag: str
    encoding: str = "base64"
    algorithm: str = "aes-256-gcm"

class RecommendationRequest(BaseModel):
    userId: str
    consentToken: str
    vaultKey: str  # Hex string from client
    preferences: Dict[str, EncryptedPayloadModel]
    restaurants: Optional[List[Dict]] = None

class RecommendationResponse(BaseModel):
    recommendations: List[Dict]
    user_id: str
    agent_id: str

# ============================================================================
# AGENT INSTANCE
# ============================================================================

food_agent = HushhFoodDiningAgent()

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.post("/api/agents/food-dining/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get personalized restaurant recommendations.
    
    Flow:
    1. Client sends vault key + encrypted preferences
    2. Agent validates consent token
    3. Agent decrypts preferences with vault key
    4. Agent runs operons (dietary, budget, cuisine)
    5. Returns ranked recommendations
    """
    try:
        # Convert Pydantic models to dict for agent
        vault_data = {
            scope: EncryptedPayload(
                ciphertext=payload.ciphertext,
                iv=payload.iv,
                tag=payload.tag,
                encoding=payload.encoding,
                algorithm=payload.algorithm
            )
            for scope, payload in request.preferences.items()
        }
        
        # Use mock restaurants if none provided
        restaurants = request.restaurants or get_mock_restaurants()
        
        # Call agent
        recommendations = food_agent.get_restaurant_recommendations(
            user_id=request.userId,
            consent_token=request.consentToken,
            vault_key_hex=request.vaultKey,
            user_vault_data=vault_data,
            restaurants=restaurants,
            max_results=5
        )
        
        return RecommendationResponse(
            recommendations=recommendations,
            user_id=request.userId,
            agent_id=food_agent.agent_id
        )
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

@app.get("/api/agents/food-dining/info")
async def get_agent_info():
    """Get agent manifest and capabilities."""
    return food_agent.get_agent_info()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "agent": "food_dining"}


# ============================================================================
# CONVERSATIONAL CHAT ENDPOINT
# ============================================================================

class ChatRequest(BaseModel):
    """Request for conversational chat."""
    userId: str
    message: str
    sessionState: Optional[Dict] = None

class ChatResponse(BaseModel):
    """Response from conversational chat."""
    response: str
    sessionState: Dict
    collectedData: Dict
    isComplete: bool
    needsConsent: bool
    consentScope: Optional[List[str]] = None
    # UI hints for frontend
    ui_type: Optional[str] = None  # 'checkbox', 'buttons', etc.
    options: Optional[List[str]] = None
    allow_custom: Optional[bool] = None
    allow_none: Optional[bool] = None

@app.post("/api/agents/food-dining/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Conversational chat endpoint for collecting preferences.
    
    Flow:
    1. User sends message
    2. Agent responds with next question
    3. Session state tracks conversation progress
    4. On completion, collected data is ready for vault storage
    
    Example session:
        POST /chat { userId: "user_123", message: "hi", sessionState: null }
        -> { response: "Let's set up preferences...", sessionState: {step: "dietary"} }
        
        POST /chat { userId: "user_123", message: "vegan", sessionState: {step: "dietary"} }
        -> { response: "Got it! Now cuisines...", sessionState: {step: "cuisines", collected: {dietary: ["vegan"]}} }
    """
    try:
        result = food_agent.handle_message(
            message=request.message,
            user_id=request.userId,
            session_state=request.sessionState
        )
        
        return ChatResponse(
            response=result["response"],
            sessionState=result["session_state"],
            collectedData=result.get("collected_data", {}),
            isComplete=result.get("is_complete", False),
            needsConsent=result.get("needs_consent", False),
            consentScope=result.get("consent_scope"),
            ui_type=result.get("ui_type"),
            options=result.get("options"),
            allow_custom=result.get("allow_custom"),
            allow_none=result.get("allow_none")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

# ============================================================================
# MOCK DATA
# ============================================================================

def get_mock_restaurants():
    """Sample restaurants for testing."""
    return [
        {
            "name": "Green Garden Bistro",
            "cuisine": "italian",
            "avg_price": 18.50,
            "tags": {"vegan", "gluten_free", "organic"},
            "rating": 4.5
        },
        {
            "name": "Sushi Zen",
            "cuisine": "japanese",
            "avg_price": 22.00,
            "tags": {"gluten_free", "halal"},
            "rating": 4.7
        },
        {
            "name": "Mama's Trattoria",
            "cuisine": "italian",
            "avg_price": 15.00,
            "tags": {"vegetarian"},
            "rating": 4.3
        },
        {
            "name": "Spice Route",
            "cuisine": "indian",
            "avg_price": 12.00,
            "tags": {"vegan", "halal", "gluten_free"},
            "rating": 4.6
        },
        {
            "name": "Tokyo Ramen House",
            "cuisine": "japanese",
            "avg_price": 14.00,
            "tags": set(),
            "rating": 4.4
        },
        {
            "name": "Mediterranean Grill",
            "cuisine": "mediterranean",
            "avg_price": 20.00,
            "tags": {"halal", "vegetarian"},
            "rating": 4.8
        },
        {
            "name": "Thai Basil",
            "cuisine": "thai",
            "avg_price": 16.00,
            "tags": {"vegan", "gluten_free"},
            "rating": 4.5
        },
        {
            "name": "Pasta Paradise",
            "cuisine": "italian",
            "avg_price": 25.00,
            "tags": {"vegetarian"},
            "rating": 4.2
        }
    ]

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
