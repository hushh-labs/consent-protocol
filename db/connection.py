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

import os
import hashlib
import logging
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

# Database connection pool (singleton)
_pool: Optional[asyncpg.Pool] = None

# Database URL from environment (REQUIRED - no hardcoded fallback for security)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise EnvironmentError(
        "DATABASE_URL environment variable is required. "
        "Set it in .env or as an environment variable."
    )


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        logger.info(f"Connecting to PostgreSQL...")
        
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
