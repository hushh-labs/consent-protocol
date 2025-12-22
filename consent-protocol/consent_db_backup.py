"""
Consent Database Module

PostgreSQL connection pool and helper functions for consent storage.
Uses consent_audit table as single source of truth (event-sourcing pattern).
"""

import os
import hashlib
import asyncpg
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)

# Database connection pool
_pool: Optional[asyncpg.Pool] = None

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"
)


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        logger.info(f"📦 Connecting to PostgreSQL...")
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("✅ PostgreSQL connection pool created")
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("🔒 PostgreSQL connection pool closed")


def hash_token(token: str) -> str:
    """SHA-256 hash of consent token."""
    return hashlib.sha256(token.encode()).hexdigest()


# ============================================================================
# Event Insertion (uses consent_audit table)
# ============================================================================

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
    """Insert a consent event into consent_audit table and return its ID."""
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
        logger.info(f"📝 Inserted {action} event: {event_id}")
        return event_id


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
                import json
                metadata = json.loads(metadata) if metadata else {}
            expiry_hours = metadata.get('expiry_hours', 24)  # Default 24 hours
            
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
