// lib/db.ts

/**
 * Database Connection Setup - Domain-Based Schema
 *
 * PostgreSQL for production, in-memory for dev/testing
 *
 * Tables:
 * - vault_keys: User authentication keys
 * - vault_passkeys: WebAuthn credentials
 * - vault_food: Food & Dining domain data
 * - vault_professional: Professional Profile domain data
 * - consent_audit: Consent token audit trail
 */

import { Pool } from "pg";

// Check if we're using a real database
const useDatabase = process.env.DATABASE_URL !== undefined;

// PostgreSQL connection pool
let pool: Pool | null = null;

if (useDatabase) {
  // Cloud SQL with Unix socket uses ?host=/cloudsql/... and doesn't need SSL
  // Regular SSL is only for TCP connections to external hosts
  const isUnixSocket = process.env.DATABASE_URL?.includes("/cloudsql/");
  const isLocalhost =
    process.env.DATABASE_URL?.includes("localhost") ||
    process.env.DATABASE_URL?.includes("127.0.0.1");

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      !isUnixSocket && !isLocalhost && process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false, // Explicitly disable SSL for Unix socket and localhost
  });

  console.log(
    `✅ Using PostgreSQL database (Unix socket: ${isUnixSocket}, localhost: ${isLocalhost})`
  );
} else {
  console.log("⚠️ Using in-memory storage (data will be lost on restart)");
}

// In-memory fallback storage
const memoryVaultKeys = new Map<string, any>();
const memoryVaultFood = new Map<string, any>();
const memoryVaultProfessional = new Map<string, any>();

// ============================================================================
// VAULT KEYS (Passphrase + Recovery Authentication)
// ============================================================================

export async function storeVaultKey(
  userId: string,
  authMethod: string, // 'passphrase' or 'prf' or 'passphrase-based'
  // Passphrase encrypted
  encryptedVaultKey: string,
  salt: string,
  iv: string,
  // Recovery encrypted
  recoveryEncryptedVaultKey: string,
  recoverySalt: string,
  recoveryIv: string
) {
  if (pool) {
    await pool.query(
      `
      INSERT INTO vault_keys (
        user_id, auth_method, 
        encrypted_vault_key, salt, iv,
        recovery_encrypted_vault_key, recovery_salt, recovery_iv,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        auth_method = EXCLUDED.auth_method,
        encrypted_vault_key = EXCLUDED.encrypted_vault_key,
        salt = EXCLUDED.salt,
        iv = EXCLUDED.iv,
        recovery_encrypted_vault_key = EXCLUDED.recovery_encrypted_vault_key,
        recovery_salt = EXCLUDED.recovery_salt,
        recovery_iv = EXCLUDED.recovery_iv,
        updated_at = EXCLUDED.created_at
    `,
      [
        userId,
        authMethod,
        encryptedVaultKey,
        salt,
        iv,
        recoveryEncryptedVaultKey,
        recoverySalt,
        recoveryIv,
        Date.now(),
      ]
    );
  } else {
    memoryVaultKeys.set(userId, {
      authMethod,
      encryptedVaultKey,
      salt,
      iv,
      recoveryEncryptedVaultKey,
      recoverySalt,
      recoveryIv,
      createdAt: Date.now(),
    });
  }
}

