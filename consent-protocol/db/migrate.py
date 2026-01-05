#!/usr/bin/env python3
"""
Database Migration Script - Modular Per-Table

Usage:
    python db/migrate.py --table vault_keys        # Create vault_keys table
    python db/migrate.py --table vault_food        # Create vault_food table
    python db/migrate.py --table vault_professional # Create vault_professional table
    python db/migrate.py --table consent_audit     # Create consent_audit table
    python db/migrate.py --table session_tokens    # Create session_tokens table
    python db/migrate.py --consent                 # Create all consent-related tables
    python db/migrate.py --full                    # Drop and recreate ALL tables (DESTRUCTIVE!)
    python db/migrate.py --clear consent_audit     # Clear specific table
    python db/migrate.py --status                  # Show table summary

Environment:
    DATABASE_URL - PostgreSQL connection string
"""

import argparse
import asyncio
import os
import sys

import asyncpg


# Database URL from environment (REQUIRED - no hardcoded fallback for security)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL environment variable is required.")
    print("   Set it in .env or as an environment variable.")
    print("   Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname")
    sys.exit(1)


# ============================================================================
# TABLE DEFINITIONS (Modular)
# ============================================================================

async def create_vault_keys(pool: asyncpg.Pool):
    """Create vault_keys table (user authentication keys)."""
    print("📦 Creating vault_keys table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS vault_keys (
            user_id TEXT PRIMARY KEY,
            auth_method TEXT NOT NULL DEFAULT 'passphrase',
            encrypted_vault_key TEXT NOT NULL,
            salt TEXT NOT NULL,
            iv TEXT NOT NULL,
            recovery_encrypted_vault_key TEXT NOT NULL,
            recovery_salt TEXT NOT NULL,
            recovery_iv TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT
        )
    """)
    print("✅ vault_keys ready!")


async def create_vault_food(pool: asyncpg.Pool):
    """Create vault_food table (food & dining domain data)."""
    print("🍽️  Creating vault_food table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS vault_food (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            field_name TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            algorithm TEXT DEFAULT 'aes-256-gcm',
            created_at BIGINT NOT NULL,
            updated_at BIGINT,
            consent_token_id TEXT,
            UNIQUE(user_id, field_name)
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_vault_food_user ON vault_food(user_id)")
    print("✅ vault_food ready!")


async def create_vault_professional(pool: asyncpg.Pool):
    """Create vault_professional table (professional profile domain data)."""
    print("💼 Creating vault_professional table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS vault_professional (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            field_name TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            algorithm TEXT DEFAULT 'aes-256-gcm',
            created_at BIGINT NOT NULL,
            updated_at BIGINT,
            consent_token_id TEXT,
            UNIQUE(user_id, field_name)
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_vault_professional_user ON vault_professional(user_id)")
    print("✅ vault_professional ready!")


async def create_consent_audit(pool: asyncpg.Pool):
    """Create consent_audit table (consent token audit trail)."""
    print("📋 Creating consent_audit table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS consent_audit (
            id SERIAL PRIMARY KEY,
            token_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            action TEXT NOT NULL,
            issued_at BIGINT NOT NULL,
            expires_at BIGINT,
            revoked_at BIGINT,
            metadata JSONB,
            token_type VARCHAR(20) DEFAULT 'consent',
            ip_address VARCHAR(45),
            user_agent TEXT,
            request_id VARCHAR(32),
            scope_description TEXT,
            poll_timeout_at BIGINT
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_audit(user_id)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_token ON consent_audit(token_id)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit(issued_at DESC)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_audit_user_action ON consent_audit(user_id, action)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_audit_request_id ON consent_audit(request_id) WHERE request_id IS NOT NULL")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_consent_audit_pending ON consent_audit(user_id) WHERE action = 'REQUESTED'")
    print("✅ consent_audit ready!")


async def create_session_tokens(pool: asyncpg.Pool):
    """Create session_tokens table."""
    print("🔐 Creating session_tokens table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS session_tokens (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            scope TEXT DEFAULT 'session',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            is_active BOOLEAN DEFAULT TRUE,
            ip_address VARCHAR(45),
            user_agent TEXT
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(user_id, is_active)")
    print("✅ session_tokens ready!")


# Note: Revocation is tracked in consent_audit table with action='REVOKED'
# No separate revoked_tokens table needed.


async def create_kai_sessions(pool: asyncpg.Pool):
    """Create kai_sessions table (Kai onboarding & analysis state)."""
    print("🤖 Creating kai_sessions table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS kai_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            processing_mode TEXT CHECK (processing_mode IN ('on_device', 'hybrid')),
            risk_profile TEXT CHECK (risk_profile IN ('conservative', 'balanced', 'aggressive')),
            legal_acknowledged BOOLEAN DEFAULT FALSE,
            onboarding_complete BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_sessions_user ON kai_sessions(user_id)")
    print("✅ kai_sessions ready!")


async def create_kai_decisions(pool: asyncpg.Pool):
    """Create kai_decisions table (encrypted investment decision history)."""
    print("📊 Creating kai_decisions table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS kai_decisions (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            session_id TEXT REFERENCES kai_sessions(session_id),
            ticker TEXT NOT NULL,
            decision_type TEXT CHECK (decision_type IN ('buy', 'hold', 'reduce')),
            decision_ciphertext TEXT NOT NULL,
            debate_ciphertext TEXT,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            algorithm TEXT DEFAULT 'aes-256-gcm',
            confidence_score DECIMAL(3,2),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_decisions_user ON kai_decisions(user_id)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_decisions_ticker ON kai_decisions(ticker)")
    print("✅ kai_decisions ready!")


# Table registry for modular access
TABLE_CREATORS = {
    "vault_keys": create_vault_keys,
    "vault_food": create_vault_food,
    "vault_professional": create_vault_professional,
    "consent_audit": create_consent_audit,
    "session_tokens": create_session_tokens,
    "kai_sessions": create_kai_sessions,
    "kai_decisions": create_kai_decisions,
}


# ============================================================================
# MIGRATION OPERATIONS
# ============================================================================

async def run_full_migration(pool: asyncpg.Pool):
    """Drop all tables and recreate (DESTRUCTIVE!)."""
    print("⚠️  FULL MIGRATION - This will DROP all tables!")
    print("🗑️  Dropping existing tables...")
    
    for table in ["session_tokens", "vault_data", "vault_food", "vault_professional", 
                  "vault_passkeys", "consent_audit", "vault_keys"]:
        await pool.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    
    # Create in dependency order
    await create_vault_keys(pool)
    await create_vault_food(pool)
    await create_vault_professional(pool)
    await create_consent_audit(pool)
    await create_session_tokens(pool)
    
    print("✅ Full migration complete!")


async def run_consent_migration(pool: asyncpg.Pool):
    """Create all consent-related tables."""
    print("🔐 Running consent protocol migration...")
    await create_consent_audit(pool)
    await create_session_tokens(pool)
    print("✅ Consent protocol tables ready!")


async def clear_table(pool: asyncpg.Pool, table_name: str):
    """Clear all entries from a table."""
    print(f"🧹 Clearing {table_name} table...")
    await pool.execute(f"TRUNCATE {table_name} RESTART IDENTITY")
    print(f"✅ {table_name} cleared!")


async def show_status(pool: asyncpg.Pool):
    """Show current table counts."""
    print("\n📊 Table summary:")
    
    tables = await pool.fetch("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    """)
    print(f"   Tables: {', '.join(r['table_name'] for r in tables)}")
    
    for table in TABLE_CREATORS.keys():
        try:
            count = await pool.fetchval(f"SELECT COUNT(*) FROM {table}")
            print(f"   {table}: {count} rows")
        except:
            print(f"   {table}: (not exists)")


