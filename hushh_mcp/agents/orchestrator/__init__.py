# hushh_mcp/agents/orchestrator/__init__.py

"""
Hushh Orchestrator - The Conductor 🎼

The central routing agent for user requests.
MIGRATED TO ADK (v2.0.0)
"""

import logging
from typing import Dict, Any, Optional

from hushh_mcp.types import UserID
from .agent import get_orchestrator, OrchestratorAgent

logger = logging.getLogger(__name__)

# Re-export for compatibility
__all__ = ["handle_user_message", "OrchestratorAgent"]


# ============================================================================
# COMPATIBILITY WRAPPERS
# ============================================================================

def handle_user_message(
    message: str,
    user_id: UserID = "user_anonymous"
) -> Dict[str, Any]:
    """
    Main entry point for handling user messages.
    Wraps the new ADK OrchestratorAgent.
    """
    agent = get_orchestrator()
    return agent.handle_message(message, user_id=user_id)
