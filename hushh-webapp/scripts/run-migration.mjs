// scripts/run-migration.mjs
// Run with: node scripts/run-migration.mjs

/**
 * PRF-Based Vault Schema
 *
 * Removes passphrase fields in favor of:
 * - PRF salt for deterministic key derivation
 * - Wrapped vault key (encrypted with recovery key)
 * - Recovery key wrapping IV
 */

import pg from "pg";
const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault";

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log("🔄 Connecting to database...");

  try {
    // Step 1: Drop existing tables
    console.log("🗑️ Dropping existing tables...");
    await pool.query("DROP TABLE IF EXISTS vault_data CASCADE");
    await pool.query("DROP TABLE IF EXISTS vault_keys CASCADE");
    await pool.query("DROP TABLE IF EXISTS vault_food CASCADE");
    await pool.query("DROP TABLE IF EXISTS vault_professional CASCADE");
    await pool.query("DROP TABLE IF EXISTS vault_passkeys CASCADE");
    await pool.query("DROP TABLE IF EXISTS consent_audit CASCADE");

    // Step 2: Create vault_keys table (Passphrase + Recovery)
    console.log("📦 Creating vault_keys table (Passphrase + Recovery)...");
    await pool.query(`
      CREATE TABLE vault_keys (
        user_id TEXT PRIMARY KEY,
        auth_method TEXT NOT NULL DEFAULT 'passphrase',
        -- Passphrase encrypted vault key
        encrypted_vault_key TEXT NOT NULL,
        salt TEXT NOT NULL,
        iv TEXT NOT NULL,
        -- Recovery encrypted vault key (separate copy)
        recovery_encrypted_vault_key TEXT NOT NULL,
        recovery_salt TEXT NOT NULL,
        recovery_iv TEXT NOT NULL,
        -- Metadata
        created_at BIGINT NOT NULL,
        updated_at BIGINT
      )
    `);

    // Step 3: Create food domain table
    console.log("🍽️ Creating vault_food table...");
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

    // Step 4: Create professional domain table
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

    // Step 5: Create consent audit table
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
        metadata JSONB
      )
    `);
    await pool.query("CREATE INDEX idx_consent_user ON consent_audit(user_id)");
    await pool.query(
      "CREATE INDEX idx_consent_token ON consent_audit(token_id)"
    );

    // Verify
    console.log("✅ Verifying tables...");
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(
      "Tables created:",
      result.rows.map((r) => r.table_name).join(", ")
    );

    console.log("✅ PRF-based migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
