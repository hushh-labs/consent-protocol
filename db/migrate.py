#!/usr/bin/env python3
"""
Database Migration Script - Modular Per-Table

Usage:
    python db/migrate.py --table vault_keys        # Create vault_keys table
    python db/migrate.py --table consent_audit     # Create consent_audit table
    python db/migrate.py --consent                 # Create all consent-related tables
    python db/migrate.py --full                    # Drop and recreate ALL tables (DESTRUCTIVE!)
    python db/migrate.py --clear consent_audit     # Clear specific table
    python db/migrate.py --status                  # Show table summary

Environment:
    DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME (same as runtime — strict parity)
"""

import argparse
import asyncio
import sys

import asyncpg
from dotenv import load_dotenv

# Load env so DB_* are available (same as runtime)
load_dotenv()

# Use same DB_* as runtime (db/connection.py)
from db.connection import get_database_ssl, get_database_url  # noqa: E402

try:
    _database_url = get_database_url()
    _ssl_config = get_database_ssl()
except EnvironmentError as e:
    print(f"❌ ERROR: {e}")
    print("   Set DB_USER, DB_PASSWORD, DB_HOST in .env (and optionally DB_PORT, DB_NAME).")
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
            onboarding_completed BOOLEAN DEFAULT FALSE,
            created_at BIGINT NOT NULL,
            updated_at BIGINT
        )
    """)
    print("✅ vault_keys ready!")


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
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit(issued_at DESC)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_audit_user_action ON consent_audit(user_id, action)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_audit_request_id ON consent_audit(request_id) WHERE request_id IS NOT NULL"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_audit_pending ON consent_audit(user_id) WHERE action = 'REQUESTED'"
    )
    print("✅ consent_audit ready!")


async def create_world_model_data(pool: asyncpg.Pool):
    """
    Create world_model_data table (PRIVATE, E2E ENCRYPTED USER DATA).

    This is the PRIMARY storage for ALL user data using BYOK encryption.
    Single encrypted blob containing all domain data (financial, food, professional, etc.).
    """
    print("🔐 Creating world_model_data table...")

    await pool.execute("""
        CREATE TABLE IF NOT EXISTS world_model_data (
            user_id TEXT PRIMARY KEY REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            
            -- Encrypted data blob (BYOK - client encrypts, server stores only ciphertext)
            encrypted_data_ciphertext TEXT NOT NULL,
            encrypted_data_iv TEXT NOT NULL,
            encrypted_data_tag TEXT NOT NULL,
            algorithm TEXT DEFAULT 'aes-256-gcm',
            
            -- Version tracking
            data_version INTEGER DEFAULT 1,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    print("✅ world_model_data ready!")


async def create_world_model_index_v2(pool: asyncpg.Pool):
    """
    Create world_model_index_v2 table (QUERYABLE INDEX FOR WORLD MODEL).

    This is the queryable metadata layer for the world model.
    Non-encrypted, used for UI display and MCP scope generation.
    """
    print("📊 Creating world_model_index_v2 table...")

    await pool.execute("""
        CREATE TABLE IF NOT EXISTS world_model_index_v2 (
            user_id TEXT PRIMARY KEY REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            
            -- Domain summaries (JSONB - { domain_key: { summary_data } })
            domain_summaries JSONB DEFAULT '{}',
            
            -- List of available domains
            available_domains TEXT[] DEFAULT '{}',
            
            -- Computed tags for search/filtering
            computed_tags TEXT[] DEFAULT '{}',
            
            -- Activity signals
            activity_score DECIMAL(3,2),
            last_active_at TIMESTAMPTZ,
            total_attributes INTEGER DEFAULT 0,
            
            -- Model version
            model_version INTEGER DEFAULT 2,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_wmi2_domains ON world_model_index_v2 USING GIN(domain_summaries)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_wmi2_available ON world_model_index_v2 USING GIN(available_domains)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_wmi2_tags ON world_model_index_v2 USING GIN(computed_tags)"
    )

    print("✅ world_model_index_v2 ready!")


async def create_consent_exports(pool: asyncpg.Pool):
    """
    Create consent_exports table (MCP zero-knowledge export data storage).

    Stores encrypted export data for MCP zero-knowledge flow.
    Data survives server restarts and is available across all instances.
    """
    print("🔐 Creating consent_exports table...")

    await pool.execute("""
        CREATE TABLE IF NOT EXISTS consent_exports (
            consent_token TEXT PRIMARY KEY,
            
            -- User reference
            user_id TEXT REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            
            -- Encrypted export data (MCP decrypts with export_key)
            encrypted_data TEXT NOT NULL,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            export_key TEXT NOT NULL,
            
            -- Scope this export is for
            scope TEXT NOT NULL,
            
            -- Expiry
            expires_at TIMESTAMPTZ NOT NULL,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_exports_user ON consent_exports(user_id)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_consent_exports_expires ON consent_exports(expires_at)"
    )

    print("✅ consent_exports ready!")


async def create_domain_registry(pool: asyncpg.Pool):
    """
    Create domain_registry table (DYNAMIC DOMAIN REGISTRY).

    Registry of all available domains in the world model.
    Used for UI display and scope generation.
    """
    print("📂 Creating domain_registry table...")

    await pool.execute("""
        CREATE TABLE IF NOT EXISTS domain_registry (
            domain_key TEXT PRIMARY KEY,
            
            -- Display information
            display_name TEXT NOT NULL,
            description TEXT,
            icon_name TEXT DEFAULT 'folder',
            color_hex TEXT DEFAULT '#6B7280',
            
            -- Hierarchy
            parent_domain TEXT REFERENCES domain_registry(domain_key),
            
            -- Statistics
            attribute_count INTEGER DEFAULT 0,
            user_count INTEGER DEFAULT 0,
            
            -- Timestamps
            first_seen_at TIMESTAMPTZ DEFAULT NOW(),
            last_updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_domain_parent ON domain_registry(parent_domain)"
    )

    print("✅ domain_registry ready!")


async def create_tickers(pool: asyncpg.Pool):
    """
    Create tickers table (public company tickers imported from SEC).

    Columns:
      - ticker: STOCK symbol (PRIMARY KEY)
      - title: Company name
      - cik: SEC CIK (zero-padded 10 digits)
      - exchange: Exchange code (if available)
      - created_at, updated_at timestamps
    """
    print("📈 Creating tickers table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS tickers (
            ticker TEXT PRIMARY KEY,
            title TEXT,
            cik TEXT,
            exchange TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_tickers_ticker_lower ON tickers (LOWER(ticker))"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_tickers_title ON tickers USING GIN (to_tsvector('english', coalesce(title, ''))) "
    )

    print("✅ tickers ready!")


# Table registry for modular access
TABLE_CREATORS = {
    "vault_keys": create_vault_keys,
    "consent_audit": create_consent_audit,
    "world_model_data": create_world_model_data,
    "world_model_index_v2": create_world_model_index_v2,
    "domain_registry": create_domain_registry,
    "tickers": create_tickers,
    "consent_exports": create_consent_exports,
}


# ============================================================================
# MIGRATION OPERATIONS
# ============================================================================


async def run_full_migration(pool: asyncpg.Pool):
    """Drop all tables and recreate (DESTRUCTIVE!)."""
    print("⚠️  FULL MIGRATION - This will DROP all tables!")
    print("🗑️  Dropping existing tables...")

    # Drop current tables
    for table in [
        "vault_keys",
        "consent_audit",
        "world_model_data",
        "world_model_index_v2",
        "domain_registry",
        "consent_exports",
    ]:
        await pool.execute(f"DROP TABLE IF EXISTS {table} CASCADE")

    # Create in dependency order
    print("\n[1/6] Creating vault_keys (user authentication)...")
    await create_vault_keys(pool)

    print("[2/6] Creating consent_audit (consent tracking)...")
    await create_consent_audit(pool)

    print("[3/6] Creating world_model_data (encrypted user data blob)...")
    await create_world_model_data(pool)

    print("[4/6] Creating world_model_index_v2 (queryable metadata index)...")
    await create_world_model_index_v2(pool)

    print("[5/6] Creating domain_registry (dynamic domain registry)...")
    await create_domain_registry(pool)

    print("[6/6] Creating consent_exports (MCP zero-knowledge export)...")
    await create_consent_exports(pool)

    print("\n✅ Full migration complete!")


async def run_consent_migration(pool: asyncpg.Pool):
    """Create all consent-related tables."""
    print("Running consent protocol migration...")
    await create_consent_audit(pool)
    print("Consent protocol tables ready!")


async def run_init_migration(pool: asyncpg.Pool):
    """
    Initialize all tables in correct dependency order.
    Non-destructive - uses CREATE TABLE IF NOT EXISTS.
    Safe for first-time setup or adding missing tables.
    """
    print("Initializing database tables (non-destructive)...")

    # Create in dependency order
    print("\n[1/6] Creating vault_keys (user authentication)...")
    await create_vault_keys(pool)

    print("[2/6] Creating consent_audit (consent tracking)...")
    await create_consent_audit(pool)

    print("[3/6] Creating world_model_data (encrypted user data blob)...")
    await create_world_model_data(pool)

    print("[4/6] Creating world_model_index_v2 (queryable metadata index)...")
    await create_world_model_index_v2(pool)

    print("[5/6] Creating domain_registry (dynamic domain registry)...")
    await create_domain_registry(pool)

    print("[6/6] Creating consent_exports (MCP zero-knowledge export)...")
    await create_consent_exports(pool)

    print("\nAll tables initialized successfully!")


async def clear_table(pool: asyncpg.Pool, table_name: str):
    """Clear all entries from a table."""
    print(f"🧹 Clearing {table_name} table...")
    await pool.execute(f"TRUNCATE {table_name} RESTART IDENTITY")  # noqa: S608
    print(f"✅ {table_name} cleared!")


async def show_status(pool: asyncpg.Pool):
    """Show current table counts."""
    print("\n📊 Table summary:")

    tables = await pool.fetch("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    """)
    print(f"   Tables: {', '.join(r['table_name'] for r in tables)}")

    # Check all tables, not just those in TABLE_CREATORS
    all_tables = [r["table_name"] for r in tables]

    for table in [
        "vault_keys",
        "consent_audit",
        "world_model_data",
        "world_model_index_v2",
        "domain_registry",
        "consent_exports",
    ]:
        if table in all_tables:
            try:
                count = await pool.fetchval(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
                print(f"   {table}: {count} rows")
            except Exception as e:
                print(f"   {table}: error counting ({e})")
        else:
            print(f"   {table}: (not found)")


# ============================================================================
# MAIN
# ============================================================================


async def main():
    parser = argparse.ArgumentParser(
        description="Hushh Database Migration - Modular Per-Table",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python db/migrate.py --init                    # First-time setup (RECOMMENDED)
  python db/migrate.py --table world_model_data  # Create single table
  python db/migrate.py --consent                 # Create all consent tables
  python db/migrate.py --full                    # Full reset (WARNING: DESTRUCTIVE!)
  python db/migrate.py --status                  # Show table summary
        """,
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize all tables in correct order (non-destructive, recommended for first-time setup)",
    )
    parser.add_argument(
        "--table",
        choices=list(TABLE_CREATORS.keys()),
        help="Create a specific table (vault_keys, consent_audit, world_model_data, world_model_index_v2, domain_registry)",
    )
    parser.add_argument("--consent", action="store_true", help="Create all consent-related tables")
    parser.add_argument(
        "--full", action="store_true", help="Drop and recreate ALL tables (DESTRUCTIVE!)"
    )
    parser.add_argument(
        "--clear", choices=list(TABLE_CREATORS.keys()), help="Clear a specific table"
    )
    parser.add_argument("--status", action="store_true", help="Show table summary")

    args = parser.parse_args()

    if not any([args.init, args.table, args.consent, args.full, args.clear, args.status]):
        parser.print_help()
        return

    # Mask password in URL for display
    display_url = _database_url
    try:
        parts = _database_url.split(":")
        if len(parts) >= 3 and "@" in parts[2]:
            display_url = (
                f"{parts[0]}:{parts[1]}:****@{parts[2].split('@')[1]}:{':'.join(parts[3:])}"
            )
    except Exception:
        display_url = _database_url
    print("Connecting to database (DB_* env)...")
    print(f"   URL: {display_url}")
    if _ssl_config:
        print("   SSL: enabled (Supabase)")

    pool = await asyncpg.create_pool(
        _database_url,
        min_size=1,
        max_size=2,
        ssl=_ssl_config,
    )

    try:
        print("Connected successfully!")

        if args.init:
            await run_init_migration(pool)

        if args.full:
            await run_full_migration(pool)

        if args.table:
            table_func = TABLE_CREATORS.get(args.table)
            if table_func:
                await table_func(pool)
            else:
                print(f"Unknown table: {args.table}")

        if args.consent:
            await run_consent_migration(pool)

        if args.clear:
            await clear_table(pool, args.clear)

        # Always show status at end
        await show_status(pool)

        print("\nMigration complete!")

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
