# hushh_mcp/agents/professional_profile/__init__.py
"""
Professional Profile Agent 💼

Career profile builder.
MIGRATED TO ADK (v2.0.0)
"""

from typing import Dict, Any, Optional
from hushh_mcp.types import UserID
from .agent import get_professional_agent, ProfessionalProfileAgent

__all__ = ["handle_message", "ProfessionalProfileAgent", "get_professional_agent"]

def handle_message(
    message: str,
    user_id: UserID,
    session_state: Optional[Dict] = None
) -> Dict[str, Any]:
    """Compatibility wrapper for the new ADK agent."""
    agent = get_professional_agent()
    return agent.handle_message(message, user_id, consent_token="")
