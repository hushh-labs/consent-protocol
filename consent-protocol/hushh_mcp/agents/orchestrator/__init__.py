"""
Hushh Orchestrator - The Conductor 🎼

1. Receives user input.
2. Identifies correct Domain Agent.
3. Delegates/Routes the task.
"""
from google.adk.agents import LlmAgent
# Tool import removed as it gave ImportError. LlmAgent accepts functions directly.

logger = logging.getLogger(__name__)

# ============================================================================
# DELEGATION TOOLS
# ============================================================================

def delegate_to_domain(domain_agent_id: str, task: str) -> str:
    """
    Delegates a task to a specific domain agent.
    
    Args:
        domain_agent_id: ID of the agent (e.g., 'agent_professional_profile').
        task: The user's original request or processed instruction.
    """
    logger.info(f"🔄 DELEGATING to {domain_agent_id}: {task}")
    
    # In a real system, this calls the A2A endpoint of the other agent.
    # For now, we simulate the text response the Orchestrator would receive.
    
    if domain_agent_id == "agent_professional_profile":
        return f"[System Event: Connected to Professional Agent]\nProfessional Agent says: I can help with that. Please provide the details."
        
    return "Error: Unknown agent."

tools = [
     Tool(
        name="delegate_to_domain",
        description="Routes the conversation to a specialized agent.",
        func=delegate_to_domain
    )
]

SYSTEM_INSTRUCTION = """
You are the **Hushh Orchestrator**.
You are the first line of defense and the intelligent router for the user.

## Capabilities
- You do NOT store data yourself.
- You identify **User Intent**.
- You **Delegate** to the right specialist.

## Domain Map
1. **Professional / Career** -> `agent_professional_profile`
2. **Finance** -> `agent_finance` (Not active yet)

## Behavior
If a user says "I want to update my resume", you do NOT say "Okay tell me".
You say "I'll connect you to the Professional Profile agent for that" and call `delegate_to_domain`.
"""

logger.info("🚀 Initializing Orchestrator Agent...")

root_agent = LlmAgent(
    model="gemini-2.0-flash",
    name="agent_orchestrator",
    description="Main user interface router.",
    instruction=SYSTEM_INSTRUCTION,
    tools=tools
)

# Port 10003 for Orchestrator (Replacing the old Self Profile port)
a2a_app = to_a2a(root_agent, port=10003)
