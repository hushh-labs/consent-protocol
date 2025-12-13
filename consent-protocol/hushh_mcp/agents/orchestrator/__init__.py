# hushh_mcp/agents/orchestrator/__init__.py

"""
Hushh Orchestrator - The Conductor 🎼

The central routing agent for user requests:
1. Receives user input via chat
2. Classifies intent using intent_classifier operon
3. Delegates to appropriate domain agent via TrustLink
4. Returns consolidated response

Uses ONLY hushh_mcp primitives - no custom protocols.
"""

import logging
from typing import Optional

from hushh_mcp.operons.intent_classifier import (
    classify_intent,
    get_domain_description,
    should_delegate,
    IntentDomain,
    DOMAIN_TO_AGENT
)
from hushh_mcp.trust.link import create_trust_link, verify_trust_link
from hushh_mcp.constants import ConsentScope, AGENT_PORTS
from hushh_mcp.types import UserID, AgentID

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

# ============================================================================
# ORCHESTRATOR MANIFEST
# ============================================================================

AGENT_MANIFEST = {
    "agent_id": "agent_orchestrator",
    "name": "Hushh Orchestrator",
    "version": "2.0.0",
    "description": "Central routing agent that classifies user intent and delegates to domain specialists.",
    "port": AGENT_PORTS["agent_orchestrator"],
    "capabilities": [
        "intent_classification",
        "domain_routing",
        "a2a_delegation"
    ],
    "delegates_to": list(DOMAIN_TO_AGENT.values())
}


# ============================================================================
# DELEGATION FUNCTIONS
# ============================================================================

def delegate_to_domain(
    domain: IntentDomain,
    task: str,
    user_id: UserID,
    orchestrator_id: AgentID = "agent_orchestrator"
) -> dict:
    """
    Delegates a task to a specific domain agent using TrustLink.
    
    Args:
        domain: The classified domain
        task: The user's original request
        user_id: The user making the request
        orchestrator_id: This agent's ID
        
    Returns:
        Dict with delegation details and TrustLink
    """
    target_agent = DOMAIN_TO_AGENT.get(domain, "agent_orchestrator")
    target_port = AGENT_PORTS.get(target_agent, 10003)
    
    # Determine appropriate scope for delegation
    scope_map = {
        IntentDomain.FOOD_DINING: ConsentScope.AGENT_FOOD_COLLECT,
        IntentDomain.PROFESSIONAL: ConsentScope.AGENT_IDENTITY_VERIFY,
        IntentDomain.FINANCE: ConsentScope.AGENT_FINANCE_ANALYZE,
    }
    scope = scope_map.get(domain, ConsentScope.CUSTOM_TEMPORARY)
    
    # Create TrustLink for delegation
    trust_link = create_trust_link(
        from_agent=orchestrator_id,
        to_agent=target_agent,
        scope=scope,
        signed_by_user=user_id
    )
    
    logger.info(f"🔄 DELEGATING to {target_agent} (port {target_port})")
    logger.info(f"   Task: {task[:50]}...")
    logger.info(f"   TrustLink: {trust_link.from_agent} → {trust_link.to_agent}")
    
    return {
        "delegated": True,
        "target_agent": target_agent,
        "target_port": target_port,
        "domain": domain.value,
        "domain_description": get_domain_description(domain),
        "trust_link": {
            "from_agent": trust_link.from_agent,
            "to_agent": trust_link.to_agent,
            "scope": str(trust_link.scope),
            "expires_at": trust_link.expires_at,
            "signature": trust_link.signature[:20] + "..."  # Truncate for display
        },
        "message": f"I'll connect you to our {get_domain_description(domain).split(',')[0]} specialist."
    }


def handle_user_message(
    message: str,
    user_id: UserID = "user_anonymous"
) -> dict:
    """
    Main entry point for handling user messages.
    
    Args:
        message: The user's message
        user_id: The user's ID for consent tracking
        
    Returns:
        Response dict with either direct response or delegation info
    """
    logger.info(f"📨 Received message from {user_id}: {message[:50]}...")
    
    # Step 1: Classify intent
    domain, agent_id, confidence = classify_intent(message)
    
    logger.info(f"🎯 Classified as {domain.value} (confidence: {confidence:.2f})")
    
    # Step 2: Check if delegation is needed
    if should_delegate(domain) and confidence >= 0.5:
        # Delegate to domain agent
        delegation = delegate_to_domain(
            domain=domain,
            task=message,
            user_id=user_id
        )
        return {
            "response": delegation["message"],
            "delegation": delegation
        }
    else:
        # Handle directly (general/unknown intent)
        return {
            "response": f"I understand you're asking about something general. Could you tell me more specifically what you'd like help with? I can assist with:\n\n"
                       f"• 🍽️ Food & Dining preferences\n"
                       f"• 💼 Professional profile & career\n"
                       f"• 💰 Financial analysis\n"
                       f"• ❤️ Health & wellness\n"
                       f"• ✈️ Travel planning",
            "delegation": None,
            "intent": {
                "domain": domain.value,
                "confidence": confidence
            }
        }


# ============================================================================
# AGENT CLASS (for testing and direct usage)
# ============================================================================

class HushhOrchestratorAgent:
    """
    Orchestrator Agent Class
    
    Can be used directly for testing or wrapped with ADK for A2A.
    """
    
    def __init__(self, agent_id: str = "agent_orchestrator"):
        self.agent_id = agent_id
        self.manifest = AGENT_MANIFEST
        
    def handle(self, message: str, user_id: UserID = "user_anonymous") -> dict:
        """Handle incoming message."""
        return handle_user_message(message, user_id)
    
    def get_agent_info(self) -> dict:
        """Get agent manifest information."""
        return {
            "agent_id": self.agent_id,
            "manifest": self.manifest,
            "status": "active",
            "version": self.manifest["version"]
        }


# Create default instance
orchestrator = HushhOrchestratorAgent()

logger.info(f"🚀 Orchestrator Agent v{AGENT_MANIFEST['version']} initialized on port {AGENT_MANIFEST['port']}!")
