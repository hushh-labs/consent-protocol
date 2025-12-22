# mcp/tools/__init__.py
"""
MCP tool definitions and handlers.
"""

from .definitions import get_tool_definitions
from .consent_tools import handle_request_consent, handle_check_consent_status
from .data_tools import handle_get_food, handle_get_professional
from .utility_tools import handle_validate_token, handle_delegate, handle_list_scopes

__all__ = [
    "get_tool_definitions",
    "handle_request_consent",
    "handle_check_consent_status",
    "handle_get_food",
    "handle_get_professional",
    "handle_validate_token",
    "handle_delegate",
    "handle_list_scopes",
]
