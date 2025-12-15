-- Hushh Vault Database Schema
-- Run directly on Cloud SQL using: gcloud sql connect
--
-- Usage:
--   gcloud sql connect hushh-vault-db --user=hushh_app --database=hushh_vault
--   Then paste this script or run: \i db-migration.sql
--
-- ============================================================================

-- Step 1: Drop existing tables (CAREFUL: Deletes all data!)
DROP TABLE IF EXISTS vault_data CASCADE;
DROP TABLE IF EXISTS vault_keys CASCADE;
DROP TABLE IF EXISTS vault_food CASCADE;
DROP TABLE IF EXISTS vault_professional CASCADE;
DROP TABLE IF EXISTS vault_passkeys CASCADE;
DROP TABLE IF EXISTS consent_audit CASCADE;

-- Step 2: Create vault_keys table (Passphrase + Recovery Authentication)
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
);

-- Step 3: Create Food domain table
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
);
CREATE INDEX idx_vault_food_user ON vault_food(user_id);

-- Step 4: Create Professional domain table
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
);
CREATE INDEX idx_vault_professional_user ON vault_professional(user_id);

-- Step 5: Create consent audit table
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
);
CREATE INDEX idx_consent_user ON consent_audit(user_id);
CREATE INDEX idx_consent_token ON consent_audit(token_id);

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
