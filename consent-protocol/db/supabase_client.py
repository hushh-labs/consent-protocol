# db/supabase_client.py
"""
Supabase REST API Client - Service Layer Only

⚠️ SECURITY WARNING: This module should ONLY be imported by service layer files.
API routes must NOT directly access Supabase client.
Use VaultDBService, ConsentDBService, etc. instead.

Architecture:
  API Route → Service Layer (validates consent) → Supabase Client → Database
"""

import os
import logging
from typing import Optional

from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Singleton Supabase client instance
_supabase: Optional[Client] = None


def get_supabase() -> Client:
    """
    Get Supabase client instance.
    
    ⚠️ SECURITY WARNING: This function should ONLY be called from service layer.
    API routes must NOT directly access Supabase client.
    Use VaultDBService, ConsentDBService, etc. instead.
    
    Returns:
        Supabase Client instance
        
    Raises:
        EnvironmentError: If SUPABASE_URL or SUPABASE_KEY are not set
    """
    global _supabase
    
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_KEY environment variables are required. "
                "Set them in .env or as environment variables."
            )
        
        logger.info(f"Initializing Supabase client for {url}")
        _supabase = create_client(url, key)
        logger.info("✅ Supabase client initialized")
    
    return _supabase


def close_supabase():
    """Close Supabase client (if needed for cleanup)."""
    global _supabase
    if _supabase is not None:
        # Supabase client doesn't have explicit close, but we can reset the instance
        _supabase = None
        logger.info("🔒 Supabase client closed")
