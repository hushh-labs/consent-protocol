# consent-protocol/hushh_mcp/services/chat_db_service.py
"""
Chat Database Service - Persistent chat history with insertable components.

This service manages chat conversations and messages, supporting:
- Persistent conversation history
- Insertable UI components (analysis, portfolio import, etc.)
- Message metadata (tokens, model used)
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)


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


@dataclass
class ChatMessage:
    """Chat message with optional component."""
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


class ChatDBService:
    """
    Service for managing persistent chat history.
    
    Supports industry-standard chat patterns with:
    - Conversation threads
    - Message history with pagination
    - Insertable UI components
    - Token tracking
    """
    
    def __init__(self):
        self._supabase = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase()
        return self._supabase
    
    # ==================== CONVERSATION OPERATIONS ====================
    
    async def create_conversation(
        self,
        user_id: str,
        title: Optional[str] = None,
        agent_context: Optional[dict] = None,
    ) -> Optional[Conversation]:
        """Create a new conversation."""
        try:
            data = {
                "user_id": user_id,
                "title": title,
                "agent_context": agent_context,
            }
            
            result = self.supabase.table("chat_conversations").insert(data).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return Conversation(
                id=row["id"],
                user_id=row["user_id"],
                title=row.get("title"),
                agent_context=row.get("agent_context"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            return None
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """Get a conversation by ID."""
        try:
            result = self.supabase.table("chat_conversations").select("*").eq(
                "id", conversation_id
            ).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return Conversation(
                id=row["id"],
                user_id=row["user_id"],
                title=row.get("title"),
                agent_context=row.get("agent_context"),
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        except Exception as e:
            logger.error(f"Error getting conversation: {e}")
            return None
    
    async def list_conversations(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Conversation]:
        """List user's conversations, most recent first."""
        try:
            result = self.supabase.table("chat_conversations").select("*").eq(
                "user_id", user_id
            ).order(
                "updated_at", desc=True
            ).range(offset, offset + limit - 1).execute()
            
            return [
                Conversation(
                    id=row["id"],
                    user_id=row["user_id"],
                    title=row.get("title"),
                    agent_context=row.get("agent_context"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                )
                for row in result.data
            ]
        except Exception as e:
            logger.error(f"Error listing conversations: {e}")
            return []
    
    async def update_conversation(
        self,
        conversation_id: str,
        title: Optional[str] = None,
        agent_context: Optional[dict] = None,
    ) -> bool:
        """Update conversation metadata."""
        try:
            data = {"updated_at": datetime.utcnow().isoformat()}
            if title is not None:
                data["title"] = title
            if agent_context is not None:
                data["agent_context"] = agent_context
            
            self.supabase.table("chat_conversations").update(data).eq(
                "id", conversation_id
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error updating conversation: {e}")
            return False
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation and all its messages."""
        try:
            # Messages are deleted via CASCADE
            self.supabase.table("chat_conversations").delete().eq(
                "id", conversation_id
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting conversation: {e}")
            return False
    
    # ==================== MESSAGE OPERATIONS ====================
    
    async def add_message(
        self,
        conversation_id: str,
        role: MessageRole,
        content: str,
        content_type: ContentType = ContentType.TEXT,
        component_type: Optional[ComponentType] = None,
        component_data: Optional[dict] = None,
        tokens_used: Optional[int] = None,
        model_used: Optional[str] = None,
    ) -> Optional[ChatMessage]:
        """Add a message to a conversation."""
        try:
            data = {
                "conversation_id": conversation_id,
                "role": role.value,
                "content": content,
                "content_type": content_type.value,
                "component_type": component_type.value if component_type else None,
                "component_data": component_data,
                "tokens_used": tokens_used,
                "model_used": model_used,
            }
            
            result = self.supabase.table("chat_messages").insert(data).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            
            # Update conversation's updated_at
            await self.update_conversation(conversation_id)
            
            return ChatMessage(
                id=row["id"],
                conversation_id=row["conversation_id"],
                role=MessageRole(row["role"]),
                content=row["content"],
                content_type=ContentType(row["content_type"]),
                component_type=ComponentType(row["component_type"]) if row.get("component_type") else None,
                component_data=row.get("component_data"),
                tokens_used=row.get("tokens_used"),
                model_used=row.get("model_used"),
                created_at=row.get("created_at"),
            )
        except Exception as e:
            logger.error(f"Error adding message: {e}")
            return None
    
    async def get_messages(
        self,
        conversation_id: str,
        limit: int = 50,
        before_id: Optional[str] = None,
    ) -> list[ChatMessage]:
        """Get messages for a conversation, most recent first."""
        try:
            query = self.supabase.table("chat_messages").select("*").eq(
                "conversation_id", conversation_id
            )
            
            if before_id:
                # Get messages before a specific message (for pagination)
                before_msg = self.supabase.table("chat_messages").select("created_at").eq(
                    "id", before_id
                ).execute()
                if before_msg.data:
                    query = query.lt("created_at", before_msg.data[0]["created_at"])
            
            result = query.order("created_at", desc=True).limit(limit).execute()
            
            # Return in chronological order
            messages = [
                ChatMessage(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=MessageRole(row["role"]),
                    content=row["content"],
                    content_type=ContentType(row["content_type"]),
                    component_type=ComponentType(row["component_type"]) if row.get("component_type") else None,
                    component_data=row.get("component_data"),
                    tokens_used=row.get("tokens_used"),
                    model_used=row.get("model_used"),
                    created_at=row.get("created_at"),
                )
                for row in result.data
            ]
            return list(reversed(messages))
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []
    
    async def get_recent_context(
        self,
        conversation_id: str,
        max_messages: int = 10,
    ) -> list[dict]:
        """Get recent messages formatted for LLM context."""
        messages = await self.get_messages(conversation_id, limit=max_messages)
        
        return [
            {
                "role": msg.role.value,
                "content": msg.content,
            }
            for msg in messages
            if msg.role in [MessageRole.USER, MessageRole.ASSISTANT]
        ]
    
    # ==================== COMPONENT HELPERS ====================
    
    async def add_analysis_component(
        self,
        conversation_id: str,
        ticker: str,
        analysis_result: dict,
    ) -> Optional[ChatMessage]:
        """Add an analysis component message."""
        return await self.add_message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content=f"Analysis for {ticker}",
            content_type=ContentType.COMPONENT,
            component_type=ComponentType.ANALYSIS,
            component_data={"ticker": ticker, "result": analysis_result},
        )
    
    async def add_decision_card(
        self,
        conversation_id: str,
        decision: dict,
    ) -> Optional[ChatMessage]:
        """Add a decision card component message."""
        ticker = decision.get("ticker", "Unknown")
        action = decision.get("decision", "HOLD")
        return await self.add_message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content=f"Decision for {ticker}: {action}",
            content_type=ContentType.COMPONENT,
            component_type=ComponentType.DECISION_CARD,
            component_data=decision,
        )
    
    async def add_loser_report(
        self,
        conversation_id: str,
        losers: list[dict],
    ) -> Optional[ChatMessage]:
        """Add a portfolio loser report component."""
        return await self.add_message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content=f"Identified {len(losers)} potential losers in your portfolio",
            content_type=ContentType.COMPONENT,
            component_type=ComponentType.LOSER_REPORT,
            component_data={"losers": losers},
        )


# Singleton instance
_chat_db_service: Optional[ChatDBService] = None


def get_chat_db_service() -> ChatDBService:
    """Get singleton ChatDBService instance."""
    global _chat_db_service
    if _chat_db_service is None:
        _chat_db_service = ChatDBService()
    return _chat_db_service
