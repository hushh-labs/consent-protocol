# db/connection.py
"""
Database connection pool management.

This module provides direct PostgreSQL connection via asyncpg using
Supabase's session pooler credentials.

Usage:
    from db.connection import get_pool
    
    async def my_function():
        pool = await get_pool()
        result = await pool.fetch("SELECT * FROM users")

Connection Method:
    Uses individual DB_* environment variables (shared pooler method):
    - DB_USER: Supabase pooler username (e.g., postgres.project-ref)
    - DB_PASSWORD: Database password
    - DB_HOST: Pooler host (e.g., aws-1-us-east-1.pooler.supabase.com)
    - DB_PORT: Port (default 5432)
    - DB_NAME: Database name (default postgres)
"""

import hashlib
import logging
import os
from typing import Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Database connection pool (singleton)
_pool: Optional[asyncpg.Pool] = None


def get_database_url() -> str:
    """
    Build database URL from DB_* environment variables (single source of truth).
    Used by runtime pool, migrations, and scripts. No DATABASE_URL.
    """
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "postgres")
    if not all([db_user, db_password, db_host]):
        raise EnvironmentError(
            "Database credentials not set. Required: DB_USER, DB_PASSWORD, DB_HOST. "
            "Optional: DB_PORT (default 5432), DB_NAME (default postgres). "
            "Set in .env; get from Supabase Dashboard → Project Settings → Database → Connection Pooling."
        )
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def get_database_ssl():
    """Return ssl config for asyncpg when using Supabase pooler."""
    db_host = os.getenv("DB_HOST", "")
    if "supabase.com" in db_host or "pooler.supabase" in db_host:
        return "require"
    return None


def _get_database_url() -> str:
    """Internal alias for get_database_url (used by get_pool)."""
    return get_database_url()


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool.
    
    Returns:
        asyncpg.Pool: The database connection pool
        
    Raises:
        EnvironmentError: If database credentials are not configured
    """
    global _pool
    
    if _pool is None:
        database_url = _get_database_url()
        ssl_config = get_database_ssl()
        db_host = os.getenv("DB_HOST", "")
        logger.info(f"Connecting to PostgreSQL at {db_host}...")
        if ssl_config:
            logger.info("SSL enabled for Supabase pooler connection")
        _pool = await asyncpg.create_pool(
            database_url,
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
