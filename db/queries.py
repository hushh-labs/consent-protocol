# db/queries.py
"""
Database query operations for consent management.

Includes:
- Pending requests (consent requests awaiting user approval)
- Active tokens (granted consents that haven't expired or been revoked)
- Audit log (full history of consent events)
"""

import json
from datetime import datetime
from typing import Optional, List, Dict

from .connection import get_pool


# ============================================================================
# Pending Requests
# ============================================================================

async def get_pending_requests(user_id: str) -> List[Dict]:
    """
    Get pending consent requests for a user.
    A request is pending if it has REQUESTED action with no resolution.
    """
    pool = await get_pool()
    
    query = """
        WITH latest_per_request AS (
            SELECT DISTINCT ON (request_id)
                id, user_id, request_id, agent_id, scope, scope_description,
                action, poll_timeout_at, issued_at, metadata
            FROM consent_audit
            WHERE user_id = $1 AND request_id IS NOT NULL
            ORDER BY request_id, issued_at DESC
        )
        SELECT * FROM latest_per_request
        WHERE action = 'REQUESTED'
          AND (poll_timeout_at IS NULL OR poll_timeout_at > $2)
        ORDER BY issued_at DESC
    """
    
    now_ms = int(datetime.now().timestamp() * 1000)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, user_id, now_ms)
        results = []
        for row in rows:
            # Extract expiryHours from metadata JSON
            metadata = row['metadata'] or {}
            if isinstance(metadata, str):
                metadata = json.loads(metadata) if metadata else {}
            expiry_hours = metadata.get('expiry_hours', 24)
            
            results.append({
                "id": row['request_id'],
                "developer": row['agent_id'],
                "scope": row['scope'],
                "scopeDescription": row['scope_description'],
                "requestedAt": row['issued_at'],
                "pollTimeoutAt": row['poll_timeout_at'],
                "expiryHours": expiry_hours,
            })
        return results


async def get_pending_by_request_id(user_id: str, request_id: str) -> Optional[Dict]:
    """Get a specific pending request by request_id."""
    pool = await get_pool()
    
    query = """
        SELECT * FROM consent_audit
        WHERE user_id = $1 AND request_id = $2
        ORDER BY issued_at DESC
        LIMIT 1
    """
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, user_id, request_id)
        if row and row['action'] == 'REQUESTED':
            return {
                "request_id": row['request_id'],
                "developer": row['agent_id'],
                "scope": row['scope'],
                "scope_description": row['scope_description'],
                "poll_timeout_at": row['poll_timeout_at'],
                "issued_at": row['issued_at'],
            }
        return None


# ============================================================================
# Active Tokens
# ============================================================================

async def get_active_tokens(user_id: str) -> List[Dict]:
    """
    Get active consent tokens for a user.
    Active = CONSENT_GRANTED with no subsequent REVOKED and not expired.
    """
    pool = await get_pool()
    
    now_ms = int(datetime.now().timestamp() * 1000)
    
    query = """
        WITH latest_per_scope AS (
            SELECT DISTINCT ON (scope)
                id, user_id, agent_id, scope, action, token_id,
                expires_at, issued_at, request_id
            FROM consent_audit
            WHERE user_id = $1 AND action IN ('CONSENT_GRANTED', 'REVOKED')
            ORDER BY scope, issued_at DESC
        )
        SELECT * FROM latest_per_scope
        WHERE action = 'CONSENT_GRANTED' AND (expires_at IS NULL OR expires_at > $2)
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, user_id, now_ms)
        return [
            {
                "id": row['token_id'][:20] + "..." if row['token_id'] else str(row['id']),
                "scope": row['scope'],
                "developer": row['agent_id'],
                "agent_id": row['agent_id'],
                "issued_at": row['issued_at'],
                "expires_at": row['expires_at'],
                "time_remaining_ms": (row['expires_at'] - now_ms) if row['expires_at'] else 0,
                "request_id": row['request_id'],
                "token_id": row['token_id'],
            }
            for row in rows
        ]


async def is_token_active(user_id: str, scope: str) -> bool:
    """Check if there's an active token for user+scope."""
    pool = await get_pool()
    
    now_ms = int(datetime.now().timestamp() * 1000)
    
    query = """
        SELECT action, expires_at FROM consent_audit
        WHERE user_id = $1 AND scope = $2 AND action IN ('CONSENT_GRANTED', 'REVOKED')
        ORDER BY issued_at DESC
        LIMIT 1
    """
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, user_id, scope)
        if row and row['action'] == 'CONSENT_GRANTED':
            return row['expires_at'] is None or row['expires_at'] > now_ms
        return False


# ============================================================================
# Audit Log
# ============================================================================

async def get_audit_log(user_id: str, page: int = 1, limit: int = 50) -> Dict:
    """Get paginated audit log for a user."""
    pool = await get_pool()
    
    offset = (page - 1) * limit
    
    query = """
        SELECT id, token_id, agent_id, scope, action, issued_at, expires_at, request_id
        FROM consent_audit
        WHERE user_id = $1
        ORDER BY issued_at DESC
        LIMIT $2 OFFSET $3
    """
    
    count_query = "SELECT COUNT(*) FROM consent_audit WHERE user_id = $1"
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, user_id, limit, offset)
        total = await conn.fetchval(count_query, user_id)
        
        return {
            "items": [
                {
                    "id": str(row['id']),
                    "token_id": row['token_id'][:20] + "..." if row['token_id'] and len(row['token_id']) > 20 else row['token_id'] or "N/A",
                    "agent_id": row['agent_id'],
                    "scope": row['scope'],
                    "action": row['action'],
                    "issued_at": row['issued_at'],
                    "expires_at": row['expires_at'],
                    "request_id": row['request_id'],
                }
                for row in rows
            ],
            "total": total,
            "page": page,
            "limit": limit,
        }
