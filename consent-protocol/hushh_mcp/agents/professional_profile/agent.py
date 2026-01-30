"""
Hushh Professional Profile Agent (ADK Port)

Conversational career assistant using LLM-driven slot filling.
MIGRATED TO ADK (v2.0.0)
"""

import logging
import os
from typing import Any, Dict

from hushh_mcp.hushh_adk.core import HushhAgent
from hushh_mcp.hushh_adk.manifest import ManifestLoader
from hushh_mcp.types import UserID

# Import tools
from .tools import save_professional_profile

logger = logging.getLogger(__name__)

class ProfessionalProfileAgent(HushhAgent):
    """
    Agentic Professional Profile Builder.
    """
    
    def __init__(self):
        manifest_path = os.path.join(os.path.dirname(__file__), "agent.yaml")
        self.manifest = ManifestLoader.load(manifest_path)
        
        super().__init__(
            name=self.manifest.name,
            model=self.manifest.model,
            system_prompt=self.manifest.system_instruction,
            tools=[save_professional_profile],
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
        try:
            # Execute ADK run
            response = self.run(message, user_id=user_id, consent_token=consent_token)
            
            return {
                "response": response.text if hasattr(response, 'text') else str(response),
                # TODO: Inspect tool calls to determine completeness
                "is_complete": False 
            }
            
        except Exception as e:
            logger.error(f"ProfessionalAgent error: {e}")
            return {
                "response": "I encountered an error managing your profile. Please check your permissions.",
                "error": str(e)
            }

# Singleton
_prof_agent = None

def get_professional_agent():
    global _prof_agent
    if not _prof_agent:
        _prof_agent = ProfessionalProfileAgent()
    return _prof_agent
