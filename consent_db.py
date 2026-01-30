# consent_db.py
"""
Consent Database Module (Backward Compatibility Shim)

This file re-exports all functions from the modular db/ package
to maintain backward compatibility with existing imports.

For new code, prefer importing directly from db/ submodules.
"""

# Re-export everything from modular db package
from db import (
    DATABASE_URL,
    close_pool,
    get_active_tokens,
    get_audit_log,
    get_pending_by_request_id,
    # Queries
    get_pending_requests,
    # Connection
    get_pool,
    hash_token,
    # Consent events
    insert_event,
    is_token_active,
)

__all__ = [
    "get_pool",
    "close_pool",
    "hash_token",
    "DATABASE_URL",
    "insert_event",
    "get_pending_requests",
    "get_pending_by_request_id",
    "get_active_tokens",
    "is_token_active",
    "get_audit_log",
]

