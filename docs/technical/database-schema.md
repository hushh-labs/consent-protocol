# Database Schema

> PostgreSQL schema for the Hushh encrypted vault and consent audit system.

---

## 🎯 Design Principles

| Principle             | Implementation                                 |
| --------------------- | ---------------------------------------------- |
| **Zero-Knowledge**    | All user data stored as AES-256-GCM ciphertext |
| **Domain Separation** | Separate tables per data category              |
| **Audit Trail**       | `consent_audit` logs all token operations      |
| **No Plaintext**      | Server cannot decrypt any user data            |

---

## 📊 Entity Relationship Diagram

```
┌──────────────────────┐
│       users          │
├──────────────────────┤
│ id (PK)              │
│ email                │
│ name                 │
│ image                │
│ firebase_uid         │
│ created_at           │
│ updated_at           │
└──────────┬───────────┘
           │
           │ 1:1
           ▼
┌──────────────────────┐
│     vault_keys       │
├──────────────────────┤
│ user_id (PK, FK)     │
│ encrypted_vault_key  │
│ recovery_encrypted_  │
│   vault_key          │
│ key_version          │
│ created_at           │
│ updated_at           │
└──────────┬───────────┘
           │
           │ 1:1
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│     vault_food       │     │  vault_professional  │
├──────────────────────┤     ├──────────────────────┤
│ user_id (PK, FK)     │     │ user_id (PK, FK)     │
│ dietary_restrictions │     │ professional_title   │
│   (ENCRYPTED)        │     │   (ENCRYPTED)        │
│ cuisine_preferences  │     │ skills               │
│   (ENCRYPTED)        │     │   (ENCRYPTED)        │
│ monthly_food_budget  │     │ experience_level     │
│   (ENCRYPTED)        │     │   (ENCRYPTED)        │
│ created_at           │     │ job_preferences      │
│ updated_at           │     │   (ENCRYPTED)        │
└──────────────────────┘     │ created_at           │
                              │ updated_at           │
                              └──────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│    consent_audit     │
├──────────────────────┤
│ id (PK)              │
│ user_id (FK)         │
│ agent_id             │
│ scope                │
│ action               │
│ token_hash           │
│ created_at           │
└──────────────────────┘
```

---

## 📋 Table Definitions

### users