# ============================================================================
# MAIN
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(
        description="Hushh Database Migration - Modular Per-Table",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python db/migrate.py --table consent_audit     # Create single table
  python db/migrate.py --consent                 # Create all consent tables
  python db/migrate.py --clear consent_audit     # Clear consent history
  python db/migrate.py --full                    # Full reset (WARNING!)
  python db/migrate.py --status                  # Show table summary
        """
    )
    parser.add_argument("--table", choices=list(TABLE_CREATORS.keys()), 
                        help="Create a specific table")
    parser.add_argument("--consent", action="store_true", 
                        help="Create all consent-related tables")
    parser.add_argument("--full", action="store_true", 
                        help="Drop and recreate ALL tables (DESTRUCTIVE!)")
    parser.add_argument("--clear", choices=list(TABLE_CREATORS.keys()),
                        help="Clear a specific table")
    parser.add_argument("--status", action="store_true", 
                        help="Show table summary")
    
    args = parser.parse_args()
    
    if not any([args.table, args.consent, args.full, args.clear, args.status]):
        parser.print_help()
        return
    
    # Mask password in URL for display
    display_url = DATABASE_URL
    try:
        parts = DATABASE_URL.split(":")
        if len(parts) >= 3 and "@" in parts[2]:
            display_url = f"{parts[0]}:{parts[1]}:****@{parts[2].split('@')[1]}:{':'.join(parts[3:])}"
    except:
        pass
    
    print("🔗 Connecting to database...")
    print(f"   URL: {display_url}")
    
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=2)
    
    try:
        print("✅ Connected successfully!")
        
        if args.full:
            await run_full_migration(pool)
        
        if args.table:
            await TABLE_CREATORS[args.table](pool)
        
        if args.consent:
            await run_consent_migration(pool)
        
        if args.clear:
            await clear_table(pool, args.clear)
        
        # Always show status at end
        await show_status(pool)
        
        print("\n✅ Migration complete!")
        
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
