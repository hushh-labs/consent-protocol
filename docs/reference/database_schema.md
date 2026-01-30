# Database Schema

> PostgreSQL schema for the Hushh encrypted vault, investor profiles, and consent audit system.

---

## 🎯 Design Principles

| Principle             | Implementation                                     |
| --------------------- | -------------------------------------------------- |
| **Zero-Knowledge**    | All user data stored as AES-256-GCM ciphertext     |
| **Domain Separation** | Separate tables per data category                  |
| **Field-Based Storage** | Each encrypted field stored as separate row      |
| **Audit Trail**       | `consent_audit` logs all token operations          |
| **No Plaintext**      | Server cannot decrypt any user data                |
| **Investor Layer**    | Public profiles for discovery, encrypted for vault |

---

## 📊 Entity Relationship Diagram

```
┌──────────────────────┐
│     vault_keys       │  (User vault authentication)
├──────────────────────┤
│ user_id (PK)         │
│ auth_method          │
│ encrypted_vault_key  │
│ salt, iv             │
│ recovery_*           │
│ created_at           │
└──────────┬───────────┘
           │
           │ 1:N (field-based storage)
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│     vault_food       │     │  vault_professional  │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ user_id (FK)         │     │ user_id (FK)         │
│ field_name           │     │ field_name           │
│ ciphertext           │     │ ciphertext           │
│ iv, tag              │     │ iv, tag              │
│ UNIQUE(user_id,      │     │ UNIQUE(user_id,      │
│   field_name)        │     │   field_name)        │
└──────────────────────┘     └──────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│ vault_kai_preferences│     │      vault_kai       │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ user_id (FK)         │     │ user_id (FK)         │
│ field_name           │     │ ticker               │
│ ciphertext           │     │ decision_type        │
│ iv, tag              │     │ decision_ciphertext  │
│ UNIQUE(user_id,      │     │ iv, tag              │
│   field_name)        │     │ confidence_score     │
└──────────────────────┘     └──────────────────────┘
           │
           │ 1:1
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│user_investor_profiles│────▶│  investor_profiles   │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ user_id (FK, UNIQUE) │     │ name                 │
│ confirmed_investor_id│     │ cik (SEC identifier) │
│ profile_data_*       │     │ firm, title          │
│   (ENCRYPTED)        │     │ top_holdings (JSONB) │
│ custom_holdings_*    │     │ investment_style     │
│   (ENCRYPTED)        │     │ (PUBLIC DATA)        │
└──────────────────────┘     └──────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│    consent_audit     │
├──────────────────────┤
│ id (PK)              │
│ token_id             │
│ user_id              │
│ agent_id             │
│ scope                │
│ action               │
│ issued_at            │
│ expires_at           │
└──────────────────────┘
```

---

## 📋 Table Definitions

### vault_keys

Stores encrypted vault keys for zero-knowledge recovery. This is the root table - all other vault tables reference it.

```sql
CREATE TABLE vault_keys (
    user_id TEXT PRIMARY KEY,
    auth_method TEXT NOT NULL DEFAULT 'passphrase',
    
    -- Passphrase-encrypted vault key
    encrypted_vault_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    
    -- Recovery-encrypted vault key
    recovery_encrypted_vault_key TEXT NOT NULL,
    recovery_salt TEXT NOT NULL,
    recovery_iv TEXT NOT NULL,
    
    created_at BIGINT NOT NULL,
    updated_at BIGINT
);
```

**Notes:**
- `user_id` is Firebase UID (e.g., `UWHGeUyfUAbmEl5xwIPoWJ7Cyft2`)
- `auth_method` is currently always `'passphrase'` (biometric planned)
- Both passphrase and recovery keys can decrypt the vault key

---

### vault_food

Food & Dining preferences using **field-based storage** (each field is a separate encrypted row).

```sql
CREATE TABLE vault_food (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,        -- e.g., 'dietary_restrictions', 'cuisines', 'budget'
    ciphertext TEXT NOT NULL,        -- AES-256-GCM encrypted value
    iv TEXT NOT NULL,                -- 12-byte initialization vector
    tag TEXT NOT NULL,               -- 16-byte authentication tag
    algorithm TEXT DEFAULT 'aes-256-gcm',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    consent_token_id TEXT,           -- Token used for this write
    UNIQUE(user_id, field_name)      -- One value per field per user
);

CREATE INDEX idx_vault_food_user ON vault_food(user_id);
```