Core user identity from Firebase OAuth.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    image TEXT,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
```

---

### vault_keys

Stores encrypted vault keys for zero-knowledge recovery.

```sql
CREATE TABLE vault_keys (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Vault key encrypted with passphrase-derived key
    encrypted_vault_key TEXT NOT NULL,

    -- Vault key encrypted with recovery key
    recovery_encrypted_vault_key TEXT NOT NULL,

    -- Key rotation versioning
    key_version INTEGER DEFAULT 1,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN vault_keys.encrypted_vault_key IS
    'AES-256-GCM encrypted with PBKDF2-derived key from passphrase';
COMMENT ON COLUMN vault_keys.recovery_encrypted_vault_key IS
    'AES-256-GCM encrypted with PBKDF2-derived key from recovery key';
```

---

### vault_food

Food & Dining preferences (all fields encrypted).

```sql
CREATE TABLE vault_food (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- All fields are AES-256-GCM encrypted JSON
    dietary_restrictions TEXT,  -- Encrypted: ["Vegetarian", "Gluten-Free"]
    cuisine_preferences TEXT,   -- Encrypted: ["Italian", "Mexican"]
    monthly_food_budget TEXT,   -- Encrypted: 500

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE vault_food IS
    'All fields are AES-256-GCM encrypted. Server cannot decrypt.';
```

---

### vault_professional

Professional profile data (all fields encrypted).

```sql
CREATE TABLE vault_professional (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- All fields are AES-256-GCM encrypted JSON
    professional_title TEXT,   -- Encrypted: "Senior Software Engineer"
    skills TEXT,               -- Encrypted: ["Python", "React", "AWS"]
    experience_level TEXT,     -- Encrypted: "Senior (5-8 years)"
    job_preferences TEXT,      -- Encrypted: ["Full-time", "Remote"]

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### consent_audit

Immutable audit log of all consent token operations.

```sql
CREATE TABLE consent_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What agent requested/used consent
    agent_id VARCHAR(128) NOT NULL,

    -- Which scope was authorized
    scope VARCHAR(128) NOT NULL,

    -- What action was performed
    action VARCHAR(32) NOT NULL CHECK (action IN ('issued', 'validated', 'revoked', 'denied')),

    -- Hash of token for correlation (not the actual token)
    token_hash CHAR(64) NOT NULL,

    -- Timestamp of action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consent_audit_user_id ON consent_audit(user_id);
CREATE INDEX idx_consent_audit_agent_id ON consent_audit(agent_id);
CREATE INDEX idx_consent_audit_created_at ON consent_audit(created_at);

COMMENT ON COLUMN consent_audit.token_hash IS
    'SHA-256 hash of consent token for correlation without storing secret';
```

---

## 🔐 Encrypted Data Format

Each encrypted field follows this structure:

```json
{
  "iv": "base64-encoded-12-byte-iv",
  "ciphertext": "base64-encoded-ciphertext",
  "tag": "base64-encoded-16-byte-auth-tag",
  "algorithm": "AES-256-GCM"
}
```

### Example Encrypted Value

```
dietary_restrictions:
"eyJpdiI6ImpKM2RhS2x..."  <- base64 of JSON structure above
```

---

## 🔄 Migrations

### Initial Setup

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run table creation in order
-- 1. users
-- 2. vault_keys
-- 3. vault_food
-- 4. vault_professional
-- 5. consent_audit
```

### Check Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'vault_%';
```

---

## 📈 Queries

### Get User with All Vault Data

```sql
SELECT
    u.id,
    u.email,
    vf.dietary_restrictions,
    vf.cuisine_preferences,
    vp.professional_title,
    vp.skills
FROM users u
LEFT JOIN vault_food vf ON u.id = vf.user_id
LEFT JOIN vault_professional vp ON u.id = vp.user_id
WHERE u.firebase_uid = $1;
```

### Audit Trail for User

```sql
SELECT
    agent_id,
    scope,
    action,
    created_at
FROM consent_audit
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

### Count Actions by Agent

```sql
SELECT
    agent_id,
    action,
    COUNT(*) as count
FROM consent_audit
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_id, action
ORDER BY count DESC;
```

---

## 🛡️ Security Notes

| Concern         | Mitigation                             |
| --------------- | -------------------------------------- |
| SQL Injection   | Parameterized queries only             |
| Data at Rest    | All vault\_\* fields encrypted         |
| Key Storage     | Vault keys encrypted with derived keys |
| Audit Integrity | Append-only table, no UPDATE/DELETE    |
| Token Exposure  | Only token hash stored in audit        |

---

## 🍽️ Domain: Food & Dining

Stored in `vault_food` table as encrypted JSON.

### Data Types

| Type                    | Fields                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| `DietaryProfile`        | diet_type, allergies, intolerances, restrictions, calorie_target     |
| `FoodPreferences`       | favorite_cuisines, disliked_cuisines, spice_tolerance, cooking_skill |
| `RestaurantPreferences` | price_range, ambiance, location_radius, favorites                    |

### Consent Scopes

| Scope              | Description            |
| ------------------ | ---------------------- |
| `vault.read.food`  | Read food preferences  |
| `vault.write.food` | Write food preferences |

### Example Decrypted Data

```json
{
  "dietary_restrictions": ["Vegetarian", "Gluten-Free"],
  "cuisine_preferences": ["Italian", "Mexican", "Japanese"],
  "monthly_food_budget": 500,
  "spice_tolerance": "medium"
}
```

---

## 💼 Domain: Professional Profile

Stored in `vault_professional` table as encrypted JSON.

### Data Types

| Type                  | Fields                                           |
| --------------------- | ------------------------------------------------ |
| `ProfessionalProfile` | title, skills, experience_level, job_preferences |

### Consent Scopes

| Scope                      | Description             |
| -------------------------- | ----------------------- |
| `vault.read.professional`  | Read professional data  |
| `vault.write.professional` | Write professional data |

### Example Decrypted Data

```json
{
  "professional_title": "Senior Software Engineer",
  "skills": ["Python", "React", "AWS"],
  "experience_level": "Senior (5-8 years)",
  "job_preferences": ["Full-time", "Remote"]
}
```

---

_Version: 1.1 | Updated: 2024-12-14_
