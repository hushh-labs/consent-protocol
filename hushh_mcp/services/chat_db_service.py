# consent-protocol/hushh_mcp/services/chat_db_service.py
"""
Chat Database Service - DEPRECATED.

The chat_conversations and chat_messages tables are being dropped.
All CRUD methods now raise NotImplementedError.

Types/enums (MessageRole, ContentType, ComponentType, Conversation, ChatMessage)
are kept for backward-compatible imports.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

_DEPRECATION_MSG = (
    "chat_conversations / chat_messages tables have been removed. "
    "Chat persistence must migrate to the world_model_data blob or "
    "a client-side store."
)


class MessageRole(str, Enum):
    """Role of message sender."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ContentType(str, Enum):
    """Type of message content."""

    TEXT = "text"
    COMPONENT = "component"
    TOOL_USE = "tool_use"


class ComponentType(str, Enum):
    """Types of insertable UI components."""

    ANALYSIS = "analysis"
    PORTFOLIO_IMPORT = "portfolio_import"
    DECISION_CARD = "decision_card"
    HOLDINGS_CHART = "holdings_chart"
    WORLD_MODEL_SUMMARY = "world_model_summary"
    LOSER_REPORT = "loser_report"
    CONSENT_REQUEST = "consent_request"


@dataclass
class Conversation:
    """Chat conversation metadata."""

    id: str
    user_id: str
    title: Optional[str] = None
    agent_context: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Encryption fields
    title_ciphertext: Optional[str] = None
    title_iv: Optional[str] = None
    title_tag: Optional[str] = None
    encryption_status: str = "pending"


@dataclass
class ChatMessage:
    """Chat message with optional component and encryption support."""

    id: str
    conversation_id: str
    role: MessageRole
    content: str
    content_type: ContentType = ContentType.TEXT
    component_type: Optional[ComponentType] = None
    component_data: Optional[dict] = None
    tokens_used: Optional[int] = None
    model_used: Optional[str] = None
    created_at: Optional[datetime] = None
    # Encryption fields
    content_ciphertext: Optional[str] = None
    content_iv: Optional[str] = None
    content_tag: Optional[str] = None
    component_data_ciphertext: Optional[str] = None
    component_data_iv: Optional[str] = None
    component_data_tag: Optional[str] = None
    encryption_status: str = "pending"


class ChatDBService:
    """
    DEPRECATED — chat_conversations / chat_messages tables have been removed.

    All methods raise NotImplementedError.
    """

    def __init__(self):
        pass

    # ==================== CONVERSATION OPERATIONS ====================

    async def create_conversation(self, *args, **kwargs) -> Optional[Conversation]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def list_conversations(self, user_id: str, **kwargs) -> list[Conversation]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def update_conversation(self, conversation_id: str, **kwargs) -> bool:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def delete_conversation(self, conversation_id: str) -> bool:
        raise NotImplementedError(_DEPRECATION_MSG)

    # ==================== MESSAGE OPERATIONS ====================

    async def add_message(self, *args, **kwargs) -> Optional[ChatMessage]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def get_messages(self, conversation_id: str, **kwargs) -> list[ChatMessage]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def get_recent_context(self, conversation_id: str, **kwargs) -> list[dict]:
        raise NotImplementedError(_DEPRECATION_MSG)

    # ==================== COMPONENT HELPERS ====================

    async def add_analysis_component(self, *args, **kwargs) -> Optional[ChatMessage]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def add_decision_card(self, *args, **kwargs) -> Optional[ChatMessage]:
        raise NotImplementedError(_DEPRECATION_MSG)

    async def add_loser_report(self, *args, **kwargs) -> Optional[ChatMessage]:
        raise NotImplementedError(_DEPRECATION_MSG)


# Singleton instance
_chat_db_service: Optional[ChatDBService] = None


def get_chat_db_service() -> ChatDBService:
    """Get singleton ChatDBService instance."""
    global _chat_db_service
    if _chat_db_service is None:
        _chat_db_service = ChatDBService()
    return _chat_db_service
