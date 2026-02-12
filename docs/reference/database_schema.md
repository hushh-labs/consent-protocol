# Database Schema

> PostgreSQL schema for the Hushh encrypted vault, world model, and consent audit system.

---

## 🔌 Database Connection

Hushh uses **SQLAlchemy with Supabase's Session Pooler** for direct PostgreSQL connections.

### Connection Configuration

```env
# .env file
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-password
DB_HOST=aws-1-us-east-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
```

---

## 🎯 Design Principles

| Principle             | Implementation                                     |
| --------------------- | -------------------------------------------------- |
| **Zero-Knowledge**    | All user data stored as AES-256-GCM ciphertext     |
| **Dynamic Domains**   | World model supports any domain without schema changes |
| **Audit Trail**       | `consent_audit` logs all token operations          |
| **No Plaintext**      | Server cannot decrypt any user data                |
| **Vector Search**     | pgvector embeddings for similarity matching        |

---

## 📊 Entity Relationship Diagram

```mermaid
erDiagram
    vault_keys ||--o{ world_model_index_v2 : has
    vault_keys ||--o{ world_model_data : has
    vault_keys ||--o{ world_model_attributes : has
    vault_keys ||--o{ consent_audit : has
    
    domain_registry ||--o{ world_model_attributes : categorizes
    
    vault_keys {
        text user_id PK
        text auth_method
        text encrypted_vault_key
        text salt
        text iv
        timestamptz created_at
    }
    
    domain_registry {
        text domain_key PK
        text display_name
        text description
        text icon_name
        text color_hex
        text parent_domain FK
        int attribute_count
        int user_count
        timestamptz first_seen_at
    }
    
    world_model_index_v2 {
        text user_id PK
        jsonb domain_summaries
        text[] available_domains
        text[] computed_tags
        decimal activity_score
        timestamptz last_active_at
        int total_attributes
        int model_version
    }
    
    world_model_data {
        text user_id PK FK
        text encrypted_data_ciphertext
        text encrypted_data_iv
        text encrypted_data_tag
        text algorithm
        bigint data_version
    }
    
    world_model_attributes {
        serial id PK
        text user_id FK
        text domain
        text attribute_key
        text ciphertext
        text iv
        text tag
        text algorithm
        text source
        text display_name
        text data_type
        decimal confidence
    }
    
    consent_audit {
        serial id PK
        text token_id
        text user_id FK
        text agent_id
        text scope
        text action
        bigint issued_at
        bigint expires_at
        bigint revoked_at
        jsonb metadata
        varchar token_type
        varchar ip_address
        text user_agent
        varchar request_id
        text scope_description
        bigint poll_timeout_at
    }
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
    
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT
);
```

**Notes:**
- `user_id` is Firebase UID (e.g., `UWHGeUyfUAbmEl5xwIPoWJ7Cyft2`)
- `auth_method` is currently always `'passphrase'` (biometric planned)
- Both passphrase and recovery keys can decrypt the vault key

---

### domain_registry

Dynamic domain registry for the World Model. Domains are auto-registered when new attribute types are discovered.

```sql
CREATE TABLE domain_registry (
    domain_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,                  -- Lucide icon name
    color_hex TEXT,                  -- Brand color for UI
    parent_domain TEXT REFERENCES domain_registry(domain_key),
    attribute_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domain_parent ON domain_registry(parent_domain);
```

**Seeded Domains:**
| domain_key | display_name | icon_name | color_hex |
|------------|--------------|-----------|-----------|
| financial | Financial | wallet | #D4AF37 |
| food | Food & Dining | utensils | #F97316 |
| health | Health & Wellness | heart | #EF4444 |
| travel | Travel | plane | #0EA5E9 |
| subscriptions | Subscriptions | credit-card | #6366F1 |

---

### world_model_data

**Primary encrypted storage** for all user data using BYOK (Bring Your Own Key) encryption. Contains a single encrypted JSONB blob that holds ALL domain data.

```sql
CREATE TABLE world_model_data (
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
);
```

**Notes:**
- The decrypted blob contains all domains: `{ financial: {...}, food: {...}, health: {...} }`
- Server NEVER decrypts - only the client has the vault key
- Client filters by scope at approval time to limit what MCP receives

---

### world_model_index_v2

Queryable index layer for user world models. Updated automatically via triggers when attributes change.

```sql
CREATE TABLE world_model_index_v2 (
    user_id TEXT PRIMARY KEY REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    domain_summaries JSONB DEFAULT '{}',
    available_domains TEXT[] DEFAULT '{}',
    computed_tags TEXT[] DEFAULT '{}',
    activity_score DECIMAL(3,2),
    last_active_at TIMESTAMPTZ,
    total_attributes INTEGER DEFAULT 0,
    model_version INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wmi2_domains ON world_model_index_v2 USING GIN(domain_summaries);
CREATE INDEX idx_wmi2_available ON world_model_index_v2 USING GIN(available_domains);
CREATE INDEX idx_wmi2_tags ON world_model_index_v2 USING GIN(computed_tags);
```

---

### world_model_attributes

Encrypted attribute storage (legacy field-based approach, being phased out in favor of world_model_data blob).