export async function getVaultKey(userId: string) {
  if (pool) {
    const result = await pool.query(
      `SELECT auth_method, encrypted_vault_key, salt, iv, 
              recovery_encrypted_vault_key, recovery_salt, recovery_iv 
       FROM vault_keys WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      authMethod: row.auth_method,
      encryptedVaultKey: row.encrypted_vault_key,
      salt: row.salt,
      iv: row.iv,
      recoveryEncryptedVaultKey: row.recovery_encrypted_vault_key,
      recoverySalt: row.recovery_salt,
      recoveryIv: row.recovery_iv,
    };
  } else {
    return memoryVaultKeys.get(userId) || null;
  }
}

export async function hasVault(userId: string): Promise<boolean> {
  if (pool) {
    const result = await pool.query(
      "SELECT 1 FROM vault_keys WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0;
  } else {
    return memoryVaultKeys.has(userId);
  }
}

// ============================================================================
// DOMAIN: FOOD & DINING
// ============================================================================

export async function storeFoodData(
  userId: string,
  fieldName: string,
  ciphertext: string,
  iv: string,
  tag: string,
  consentTokenId?: string
) {
  if (pool) {
    await pool.query(
      `
      INSERT INTO vault_food (user_id, field_name, ciphertext, iv, tag, created_at, consent_token_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, field_name) DO UPDATE SET
        ciphertext = EXCLUDED.ciphertext,
        iv = EXCLUDED.iv,
        tag = EXCLUDED.tag,
        updated_at = EXCLUDED.created_at,
        consent_token_id = EXCLUDED.consent_token_id
    `,
      [userId, fieldName, ciphertext, iv, tag, Date.now(), consentTokenId]
    );
  } else {
    const key = `${userId}:${fieldName}`;
    memoryVaultFood.set(key, {
      ciphertext,
      iv,
      tag,
      algorithm: "aes-256-gcm",
      encoding: "base64",
    });
  }
}

export async function getFoodData(userId: string, fieldName: string) {
  if (pool) {
    const result = await pool.query(
      "SELECT ciphertext, iv, tag, algorithm FROM vault_food WHERE user_id = $1 AND field_name = $2",
      [userId, fieldName]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ciphertext: row.ciphertext,
      iv: row.iv,
      tag: row.tag,
      algorithm: row.algorithm || "aes-256-gcm",
      encoding: "base64" as const,
    };
  } else {
    return memoryVaultFood.get(`${userId}:${fieldName}`) || null;
  }
}

export async function getAllFoodData(userId: string) {
  if (pool) {
    const result = await pool.query(
      "SELECT field_name, ciphertext, iv, tag, algorithm FROM vault_food WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length === 0) return null;
    const data: Record<string, any> = {};
    for (const row of result.rows) {
      data[row.field_name] = {
        ciphertext: row.ciphertext,
        iv: row.iv,
        tag: row.tag,
        algorithm: row.algorithm || "aes-256-gcm",
        encoding: "base64",
      };
    }
    return data;
  } else {
    const data: Record<string, any> = {};
    for (const [key, value] of memoryVaultFood.entries()) {
      if (key.startsWith(`${userId}:`)) {
        data[key.split(":")[1]] = value;
      }
    }
    return Object.keys(data).length > 0 ? data : null;
  }
}

// ============================================================================
// DOMAIN: PROFESSIONAL PROFILE
// ============================================================================

export async function storeProfessionalData(
  userId: string,
  fieldName: string,
  ciphertext: string,
  iv: string,
  tag: string,
  consentTokenId?: string
) {
  if (pool) {
    await pool.query(
      `
      INSERT INTO vault_professional (user_id, field_name, ciphertext, iv, tag, created_at, consent_token_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, field_name) DO UPDATE SET
        ciphertext = EXCLUDED.ciphertext,
        iv = EXCLUDED.iv,
        tag = EXCLUDED.tag,
        updated_at = EXCLUDED.created_at,
        consent_token_id = EXCLUDED.consent_token_id
    `,
      [userId, fieldName, ciphertext, iv, tag, Date.now(), consentTokenId]
    );
  } else {
    const key = `${userId}:${fieldName}`;
    memoryVaultProfessional.set(key, {
      ciphertext,
      iv,
      tag,
      algorithm: "aes-256-gcm",
      encoding: "base64",
    });
  }
}

export async function getProfessionalData(userId: string, fieldName: string) {
  if (pool) {
    const result = await pool.query(
      "SELECT ciphertext, iv, tag, algorithm FROM vault_professional WHERE user_id = $1 AND field_name = $2",
      [userId, fieldName]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ciphertext: row.ciphertext,
      iv: row.iv,
      tag: row.tag,
      algorithm: row.algorithm || "aes-256-gcm",
      encoding: "base64" as const,
    };
  } else {
    return memoryVaultProfessional.get(`${userId}:${fieldName}`) || null;
  }
}

export async function getAllProfessionalData(userId: string) {
  if (pool) {
    const result = await pool.query(
      "SELECT field_name, ciphertext, iv, tag, algorithm FROM vault_professional WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length === 0) return null;
    const data: Record<string, any> = {};
    for (const row of result.rows) {
      data[row.field_name] = {
        ciphertext: row.ciphertext,
        iv: row.iv,
        tag: row.tag,
        algorithm: row.algorithm || "aes-256-gcm",
        encoding: "base64",
      };
    }
    return data;
  } else {
    const data: Record<string, any> = {};
    for (const [key, value] of memoryVaultProfessional.entries()) {
      if (key.startsWith(`${userId}:`)) {
        data[key.split(":")[1]] = value;
      }
    }
    return Object.keys(data).length > 0 ? data : null;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY - Unified store/get that routes to domain tables
// ============================================================================

const FOOD_FIELDS = [
  "dietary_restrictions",
  "cuisine_preferences",
  "monthly_food_budget",
  "monthly_budget",
];
const PROFESSIONAL_FIELDS = [
  "professional_title",
  "skills",
  "experience_level",
  "job_preferences",
];

export async function storeUserData(
  userId: string,
  scope: string,
  ciphertext: string,
  iv: string,
  tag: string
) {
  // Route to appropriate domain table
  if (FOOD_FIELDS.includes(scope)) {
    await storeFoodData(userId, scope, ciphertext, iv, tag);
  } else if (PROFESSIONAL_FIELDS.includes(scope)) {
    await storeProfessionalData(userId, scope, ciphertext, iv, tag);
  } else {
    console.warn(`Unknown scope: ${scope}, defaulting to food domain`);
    await storeFoodData(userId, scope, ciphertext, iv, tag);
  }
}

export async function getUserData(userId: string, scope: string) {
  if (FOOD_FIELDS.includes(scope)) {
    return await getFoodData(userId, scope);
  } else if (PROFESSIONAL_FIELDS.includes(scope)) {
    return await getProfessionalData(userId, scope);
  } else {
    // Try both domains
    const food = await getFoodData(userId, scope);
    if (food) return food;
    return await getProfessionalData(userId, scope);
  }
}

export async function getAllUserPreferences(userId: string) {
  const food = await getAllFoodData(userId);
  const professional = await getAllProfessionalData(userId);

  if (!food && !professional) return null;

  return { ...food, ...professional };
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export async function initDatabase() {
  if (!pool) {
    console.log("⚠️ No database configured, using in-memory storage");
    return;
  }

  try {
    // Check if new schema exists
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'vault_food'
    `);

    if (tableCheck.rows.length > 0) {
      console.log("✅ Database schema initialized (domain tables detected)");
      return;
    }

    // Fall back to old schema check
    const oldTableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'vault_data'
    `);

    if (oldTableCheck.rows.length > 0) {
      console.log(
        "⚠️ Old schema detected. Please run scripts/db-migration.sql"
      );
      return;
    }

    console.log("⚠️ No tables found. Please run scripts/db-migration.sql");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
}

// Auto-initialize on import
if (pool) {
  initDatabase().catch(console.error);
}
