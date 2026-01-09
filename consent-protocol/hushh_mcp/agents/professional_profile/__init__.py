"""
Professional Profile Agent - Domain Expert 💼

Responsible for structured career data + dynamic "Other" data.
"""
import logging

from .agent import ProfessionalProfileAgent, get_professional_agent, handle_message
from .manifest import AGENT_MANIFEST

logger = logging.getLogger(__name__)

__all__ = ["ProfessionalProfileAgent", "get_professional_agent", "handle_message", "AGENT_MANIFEST"]

logger.info("💼 Professional Profile module loaded")
