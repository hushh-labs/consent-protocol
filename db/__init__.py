# db/__init__.py
"""
Database modules for Hushh consent protocol.

Provides modular access to:
- connection: Pool management
- consent: Consent event operations
- queries: Pending requests, active tokens, audit log
"""

from .connection import DATABASE_URL, close_pool, get_pool, hash_token
from .consent import insert_event
from .queries import (
    get_active_tokens,
    get_audit_log,
    get_pending_by_request_id,
    get_pending_requests,
    is_token_active,
)

__all__ = [
    # Connection
    "get_pool",
    "close_pool",
    "hash_token",
    "DATABASE_URL",
    # Consent events
    "insert_event",
    # Queries
    "get_pending_requests",
    "get_pending_by_request_id",
    "get_active_tokens",
    "is_token_active",
    "get_audit_log",
]