**Example Data:**
| user_id | field_name | ciphertext | iv | tag |
|---------|------------|------------|-----|-----|
| UWHGe... | dietary_restrictions | eyJhbGc... | abc123... | def456... |
| UWHGe... | cuisines | eyJhbGc... | ghi789... | jkl012... |
| UWHGe... | budget | eyJhbGc... | mno345... | pqr678... |

---

### vault_professional

Professional profile data using **field-based storage**.

```sql
CREATE TABLE vault_professional (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,        -- e.g., 'title', 'skills', 'experience', 'job_preferences'
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
```

---

### vault_kai_preferences

Encrypted user settings for Agent Kai (Risk Profile, Processing Mode).

```sql
CREATE TABLE vault_kai_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,        -- 'kai_risk_profile', 'kai_processing_mode'
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    UNIQUE(user_id, field_name)
);

CREATE INDEX idx_vault_kai_prefs_user ON vault_kai_preferences(user_id);
```

---

### kai_sessions

Session tracking for Kai investment analysis.

```sql
CREATE TABLE kai_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    processing_mode VARCHAR(32) DEFAULT 'hybrid',  -- 'on_device', 'hybrid'
    risk_profile VARCHAR(32) DEFAULT 'balanced',   -- 'conservative', 'balanced', 'aggressive'
    legal_acknowledged BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kai_sessions_user ON kai_sessions(user_id);
```

**Notes:**
- `processing_mode`: Currently only 'hybrid' (cloud-based analysis) is active
- `risk_profile`: Affects agent debate weights and decision formatting
- `legal_acknowledged`: User has seen legal disclaimer

---

### vault_kai

Encrypted investment decision history (analysis results). References `kai_sessions` for session context.

```sql
CREATE TABLE vault_kai (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    session_id TEXT REFERENCES kai_sessions(session_id),
    ticker TEXT NOT NULL,
    decision_type TEXT CHECK (decision_type IN ('buy', 'hold', 'reduce')),
    
    -- Encrypted Decision Card (JSON)
    decision_ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',
    
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vault_kai_user ON vault_kai(user_id);
CREATE INDEX idx_vault_kai_ticker ON vault_kai(ticker);
```

---

### investor_profiles (PUBLIC)

