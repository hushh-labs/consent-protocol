#!/usr/bin/env python3
"""
Clear all existing Kai decision stores from vault_kai table.
This removes all previously auto-saved decisions.

Uses DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME (same as runtime — strict parity).
"""

import asyncio
import os
import sys

# Load .env so DB_* are set before importing db
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncpg
from db.connection import get_database_url, get_database_ssl


async def clear_kai_decisions():
    """Delete all records from vault_kai table."""
    try:
        url = get_database_url()
        ssl = get_database_ssl()
    except EnvironmentError as e:
        print(f"❌ {e}")
        sys.exit(1)
    print("🗑️  Clearing all Kai decision stores...")
    conn = await asyncpg.connect(url, ssl=ssl)
    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM vault_kai")
        print(f"   Found {count} existing decision(s)")
        if count == 0:
            print("   ✅ No decisions to delete")
            return
        deleted = await conn.execute("DELETE FROM vault_kai")
        print(f"   ✅ Deleted all records: {deleted}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(clear_kai_decisions())
