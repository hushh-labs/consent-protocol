# db/consent.py
"""
Consent event insertion operations.
"""

import json
import logging
from datetime import datetime
from typing import Optional, Dict

from .connection import get_pool

logger = logging.getLogger(__name__)


async def insert_event(
    user_id: str,
    agent_id: str,
    scope: str,
    action: str,
    token_id: str = None,
    request_id: Optional[str] = None,
    scope_description: Optional[str] = None,
    expires_at: Optional[int] = None,
    poll_timeout_at: Optional[int] = None,
    metadata: Optional[Dict] = None
) -> int:
    """
    Insert a consent event into consent_audit table.
    
    Uses event-sourcing pattern - all actions (REQUESTED, GRANTED, DENIED, REVOKED)
    are separate events. The latest event per scope determines current state.
    
    Returns the event ID.
    """
    pool = await get_pool()
    
    issued_at = int(datetime.now().timestamp() * 1000)
    token_id = token_id or f"evt_{issued_at}"
    
    query = """
        INSERT INTO consent_audit (
            token_id, user_id, agent_id, scope, action,
            request_id, scope_description, issued_at, expires_at, poll_timeout_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    """
    
    metadata_json = json.dumps(metadata or {})
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query, token_id, user_id, agent_id, scope, action,
            request_id, scope_description, issued_at, expires_at, poll_timeout_at, metadata_json
        )
        event_id = row['id']
        logger.info(f"Inserted {action} event: {event_id}")
        return event_id


async def log_operation(
    user_id: str,
    operation: str,
    target: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> int:
    """
    Log an operation performed using vault.owner token.
    
    This provides granular audit logging for vault owner operations,
    showing WHAT operation was performed (e.g., kai.analyze) and
    on WHAT target (e.g., AAPL ticker).
    
    Args:
        user_id: The user performing the operation
        operation: The operation type (e.g., "kai.analyze", "kai.preferences.read")
        target: Optional target of the operation (e.g., "AAPL" for ticker analysis)
        metadata: Additional context to store
    
    Returns:
        The event ID
    """
    operation_metadata = {
        "operation": operation,
        **({"target": target} if target else {}),
        **(metadata or {})
    }
    
    return await insert_event(
        user_id=user_id,
        agent_id="self",
        scope="vault.owner",
        action="OPERATION_PERFORMED",
        scope_description=operation,
        metadata=operation_metadata
    )