**Public discovery layer** - stores publicly available investor information from SEC filings.
**NOT encrypted** - server can read this (it's all public data).

Used during Kai onboarding to show: "Is this you?"

```sql
CREATE TABLE investor_profiles (
    id SERIAL PRIMARY KEY,
    
    -- Identity (for name-based matching)
    name TEXT NOT NULL,
    name_normalized TEXT,            -- Lowercase, no spaces (for fuzzy search)
    cik TEXT UNIQUE,                 -- SEC CIK number
    
    -- Profile
    firm TEXT,
    title TEXT,
    investor_type TEXT,              -- 'institutional', 'insider', etc.
    photo_url TEXT,
    
    -- Holdings Summary (from 13F/Form4)
    aum_billions NUMERIC,
    top_holdings JSONB,              -- [{ticker, weight}, ...]
    sector_exposure JSONB,           -- {Technology: 40, Healthcare: 20, ...}
    
    -- Inferred Profile
    investment_style TEXT[],         -- ['Value', 'Growth', ...]
    risk_tolerance TEXT,
    time_horizon TEXT,
    portfolio_turnover TEXT,
    
    -- Activity Signals
    recent_buys TEXT[],
    recent_sells TEXT[],
    
    -- Enrichment
    public_quotes JSONB,
    biography TEXT,
    education TEXT[],
    board_memberships TEXT[],
    peer_investors TEXT[],
    
    -- Insider-specific (Form 4)
    is_insider BOOLEAN DEFAULT FALSE,
    insider_company_ticker TEXT,
    
    -- Data Source Tracking
    data_sources TEXT[],
    last_13f_date DATE,
    last_form4_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient searching
CREATE INDEX idx_investor_name ON investor_profiles(name);
CREATE INDEX idx_investor_name_trgm ON investor_profiles USING GIN (name gin_trgm_ops);
CREATE INDEX idx_investor_firm ON investor_profiles(firm);
CREATE INDEX idx_investor_cik ON investor_profiles(cik) WHERE cik IS NOT NULL;
CREATE INDEX idx_investor_type ON investor_profiles(investor_type);
CREATE INDEX idx_investor_style ON investor_profiles USING GIN (investment_style);
```

**Example `top_holdings` JSONB:**
```json
[
  {"ticker": "NVDA", "weight": 20.0},
  {"ticker": "MSFT", "weight": 15.0},
  {"ticker": "GOOGL", "weight": 10.0}
]
```

---

### user_investor_profiles (PRIVATE)

**Private vault layer** - stores user-confirmed investor profile data.
**E2E encrypted** - server CANNOT read this.

Created when user confirms: "Yes, this is me"

```sql
CREATE TABLE user_investor_profiles (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    
    -- Link to public profile (optional, for reference only)
    confirmed_investor_id INTEGER REFERENCES investor_profiles(id),
    
    -- Encrypted profile data (E2E encrypted copy from public)
    profile_data_ciphertext TEXT,
    profile_data_iv TEXT,
    profile_data_tag TEXT,
    
    -- Encrypted holdings (user's actual holdings, not public)
    custom_holdings_ciphertext TEXT,
    custom_holdings_iv TEXT,
    custom_holdings_tag TEXT,
    
    -- Encrypted preferences (user's adjusted preferences)
    preferences_ciphertext TEXT,
    preferences_iv TEXT,
    preferences_tag TEXT,
    
    -- Consent tracking
    confirmed_at TIMESTAMPTZ,
    consent_scope TEXT,
    
    algorithm TEXT DEFAULT 'aes-256-gcm',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)                  -- One profile per user
);

CREATE INDEX idx_user_investor_user ON user_investor_profiles(user_id);
```

**Data Flow:**
```
investor_profiles (PUBLIC)     user_investor_profiles (PRIVATE)
┌─────────────────────────┐    ┌─────────────────────────────────┐
│ id: 21                  │◄───│ confirmed_investor_id: 21       │
│ name: "Kushal Mehta"    │    │ user_id: "UWHGeUyf..."          │
│ top_holdings: [...]     │    │ profile_data_ciphertext: "..."  │
│ ...all public fields... │    │ (encrypted copy of public data) │
└─────────────────────────┘    └─────────────────────────────────┘
```

---

### consent_audit

Immutable audit log of all consent token operations.

```sql
CREATE TABLE consent_audit (
    id SERIAL PRIMARY KEY,
    token_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,          -- 'self' for VAULT_OWNER, agent name otherwise
    scope TEXT NOT NULL,             -- 'vault.owner', 'agent.kai.analyze', etc.
    action TEXT NOT NULL,            -- 'ISSUED', 'VALIDATED', 'REVOKED', 'REQUESTED'
    issued_at BIGINT NOT NULL,
    expires_at BIGINT,
    revoked_at BIGINT,
    metadata JSONB,
    token_type VARCHAR(20) DEFAULT 'consent',
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(32),          -- For consent request tracking
    scope_description TEXT,
    poll_timeout_at BIGINT           -- For pending consent requests
);

CREATE INDEX idx_consent_user ON consent_audit(user_id);
CREATE INDEX idx_consent_token ON consent_audit(token_id);
CREATE INDEX idx_consent_audit_created ON consent_audit(issued_at DESC);
CREATE INDEX idx_consent_audit_user_action ON consent_audit(user_id, action);
CREATE INDEX idx_consent_audit_request_id ON consent_audit(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_consent_audit_pending ON consent_audit(user_id) WHERE action = 'REQUESTED';
```

---

## 🔐 Encrypted Data Format

Each encrypted field follows this structure:

```json
{
  "ciphertext": "base64-encoded-ciphertext",
  "iv": "base64-encoded-12-byte-iv",
  "tag": "base64-encoded-16-byte-auth-tag"
}
```

**Encryption Details:**
- Algorithm: AES-256-GCM
- Key: 256-bit derived from passphrase via PBKDF2 (100k iterations)
- IV: 12 bytes, randomly generated per encryption
- Tag: 16 bytes, authentication tag

---

## 📈 Key Queries

### Get Vault Status (Optimized CTE)

Used by dashboard to show domain counts without fetching encrypted data:

```sql
WITH food_count AS (
    SELECT COUNT(*) as cnt FROM vault_food WHERE user_id = $1
),
prof_count AS (
    SELECT COUNT(*) as cnt FROM vault_professional WHERE user_id = $1
),
kai_check AS (
    SELECT EXISTS(SELECT 1 FROM user_investor_profiles WHERE user_id = $1) as exists
),
kai_prefs_count AS (
    SELECT COUNT(*) as cnt FROM vault_kai_preferences WHERE user_id = $1
)
SELECT 
    (SELECT cnt FROM food_count) as food_count,
    (SELECT cnt FROM prof_count) as prof_count,
    (SELECT exists FROM kai_check) as kai_onboarded,
    (SELECT cnt FROM kai_prefs_count) as kai_prefs_count;
```

### Get Investor Stock Count

To display stock count on dashboard, the **client** must decrypt `profile_data_ciphertext`:

```typescript
// Dashboard fetches encrypted profile
const encrypted = await HushhIdentity.getEncryptedProfile({ vaultOwnerToken });

// Client decrypts with vault key
const plaintext = await HushhVault.decryptData({
  keyHex: vaultKey,
  payload: encrypted.profile_data,
});

// Parse and count holdings
const profile = JSON.parse(plaintext);
const stockCount = profile.top_holdings?.length || 0;
```

### Audit Trail for User

```sql
SELECT
    agent_id,
    scope,
    action,
    to_timestamp(issued_at) as issued_at
FROM consent_audit
WHERE user_id = $1
ORDER BY issued_at DESC
LIMIT 50;
```

---

## 🛡️ Security Notes

| Concern           | Mitigation                                    |
| ----------------- | --------------------------------------------- |
| SQL Injection     | Parameterized queries only (asyncpg)          |
| Data at Rest      | All vault_* fields encrypted with AES-256-GCM |
| Key Storage       | Vault keys encrypted with derived keys        |
| Audit Integrity   | Append-only design, no UPDATE/DELETE on audit |
| Token Exposure    | Token ID stored, not full token               |
| Public vs Private | `investor_profiles` public, `user_investor_profiles` encrypted |

---

## 🔄 Migrations

### Run Migration Script

```bash
cd consent-protocol

# Create specific table
python db/migrate.py --table vault_food

# Create all tables
python db/migrate.py --full

# Show status
python db/migrate.py --status
```

### Table Creation Order (Dependencies)

1. `vault_keys` (root)
2. `vault_food`, `vault_professional` (depend on vault_keys)
3. `consent_audit` (references vault_keys)
4. `investor_profiles` (standalone public table)
5. `user_investor_profiles` (depends on vault_keys, references investor_profiles)
6. `vault_kai`, `vault_kai_preferences` (depend on vault_keys)

---

## 📊 Domain Summary

| Domain | Table | Storage Pattern | Privacy |
|--------|-------|-----------------|---------|
| **Food** | `vault_food` | Field-based (N rows per user) | E2E Encrypted |
| **Professional** | `vault_professional` | Field-based (N rows per user) | E2E Encrypted |
| **Kai Preferences** | `vault_kai_preferences` | Field-based (N rows per user) | E2E Encrypted |
| **Kai Decisions** | `vault_kai` | Row per analysis | E2E Encrypted |
| **Investor (Public)** | `investor_profiles` | Single row per investor | **Public** (SEC data) |
| **Investor (Private)** | `user_investor_profiles` | Single row per user | E2E Encrypted |
| **Consent Audit** | `consent_audit` | Append-only log | Token IDs only |

---

_Version: 2.0 | Updated: January 14, 2026 | Field-based storage + Investor profiles_
