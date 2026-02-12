"""
Orchestrator Tools

Delegation functions for the Orchestrator agent.
These tools are used by the LLM to route requests to specialized agents.
"""

from typing import Any, Dict

from hushh_mcp.hushh_adk.context import HushhContext
from hushh_mcp.hushh_adk.tools import hushh_tool


# Helper to standard delegation response
def _create_delegation_response(
    domain: str, target_agent: str, context: HushhContext
) -> Dict[str, Any]:
    return {
        "delegated": True,
        "target_agent": target_agent,
        "domain": domain,
        "message": f"I'm connecting you with our {domain} specialist.",
    }


@hushh_tool(scope="", name="delegate_to_food_agent")
def delegate_to_food_agent() -> Dict[str, Any]:
    """Delegate current conversation to Food & Dining Agent."""
    ctx = HushhContext.current()
    return _create_delegation_response("food_dining", "agent_food_dining", ctx)


@hushh_tool(scope="", name="delegate_to_professional_agent")
def delegate_to_professional_agent() -> Dict[str, Any]:
    """Delegate current conversation to Professional Profile Agent."""
    ctx = HushhContext.current()
    return _create_delegation_response("professional_profile", "agent_professional_profile", ctx)


@hushh_tool(scope="", name="delegate_to_kai_agent")
def delegate_to_kai_agent() -> Dict[str, Any]:
    """Delegate current conversation to Kai Investment Agent."""
    ctx = HushhContext.current()
    return _create_delegation_response("kai_investment", "agent_kai", ctx)
