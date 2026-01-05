# Agent Kai — Database Schema

> Auto-generated for `db/migrate.py`

---

## Existing Tables (Kai Reuses)

| Table            | Purpose                   | Kai Usage                |
| ---------------- | ------------------------- | ------------------------ |
| `vault_keys`     | User encryption keys      | FK for user_id           |
| `consent_audit`  | Consent token audit trail | Logs Kai consent actions |
| `session_tokens` | Active sessions           | Session management       |

---

## New Tables for Kai

### `kai_sessions` — Onboarding & Analysis State

```sql
CREATE TABLE IF NOT EXISTS kai_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,

    -- User Preferences (set during onboarding)
    processing_mode TEXT CHECK (processing_mode IN ('on_device', 'hybrid')),
    risk_profile TEXT CHECK (risk_profile IN ('conservative', 'balanced', 'aggressive')),

    -- Onboarding State
    legal_acknowledged BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kai_sessions_user ON kai_sessions(user_id);
```

### `kai_decisions` — Investment Decision History (Encrypted)

```sql
CREATE TABLE IF NOT EXISTS kai_decisions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
    session_id TEXT REFERENCES kai_sessions(session_id),

    -- Security identifiers
    ticker TEXT NOT NULL,
    decision_type TEXT CHECK (decision_type IN ('buy', 'hold', 'reduce')),

    -- Encrypted payload (vault key encryption)
    decision_ciphertext TEXT NOT NULL,  -- Decision card JSON
    debate_ciphertext TEXT,             -- Full debate transcript
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    algorithm TEXT DEFAULT 'aes-256-gcm',

    -- Metadata (not encrypted)
    confidence_score DECIMAL(3,2),      -- 0.00 to 1.00

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kai_decisions_user ON kai_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_kai_decisions_ticker ON kai_decisions(ticker);
```

---

## Migration Function

Add to `db/migrate.py`:

```python
async def create_kai_sessions(pool: asyncpg.Pool):
    """Create kai_sessions table."""
    print("🤖 Creating kai_sessions table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS kai_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            processing_mode TEXT CHECK (processing_mode IN ('on_device', 'hybrid')),
            risk_profile TEXT CHECK (risk_profile IN ('conservative', 'balanced', 'aggressive')),
            legal_acknowledged BOOLEAN DEFAULT FALSE,
            onboarding_complete BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_sessions_user ON kai_sessions(user_id)")
    print("✅ kai_sessions ready!")


async def create_kai_decisions(pool: asyncpg.Pool):
    """Create kai_decisions table (encrypted decision history)."""
    print("📊 Creating kai_decisions table...")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS kai_decisions (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES vault_keys(user_id) ON DELETE CASCADE,
            session_id TEXT REFERENCES kai_sessions(session_id),
            ticker TEXT NOT NULL,
            decision_type TEXT CHECK (decision_type IN ('buy', 'hold', 'reduce')),
            decision_ciphertext TEXT NOT NULL,
            debate_ciphertext TEXT,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            algorithm TEXT DEFAULT 'aes-256-gcm',
            confidence_score DECIMAL(3,2),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_decisions_user ON kai_decisions(user_id)")
    await pool.execute("CREATE INDEX IF NOT EXISTS idx_kai_decisions_ticker ON kai_decisions(ticker)")
    print("✅ kai_decisions ready!")
```

Add to `TABLE_CREATORS`:

```python
TABLE_CREATORS = {
    # ... existing ...
    "kai_sessions": create_kai_sessions,
    "kai_decisions": create_kai_decisions,
}
```

---

## Usage

```bash
# Create Kai tables
python db/migrate.py --table kai_sessions
python db/migrate.py --table kai_decisions

# Check status
python db/migrate.py --status
```