```sql
CREATE TABLE world_model_attributes (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    domain TEXT NOT NULL,            -- References domain_registry.domain_key
    attribute_key TEXT NOT NULL,     -- e.g., 'dietary_restrictions', 'risk_tolerance'
    
    -- Encrypted Value (BYOK)
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',
    
    -- Metadata
    source TEXT NOT NULL DEFAULT 'explicit',  -- 'explicit', 'inferred', 'imported', 'computed'
    confidence DECIMAL(3,2),
    inferred_at TIMESTAMPTZ,
    display_name TEXT,
    data_type TEXT DEFAULT 'string',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, domain, attribute_key)
);

CREATE INDEX idx_wma_user ON world_model_attributes(user_id);
CREATE INDEX idx_wma_domain ON world_model_attributes(domain);
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

### consent_exports

MCP zero-knowledge export data storage. Stores encrypted export data that MCP can decrypt with the export key.

```sql
CREATE TABLE consent_exports (
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
);

CREATE INDEX idx_consent_exports_user ON consent_exports(user_id);
CREATE INDEX idx_consent_exports_expires ON consent_exports(expires_at);
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

### Get User World Model Metadata (RPC Function)

Returns comprehensive metadata about a user's world model:

```sql
CREATE OR REPLACE FUNCTION get_user_world_model_metadata(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'domains', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'key', dr.domain_key,
                    'display_name', dr.display_name,
                    'icon', dr.icon_name,
                    'color', dr.color_hex,
                    'attribute_count', (
                        SELECT COUNT(*) 
                        FROM world_model_attributes wma 
                        WHERE wma.user_id = p_user_id AND wma.domain = dr.domain_key
                    )
                )
            )
            FROM domain_registry dr
            WHERE dr.domain_key = ANY(
                SELECT DISTINCT domain FROM world_model_attributes WHERE user_id = p_user_id
            )
        ), '[]'::jsonb),
        'total_attributes', COALESCE((
            SELECT COUNT(*) FROM world_model_attributes WHERE user_id = p_user_id
        ), 0),
        'available_domains', COALESCE((
            SELECT array_agg(DISTINCT domain) FROM world_model_attributes WHERE user_id = p_user_id
        ), ARRAY[]::TEXT[])
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;
```

**Usage:**
```sql
SELECT get_user_world_model_metadata('UWHGeUyfUAbmEl5xwIPoWJ7Cyft2');
```

---

### Get World Model Status

Used by dashboard to show domain counts:

```sql
SELECT 
    wmi.total_attributes,
    wmi.available_domains,
    wmi.last_active_at,
    (SELECT COUNT(*) FROM world_model_data WHERE user_id = $1) as data_exists
FROM world_model_index_v2 wmi
WHERE wmi.user_id = $1;
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

---

## 🔄 Deprecated Tables

The following tables have been removed and replaced by the unified world model architecture:

| Old Table | Replacement |
|-----------|-------------|
| `vault_portfolios` | Merged into `world_model_data` with domain key |
| `vault_food` | Merged into `world_model_data` under `food` domain |
| `vault_professional` | Merged into `world_model_data` under `professional` domain |
| `vault_kai` | Removed (investment decisions stored in `world_model_data` under `financial` domain) |
| `vault_kai_preferences` | Merged into `world_model_data` under `financial` domain |
| `chat_conversations` | Removed (replaced by in-memory chat state) |
| `chat_messages` | Removed (replaced by in-memory chat state) |
| `user_investor_profiles` | Removed |
| `investor_profiles` | Read-only reference table (not user data) |

---

## 📊 Domain Summary

| Domain | Table | Storage Pattern | Privacy |
|--------|-------|-----------------|---------|
| **All User Data** | `world_model_data` | Single encrypted blob per user | E2E Encrypted |
| **User Index** | `world_model_index_v2` | Single row per user | Non-sensitive metadata |
| **Domain Registry** | `domain_registry` | One row per domain | Public |
| **Consent Audit** | `consent_audit` | Append-only log | Token IDs only |
| **Consent Exports** | `consent_exports` | MCP zero-knowledge exports | E2E Encrypted (client-side) |

---

## 🔄 Migrations

### Migration Script Location

- `consent-protocol/db/migrate.py` - Modular per-table migration script

### Run Migration

```bash
cd consent-protocol
python db/migrate.py --init      # Initialize all tables (non-destructive)
python db/migrate.py --full      # Full reset (WARNING: DESTRUCTIVE!)
python db/migrate.py --status    # Show table summary
```

---

## 📈 Renaissance Universe

The `renaissance_universe` table stores the Renaissance AI Fund's investable stock universe with tier classifications.

### renaissance_universe

```sql
CREATE TABLE renaissance_universe (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    sector TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('ACE', 'KING', 'QUEEN', 'JACK')),
    fcf_billions NUMERIC(10,2),           -- 2024 Free Cash Flow in billions
    investment_thesis TEXT,                -- Why investable
    tier_rank INTEGER,                     -- Rank within tier (1 = best)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tier Definitions

| Tier | Description | Count | FCF Range |
|------|-------------|-------|-----------|
| **ACE** | Top-tier, largest FCF generators with strongest moats | 30 | $6B - $109B |
| **KING** | High-quality companies with strong market positions | 41 | $1.5B - $22B |
| **QUEEN** | Quality companies with solid fundamentals | 36 | $0.8B - $11B |
| **JACK** | Good companies, smaller FCF but still investable | 44 | $0.3B - $6.5B |

---

_Version: 4.0 | Updated: February 2026 | World Model Architecture_