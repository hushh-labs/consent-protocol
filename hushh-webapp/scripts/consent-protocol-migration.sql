-- Hushh Consent Protocol Migration v2
-- Run on Cloud SQL (INCREMENTAL - does NOT drop existing data)
--
-- Usage:
--   gcloud sql connect hushh-vault-db --user=hushh_app --database=hushh_vault
--   Then paste this script
--
-- ============================================================================

-- Step 1: Create session_tokens table (if not exists)
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
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(user_id, is_active);

-- Step 2: Add new columns to consent_audit (if not exist)
DO $$
BEGIN
    -- Add token_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consent_audit' AND column_name = 'token_type') THEN
        ALTER TABLE consent_audit ADD COLUMN token_type VARCHAR(20) DEFAULT 'consent';
    END IF;
    
    -- Add ip_address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consent_audit' AND column_name = 'ip_address') THEN
        ALTER TABLE consent_audit ADD COLUMN ip_address VARCHAR(45);
    END IF;
    
    -- Add user_agent column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consent_audit' AND column_name = 'user_agent') THEN
        ALTER TABLE consent_audit ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- Step 3: Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON consent_audit(issued_at DESC);

-- Verification
SELECT 'session_tokens' as table_name, COUNT(*) as row_count FROM session_tokens
UNION ALL
SELECT 'consent_audit', COUNT(*) FROM consent_audit;
