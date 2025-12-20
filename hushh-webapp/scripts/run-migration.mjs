// scripts/run-migration.mjs
//
// Modular migration script with flags:
//   --full    : Drop all tables and recreate (DESTRUCTIVE)
//   --update  : Add new columns/tables (SAFE, incremental)
//   --consent : Add consent protocol tables (session_tokens, consent_audit extensions)
//
// Usage:
//   node scripts/run-migration.mjs --update --consent
//   node scripts/run-migration.mjs --full  # WARNING: Deletes all data!
//
// Environment:
//   DATABASE_URL must be set in environment or .env.local

import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env.local") });

// SECURITY: Only use DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required!");
  console.error("   Set it in .env.local or export it before running.");
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const FLAGS = {
  full: args.includes("--full"),
  update: args.includes("--update"),
  consent: args.includes("--consent"),
  help: args.includes("--help") || args.includes("-h"),
};

if (FLAGS.help || (!FLAGS.full && !FLAGS.update && !FLAGS.consent)) {
  console.log(`
Hushh Database Migration Script

Usage:
  node scripts/run-migration.mjs [flags]

Flags:
  --full     Drop all tables and recreate (DESTRUCTIVE - deletes all data!)
  --update   Add new columns/tables incrementally (SAFE)
  --consent  Add consent protocol tables (session_tokens, consent_audit extensions)
  --help     Show this help message

Examples:
  node scripts/run-migration.mjs --consent          # Add consent tables only
  node scripts/run-migration.mjs --update --consent # Safe incremental update
  node scripts/run-migration.mjs --full             # Full reset (WARNING!)
`);
  process.exit(0);
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function runFullMigration(pool) {
  console.log("⚠️  FULL MIGRATION - This will DROP all tables!");
  console.log("🗑️  Dropping existing tables...");

  await pool.query("DROP TABLE IF EXISTS session_tokens CASCADE");
  await pool.query("DROP TABLE IF EXISTS vault_data CASCADE");
  await pool.query("DROP TABLE IF EXISTS vault_keys CASCADE");
  await pool.query("DROP TABLE IF EXISTS vault_food CASCADE");
  await pool.query("DROP TABLE IF EXISTS vault_professional CASCADE");
  await pool.query("DROP TABLE IF EXISTS vault_passkeys CASCADE");
  await pool.query("DROP TABLE IF EXISTS consent_audit CASCADE");

  console.log("📦 Creating vault_keys table...");
  await pool.query(`
    CREATE TABLE vault_keys (
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
  `);

  console.log("🍽️  Creating vault_food table...");
  await pool.query(`
    CREATE TABLE vault_food (
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
  `);
  await pool.query("CREATE INDEX idx_vault_food_user ON vault_food(user_id)");

  console.log("💼 Creating vault_professional table...");
  await pool.query(`
    CREATE TABLE vault_professional (
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
  `);
  await pool.query(
    "CREATE INDEX idx_vault_professional_user ON vault_professional(user_id)"
  );

  console.log("📋 Creating consent_audit table...");
  await pool.query(`
    CREATE TABLE consent_audit (
      id SERIAL PRIMARY KEY,
      token_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      action TEXT NOT NULL,
      issued_at BIGINT NOT NULL,
      expires_at BIGINT,
      revoked_at BIGINT,
      metadata JSONB,
      token_type VARCHAR(20) DEFAULT 'consent',
      ip_address VARCHAR(45),
      user_agent TEXT
    )
  `);
  await pool.query("CREATE INDEX idx_consent_user ON consent_audit(user_id)");
  await pool.query("CREATE INDEX idx_consent_token ON consent_audit(token_id)");
  await pool.query(
    "CREATE INDEX idx_consent_audit_created ON consent_audit(issued_at DESC)"
  );

  // Also create session_tokens if full migration
  await runConsentMigration(pool);
}

async function runConsentMigration(pool) {
  console.log("🔐 Adding consent protocol tables...");

  // Create session_tokens table
  console.log("   Creating session_tokens table (if not exists)...");
  await pool.query(`
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
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(user_id, is_active)"
  );

  // Add new columns to consent_audit for pending request tracking
  console.log("   Adding columns to consent_audit (if not exist)...");
  await pool.query(`
    DO $$
    BEGIN
      -- Request ID for linking REQUESTED to resolution
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'request_id') THEN
        ALTER TABLE consent_audit ADD COLUMN request_id VARCHAR(32);
      END IF;
      
      -- Scope description for display
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'scope_description') THEN
        ALTER TABLE consent_audit ADD COLUMN scope_description TEXT;
      END IF;
      
      -- Poll timeout for MCP waiting
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'poll_timeout_at') THEN
        ALTER TABLE consent_audit ADD COLUMN poll_timeout_at BIGINT;
      END IF;
      
      -- Token type (consent, session, pending)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'token_type') THEN
        ALTER TABLE consent_audit ADD COLUMN token_type VARCHAR(20) DEFAULT 'consent';
      END IF;
      
      -- IP address for audit
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'ip_address') THEN
        ALTER TABLE consent_audit ADD COLUMN ip_address VARCHAR(45);
      END IF;
      
      -- User agent for audit
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'consent_audit' AND column_name = 'user_agent') THEN
        ALTER TABLE consent_audit ADD COLUMN user_agent TEXT;
      END IF;
    END $$
  `);

  // Create indexes for efficient queries
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit(issued_at DESC)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_consent_audit_user_action ON consent_audit(user_id, action)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_consent_audit_request_id ON consent_audit(request_id) WHERE request_id IS NOT NULL"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_consent_audit_pending ON consent_audit(user_id) WHERE action = 'REQUESTED'"
  );

  console.log("✅ Consent protocol tables ready!");
}

async function runUpdateMigration(pool) {
  console.log("🔄 Running incremental update...");
  // Add any new columns or indexes that don't exist
  // This is a safe operation that won't delete data

  // Future updates can be added here
  console.log("✅ Incremental update complete!");
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🔗 Connecting to database...");
  console.log(`   URL: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`); // Hide password

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("✅ Connected successfully!");

    // Run migrations based on flags
    if (FLAGS.full) {
      await runFullMigration(pool);
    }

    if (FLAGS.update) {
      await runUpdateMigration(pool);
    }

    if (FLAGS.consent && !FLAGS.full) {
      // Only run consent separately if not doing full (full includes consent)
      await runConsentMigration(pool);
    }

    // Verify tables
    console.log("\n📊 Table summary:");
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("   Tables:", tables.rows.map((r) => r.table_name).join(", "));

    // Count rows
    for (const table of ["session_tokens", "consent_audit", "vault_keys"]) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${count.rows[0].count} rows`);
      } catch {
        // Table might not exist
      }
    }

    console.log("\n✅ Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
