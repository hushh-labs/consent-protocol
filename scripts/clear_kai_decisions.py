#!/usr/bin/env python3
"""
Clear all existing Kai decision stores from vault_kai table.
This removes all previously auto-saved decisions.
"""

import asyncio
import os

import asyncpg

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/hushh_vault")

async def clear_kai_decisions():
    """Delete all records from vault_kai table."""
    print("🗑️  Clearing all Kai decision stores...")
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Count existing records
        count = await conn.fetchval("SELECT COUNT(*) FROM vault_kai")
        print(f"   Found {count} existing decision(s)")
        
        if count == 0:
            print("   ✅ No decisions to delete")
            return
        
        # Delete all
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
