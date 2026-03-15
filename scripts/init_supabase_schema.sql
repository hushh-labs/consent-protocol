-- Supabase Schema Initialization Script
-- Mirror of db/migrate.py table definitions; for Supabase Dashboard / one-off init.
-- Prefer: python db/migrate.py --init (programmatic setup, same DB_* as runtime).
-- Run this in Supabase Dashboard SQL Editor or via psql.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. vault_keys (user authentication keys)
CREATE TABLE IF NOT EXISTS vault_keys (
    user_id TEXT PRIMARY KEY,
    vault_status TEXT NOT NULL DEFAULT 'active' CHECK (vault_status IN ('placeholder', 'active')),
    vault_key_hash TEXT,
    primary_method TEXT NOT NULL DEFAULT 'passphrase',
    primary_wrapper_id TEXT NOT NULL DEFAULT 'default',
    recovery_encrypted_vault_key TEXT,
    recovery_salt TEXT,
    recovery_iv TEXT,
    first_login_at BIGINT,
    last_login_at BIGINT,
    login_count INTEGER NOT NULL DEFAULT 0,
    pre_onboarding_completed BOOLEAN,
    pre_onboarding_skipped BOOLEAN,
    pre_onboarding_completed_at BIGINT,
    pre_nav_tour_completed_at BIGINT,
    pre_nav_tour_skipped_at BIGINT,
    pre_state_updated_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT vault_keys_placeholder_integrity_check CHECK (
        (vault_status = 'placeholder'
            AND vault_key_hash IS NULL
            AND recovery_encrypted_vault_key IS NULL
            AND recovery_salt IS NULL
            AND recovery_iv IS NULL)
        OR
        (vault_status = 'active'
            AND vault_key_hash IS NOT NULL
            AND recovery_encrypted_vault_key IS NOT NULL
            AND recovery_salt IS NOT NULL
            AND recovery_iv IS NOT NULL)
    )
);

-- 1b. vault_key_wrappers (one wrapper per method per user)
CREATE TABLE IF NOT EXISTS vault_key_wrappers (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    wrapper_id TEXT NOT NULL DEFAULT 'default',
    encrypted_vault_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    passkey_credential_id TEXT,
    passkey_prf_salt TEXT,
    passkey_rp_id TEXT,
    passkey_provider TEXT,
    passkey_device_label TEXT,
    passkey_last_used_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (user_id, method, wrapper_id)
);
CREATE INDEX IF NOT EXISTS idx_vkw_user_id ON vault_key_wrappers(user_id);
CREATE INDEX IF NOT EXISTS idx_vkw_method ON vault_key_wrappers(method);
CREATE INDEX IF NOT EXISTS idx_vkw_user_method_wrapper ON vault_key_wrappers(user_id, method, wrapper_id);
CREATE INDEX IF NOT EXISTS idx_vkw_passkey_rp_id ON vault_key_wrappers(passkey_rp_id);

-- 2. investor_profiles (public discovery layer)
CREATE TABLE IF NOT EXISTS investor_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_normalized TEXT,
    cik TEXT UNIQUE,
    firm TEXT,
    title TEXT,
    investor_type TEXT,
    photo_url TEXT,
    aum_billions NUMERIC,
    top_holdings JSONB,
    sector_exposure JSONB,
    investment_style TEXT[],
    risk_tolerance TEXT,
    time_horizon TEXT,
    portfolio_turnover TEXT,
    recent_buys TEXT[],
    recent_sells TEXT[],
    public_quotes JSONB,
    biography TEXT,
    education TEXT[],
    board_memberships TEXT[],
    peer_investors TEXT[],
    is_insider BOOLEAN DEFAULT FALSE,
    insider_company_ticker TEXT,
    data_sources TEXT[],
    last_13f_date DATE,
    last_form4_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_name ON investor_profiles(name);
CREATE INDEX IF NOT EXISTS idx_investor_name_trgm ON investor_profiles USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_investor_firm ON investor_profiles(firm);
CREATE INDEX IF NOT EXISTS idx_investor_type ON investor_profiles(investor_type);
CREATE INDEX IF NOT EXISTS idx_investor_style ON investor_profiles USING GIN (investment_style);
CREATE INDEX IF NOT EXISTS idx_investor_cik ON investor_profiles(cik) WHERE cik IS NOT NULL;

-- 3. consent_audit (consent token audit trail; app uses this only)
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
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_token ON consent_audit(token_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_action ON consent_audit(user_id, action);
CREATE INDEX IF NOT EXISTS idx_consent_audit_request_id ON consent_audit(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_audit_pending ON consent_audit(user_id) WHERE action = 'REQUESTED';

-- NOTIFY on consent_audit INSERT (for event-driven SSE/push; see db/migrations/011_consent_audit_notify_trigger.sql)
CREATE OR REPLACE FUNCTION consent_audit_notify()
RETURNS TRIGGER AS $$
DECLARE payload TEXT;
BEGIN
  payload := json_build_object(
    'user_id', NEW.user_id,
    'request_id', COALESCE(NEW.request_id, ''),
    'action', NEW.action,
    'scope', COALESCE(NEW.scope, ''),
    'agent_id', COALESCE(NEW.agent_id, ''),
    'scope_description', COALESCE(NEW.scope_description, ''),
    'issued_at', NEW.issued_at,
    'bundle_id', COALESCE(NEW.metadata->>'bundle_id', ''),
    'bundle_label', COALESCE(NEW.metadata->>'bundle_label', ''),
    'bundle_scope_count', COALESCE(NEW.metadata->>'bundle_scope_count', '1')
  )::TEXT;
  PERFORM pg_notify('consent_audit_new', payload);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS consent_audit_after_insert ON consent_audit;
CREATE TRIGGER consent_audit_after_insert AFTER INSERT ON consent_audit FOR EACH ROW EXECUTE FUNCTION consent_audit_notify();

-- 4b. user_push_tokens (FCM/APNs for consent push notifications)
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- 4c. internal_access_events (self/internal app activity; not user-facing consent history)
CREATE TABLE IF NOT EXISTS internal_access_events (
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
    token_type VARCHAR(20) DEFAULT 'internal',
    request_id VARCHAR(32),
    scope_description TEXT
);
CREATE INDEX IF NOT EXISTS idx_internal_access_events_user_id ON internal_access_events(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_access_events_user_action ON internal_access_events(user_id, action);
CREATE INDEX IF NOT EXISTS idx_internal_access_events_issued_at ON internal_access_events(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_access_events_user_scope_agent
    ON internal_access_events(user_id, agent_id, scope, issued_at DESC);

-- Verification: Show all created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
