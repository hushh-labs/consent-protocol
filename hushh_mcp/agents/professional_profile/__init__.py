"""
Professional Profile Agent - Domain Expert 💼

Responsible for structured career data + dynamic "Other" data.
"""
import logging
import json
from google.adk.agents import LlmAgent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

logger = logging.getLogger(__name__)

# ============================================================================
# SCHEMA & TOOLS
# ============================================================================

def store_career_data(data_type: str, content: str, metadata: str = "{}") -> str:
    """
    Stores structured career data.
    Args:
        data_type: One of 'resume', 'skills', 'experience', 'education'.
        content: The actual data.
        metadata: JSON string for any extra/dynamic fields AI detected.
    """
    logger.info(f"💾 Storing {data_type}: {content[:50]}... with metadata: {metadata}")
    # In real impl, this writes to the user's encrypted vault
    return f"SUCCESS: Stored your {data_type}."

tools = [store_career_data]

SYSTEM_INSTRUCTION = """
You are the **Professional Profile Agent**.
Your ONLY job is to manage the user's professional data.

## Schema
You accept data for:
- Resume
- Skills
- Experience
- Education

## Dynamic Data ("Other")
If the user provides information that doesn't fit neatly (e.g., "I won a hackathon in 2023"),
you must still capture it. Use the `metadata` JSON field in `store_career_data` to structure this
however you see fit (e.g., `{"award": "Hackathon Winner", "year": 2023}`).

## Interaction
- You are typically called by the Orchestrator, not the user directly.
- Confirm actions clearly.
"""

logger.info("🚀 Initializing Professional Profile Agent...")

root_agent = LlmAgent(
    model="gemini-2.0-flash", # Assuming the user intended to keep the model or change it to a valid string. The provided snippet was malformed.
    name="agent_professional_profile",
    description="Domain expert for career data.",
    instruction=SYSTEM_INSTRUCTION,
    tools=tools # The original code already passes functions directly in a list, so no "wrapper" to remove.
)

# Port 10004 for Professional Agent
a2a_app = to_a2a(root_agent, port=10004)
