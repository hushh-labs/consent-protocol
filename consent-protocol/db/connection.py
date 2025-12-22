# db/connection.py
"""
Database connection pool management.
"""

import os
import hashlib
import logging
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

# Database connection pool (singleton)
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
    """SHA-256 hash of consent token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()
