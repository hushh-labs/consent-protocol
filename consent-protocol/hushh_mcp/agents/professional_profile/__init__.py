"""
Professional Profile Agent - Domain Expert 💼

Responsible for structured career data + dynamic "Other" data.
"""
import logging

from .agent import (
    professional_agent,
    handle_message,
    ProfessionalProfileAgent
)

logger = logging.getLogger(__name__)

__all__ = [
    "professional_agent",
    "handle_message",
    "ProfessionalProfileAgent"
]

logger.info("💼 Professional Profile module loaded")


