# db/connection.py
"""
Database connection pool management.

This module provides direct PostgreSQL connection via asyncpg.
It is the PRIMARY connection method for all database operations.

Usage:
    from db.connection import get_pool
    
    async def my_function():
        pool = await get_pool()
        result = await pool.fetch("SELECT * FROM users")
"""

import hashlib
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

# Database connection pool (singleton)
_pool: Optional[asyncpg.Pool] = None

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.warning(
        "DATABASE_URL not set. Direct PostgreSQL connection will not be available. "
        "Set DATABASE_URL in .env file."
    )


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool.
    
    Returns:
        asyncpg.Pool: The database connection pool
        
    Raises:
        EnvironmentError: If DATABASE_URL is not configured
    """
    global _pool
    
    if not DATABASE_URL:
        raise EnvironmentError(
            "DATABASE_URL is required for database operations. "
            "Set DATABASE_URL in your .env file."
        )
    
    if _pool is None:
        logger.info("Connecting to PostgreSQL...")
        
        # Supabase requires SSL connections
        ssl_config = None
        if "supabase.co" in DATABASE_URL:
            ssl_config = "require"
            logger.info("SSL enabled for Supabase connection")
        
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
            max_inactive_connection_lifetime=300,
            ssl=ssl_config
        )
        logger.info(
            f"PostgreSQL pool created: min={_pool.get_min_size()}, "
            f"max={_pool.get_max_size()}"
        )
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


def hash_token(token: str) -> str:
    """SHA-256 hash of consent token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()
