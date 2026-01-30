"""
Hushh Food & Dining Agent (ADK Port)

Personalized dining assistant using LLM-driven slot filling.
MIGRATED TO ADK (v2.0.0)
"""

import logging
import os
from typing import Any, Dict

from hushh_mcp.hushh_adk.core import HushhAgent
from hushh_mcp.hushh_adk.manifest import ManifestLoader
from hushh_mcp.types import UserID

# Import tools
from .tools import analyze_spending, get_restaurant_recommendations, save_food_preferences

logger = logging.getLogger(__name__)

class FoodDiningAgent(HushhAgent):
    """
    Agentic Food Assistant.
    """
    
    def __init__(self):
        # Load manifest
        manifest_path = os.path.join(os.path.dirname(__file__), "agent.yaml")
        self.manifest = ManifestLoader.load(manifest_path)
        
        super().__init__(
            name=self.manifest.name,
            model=self.manifest.model,
            system_prompt=self.manifest.system_instruction,
            tools=[
                get_restaurant_recommendations,
                analyze_spending,
                save_food_preferences
            ],
            required_scopes=self.manifest.required_scopes
        )
        
    def handle_message(
        self,
        message: str,
        user_id: UserID,
        consent_token: str = ""
    ) -> Dict[str, Any]:
        """
        Agentic Entry Point.
        """
        # Token is required for this agent
        # We allow the caller to pass it, or we might need to handle a 'handshake'
        # For this port, we assume the token comes from the Orchestrator or UI session.
        
        if not consent_token:
            # If no token, we can still run but tools will fail/prompt for consent
            # Ideally, we should prompt for one.
            pass
            
        try:
            # Execute ADK run
            response = self.run(message, user_id=user_id, consent_token=consent_token)
            
            return {
                "response": response.text if hasattr(response, 'text') else str(response),
                "is_complete": False # TODO: inspect tool calls to see if 'save' was called
            }
            
        except Exception as e:
            logger.error(f"FoodAgent error: {e}")
            return {
                "response": "I encountered an error accessing your dining profile. Please check your permissions.",
                "error": str(e)
            }


# Singleton
_food_agent = None

def get_food_dining_agent():
    global _food_agent
    if not _food_agent:
        _food_agent = FoodDiningAgent()
    return _food_agent
