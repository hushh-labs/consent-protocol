-- Database Schema Migration
-- Run this on your GCP Cloud SQL instance
-- This clears existing data and creates domain-specific tables

-- ============================================================================
-- STEP 1: Clear existing data
-- ============================================================================

-- Clear all user data (CAREFUL: This deletes all data!)
TRUNCATE TABLE vault_data CASCADE;
TRUNCATE TABLE vault_keys CASCADE;

-- Or if you want to drop and recreate:
DROP TABLE IF EXISTS vault_data CASCADE;
DROP TABLE IF EXISTS vault_keys CASCADE;
DROP TABLE IF EXISTS vault_food CASCADE;
DROP TABLE IF EXISTS vault_professional CASCADE;
DROP TABLE IF EXISTS vault_passkeys CASCADE;
DROP TABLE IF EXISTS consent_audit CASCADE;

-- ============================================================================
-- STEP 2: Create core tables
-- ============================================================================

-- Central vault keys table (authentication)
CREATE TABLE vault_keys (
    user_id TEXT PRIMARY KEY,
    encrypted_vault_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT
);

-- Passkey credentials for biometric auth
CREATE TABLE vault_passkeys (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    device_name TEXT,
    created_at BIGINT NOT NULL,
    last_used_at BIGINT
);

CREATE INDEX idx_passkeys_user ON vault_passkeys(user_id);

-- ============================================================================
-- STEP 3: Domain-specific vault tables
-- ============================================================================

-- Food & Dining domain
CREATE TABLE vault_food (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,  -- 'dietary_restrictions', 'cuisine_preferences', 'monthly_budget'
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    consent_token_id TEXT,  -- Reference to consent audit
    UNIQUE(user_id, field_name)
);

CREATE INDEX idx_vault_food_user ON vault_food(user_id);

-- Professional Profile domain
CREATE TABLE vault_professional (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,  -- 'professional_title', 'skills', 'experience_level', 'job_preferences'
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    consent_token_id TEXT,  -- Reference to consent audit
    UNIQUE(user_id, field_name)
);

CREATE INDEX idx_vault_professional_user ON vault_professional(user_id);

-- ============================================================================
-- STEP 4: Consent Audit Trail (Bible Principle: Auditability)
-- ============================================================================

CREATE TABLE consent_audit (
    id SERIAL PRIMARY KEY,
    token_id TEXT NOT NULL UNIQUE,  -- The consent token ID
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    scope TEXT NOT NULL,  -- 'vault.write.food', 'vault.write.professional'
    action TEXT NOT NULL,  -- 'issue', 'validate', 'revoke'
    issued_at BIGINT NOT NULL,
    expires_at BIGINT,
    revoked_at BIGINT,
    metadata JSONB  -- Additional context
);

CREATE INDEX idx_consent_user ON consent_audit(user_id);
CREATE INDEX idx_consent_token ON consent_audit(token_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
