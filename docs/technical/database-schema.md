# Database Schema - Passphrase + Recovery Architecture

> **Core Principles**: Scoped Access + Auditability + Zero-Knowledge

---

## Core Tables

### vault_keys

Passphrase and recovery key authentication.

| Column                       | Type    | Description                           |
| ---------------------------- | ------- | ------------------------------------- |
| user_id                      | TEXT PK | Unique user identifier (Firebase UID) |
| auth_method                  | TEXT    | Authentication method ('passphrase')  |
| encrypted_vault_key          | TEXT    | Vault key encrypted with passphrase   |
| salt                         | TEXT    | PBKDF2 salt for passphrase            |
| iv                           | TEXT    | AES-GCM IV for passphrase encryption  |
| recovery_encrypted_vault_key | TEXT    | Vault key encrypted with recovery key |
| recovery_salt                | TEXT    | PBKDF2 salt for recovery              |
| recovery_iv                  | TEXT    | AES-GCM IV for recovery encryption    |
| created_at                   | BIGINT  | Timestamp                             |

> **Security**: Two separate encrypted copies allow passphrase OR recovery key unlock.

---

## Domain Tables

### vault_food 🍽️

Scope: `VAULT_WRITE_FOOD`

| Column           | Type    | Description                                                     |
| ---------------- | ------- | --------------------------------------------------------------- |
| user_id          | TEXT FK | User reference                                                  |
| field_name       | TEXT    | `dietary_restrictions`, `cuisine_preferences`, `monthly_budget` |
| ciphertext       | TEXT    | AES-256-GCM encrypted data                                      |
| iv               | TEXT    | Initialization vector                                           |
| tag              | TEXT    | Authentication tag                                              |
| consent_token_id | TEXT    | Audit reference (Bible: Auditability)                           |

### vault_professional 💼

Scope: `VAULT_WRITE_PROFESSIONAL`

| Column           | Type    | Description                                                           |
| ---------------- | ------- | --------------------------------------------------------------------- |
| user_id          | TEXT FK | User reference                                                        |
| field_name       | TEXT    | `professional_title`, `skills`, `experience_level`, `job_preferences` |
| ciphertext       | TEXT    | AES-256-GCM encrypted data                                            |
| iv               | TEXT    | Initialization vector                                                 |
| tag              | TEXT    | Authentication tag                                                    |
| consent_token_id | TEXT    | Audit reference                                                       |

---

## Audit Tables

### consent_audit 📋

Principle: **Auditability**

| Column     | Type        | Description                                   |
| ---------- | ----------- | --------------------------------------------- |
| token_id   | TEXT UNIQUE | Consent token ID (HCT:...)                    |
| user_id    | TEXT FK     | User reference                                |
| agent_id   | TEXT        | Which agent issued token                      |
| scope      | TEXT        | `vault.write.food`, `vault.read.professional` |
| action     | TEXT        | `issue`, `validate`, `revoke`                 |
| issued_at  | BIGINT      | Token creation time                           |
| expires_at | BIGINT      | Token expiration time                         |
| revoked_at | BIGINT      | If revoked, when                              |

---

## Encryption Details

### Passphrase-Based Key Derivation

```
Passphrase
    ↓
PBKDF2 (100,000 iterations, SHA-256)
    ↓
256-bit AES Key
    ↓
Encrypt/Decrypt Vault Key
```

### Vault Key Usage

```
Vault Key (in sessionStorage only)
    ↓
AES-256-GCM
    ↓
Encrypt domain data (food, professional, etc.)
```

---

## API Routes

| Route                     | Domain       | Description                   |
| ------------------------- | ------------ | ----------------------------- |
| `/api/vault/setup`        | Core         | Store encrypted vault keys    |
| `/api/vault/get`          | Core         | Retrieve encrypted vault keys |
| `/api/vault/check`        | Core         | Check if vault exists         |
| `/api/vault/food`         | Food         | Get/store food preferences    |
| `/api/vault/professional` | Professional | Get/store career data         |

---

## Migration

Run: `node scripts/run-migration.mjs`

This creates all tables with proper foreign keys and indexes.
