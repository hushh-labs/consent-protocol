# db/connection.py
"""
Database connection pool management.

⚠️ DEPRECATED ⚠️
This module is deprecated and will be removed in a future version.
All database operations should now use Supabase REST API through service layer.

Migration:
- Old: from db.connection import get_pool
- New: Use service layer (VaultDBService, ConsentDBService, InvestorDBService)

This file is kept temporarily for:
- Schema creation scripts (db/migrate.py) which still need asyncpg for DDL
- Legacy code that hasn't been migrated yet

DO NOT use this in:
- API routes (use service layer instead)
- Service layer (use db.supabase_client instead)
"""

import hashlib
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

# Database connection pool (singleton)
_pool: Optional[asyncpg.Pool] = None

# Database URL from environment (optional now - we use Supabase REST API)
DATABASE_URL = os.getenv("DATABASE_URL")

# Warn if DATABASE_URL is not set, but don't error at import time
# since we've migrated to Supabase REST API (error is deferred to get_pool())
if not DATABASE_URL:
    logger.warning(
        "⚠️ DATABASE_URL not set. Legacy asyncpg pool will not be available. "
        "This is expected if using Supabase REST API (the new architecture)."
    )


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool.
    
    ⚠️ DEPRECATED: This is only for legacy code. New code should use
    the service layer with Supabase REST API instead.
    """
    global _pool
    
    # Guard: Raise error if DATABASE_URL not configured
    if not DATABASE_URL:
        raise EnvironmentError(
            "DATABASE_URL is required for legacy asyncpg pool. "
            "If using Supabase REST API, use service layer instead of db.get_pool()."
        )
    
    if _pool is None:
        logger.info("Connecting to PostgreSQL...")
        
        # Supabase requires SSL connections
        ssl_config = None
        if DATABASE_URL and "supabase.co" in DATABASE_URL:
            ssl_config = "require"
            logger.info("SSL enabled for Supabase")
        
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=3,  # Increased from 2
            max_size=20,  # Increased from 10 for better scaling
            command_timeout=60,
            max_inactive_connection_lifetime=300,  # Close idle connections after 5min
            ssl=ssl_config
        )
        logger.info(
            f"✅ PostgreSQL pool created: min={_pool.get_min_size()}, "
            f"max={_pool.get_max_size()}"
        )
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("🔒 PostgreSQL connection pool closed")


def hash_token(token: str) -> str:
    """SHA-256 hash of consent token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()
