# User Data Architecture

> **Last Updated:** January 2026
> **Purpose:** Overview of Hushh user data architecture

---

## Architecture Overview

Hushh uses a **field-based encrypted vault model** where:

- Each user is identified by **Firebase UID** (`user_id`)
- User data is stored as **encrypted fields** in domain-specific tables
- All data access requires **consent tokens** with cryptographic signatures
- Backend stores only **ciphertext** - encryption keys never leave the client

```
┌─────────────────────────────────────────────────────────────┐
│                     USER IDENTITY                            │
│  (Firebase Authentication)                                   │
├─────────────────────────────────────────────────────────────┤
│   user_id (Firebase UID - primary identifier)               │
│   Authentication: Google Sign-In, Apple Sign-In, Phone      │
└─────────────────────────────────────────────────────────────┘
         │
         └──► Vault Tables (encrypted field storage)
              ├──► vault_food          (dietary, cuisine, budget)
              ├──► vault_professional  (career, skills, profile)
              ├──► vault_kai_preferences (risk profile, watchlist)
              └──► vault_kai           (investment decisions)
```

---

## Key Principles

### 1. Firebase UID as Primary Key

All user data is keyed by Firebase UID, not phone number:

```sql
-- All vault tables use user_id as primary key
CREATE TABLE vault_food (
    user_id TEXT PRIMARY KEY,   -- Firebase UID
    field_name TEXT NOT NULL,
    ciphertext TEXT NOT NULL,   -- Encrypted data
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    ...
);
```

### 2. Field-Based Encrypted Storage

Instead of JSON documents, data is stored as individual encrypted fields:

| Column | Description |
|--------|-------------|
| `user_id` | Firebase UID |
| `field_name` | Name of the data field (e.g., "dietary_restrictions") |
| `ciphertext` | AES-256-GCM encrypted value (base64) |
| `iv` | Initialization vector (base64) |
| `tag` | Authentication tag (base64) |
| `algorithm` | Encryption algorithm (default: "aes-256-gcm") |

### 3. Zero-Knowledge Backend

The server **cannot decrypt** user data:

- Encryption keys derived client-side from user passphrase
- Keys stored in memory only (never persisted)
- Backend stores and returns only ciphertext
- Decryption happens client-side only

### 4. Consent-First Access

All data access requires valid consent tokens:

```
Token Format: HCT:base64(payload).signature

Payload: user_id|agent_id|scope|issued_at|expires_at
Signature: HMAC-SHA256(payload, secret_key)
```

---

## Domain Tables

### vault_food

Stores encrypted food and dining preferences:

| Field Name | Description |
|------------|-------------|
| `dietary_restrictions` | Vegetarian, vegan, allergies, etc. |
| `cuisine_preferences` | Favorite cuisines |
| `monthly_budget` | Dining budget |
| `favorite_locations` | Saved restaurant locations |

### vault_professional

Stores encrypted professional profile data:

| Field Name | Description |
|------------|-------------|
| `professional_title` | Job title |
| `skills` | Array of skills |
| `experience_level` | Junior/mid/senior |
| `job_preferences` | Work preferences |

### vault_kai_preferences

Stores encrypted investment preferences:

| Field Name | Description |
|------------|-------------|
| `risk_profile` | Conservative/balanced/aggressive |
| `investment_goals` | Investment objectives |
| `watchlist` | Tracked tickers |

### vault_kai

Stores encrypted investment decision history:

| Field Name | Description |
|------------|-------------|
| `ticker` | Stock ticker |
| `decision` | Buy/hold/sell decision card |
| `debate_history` | Agent debate transcript |

---

## Consent Scopes

| Scope | Domain | Access |
|-------|--------|--------|
| `vault.owner` | All | Master scope - full vault access |
| `vault.read.food` | Food | Read dietary preferences |
| `vault.write.food` | Food | Write dietary preferences |
| `vault.read.professional` | Professional | Read career data |
| `vault.write.professional` | Professional | Write career data |
| `vault.read.finance` | Kai | Read investment data |
| `vault.write.finance` | Kai | Write investment data |
| `agent.kai.analyze` | Kai | Perform investment analysis |

---

## Authentication Flow

```
1. User signs in via Firebase (Google/Apple/Phone)
   → Receives Firebase ID token

2. App derives vault key from user passphrase
   → Key stored in memory only (VaultContext)

3. App requests VAULT_OWNER token from backend
   → Backend verifies Firebase token
   → Issues HCT consent token (7-day expiry)

4. App uses consent token for all data operations
   → Token validated on every request
   → Token can be revoked at any time
```

---

## Related Documentation

- **Database Schema Details:** [database_schema.md](database_schema.md)
- **Consent Implementation:** [consent-implementation.md](consent-implementation.md)
- **Developer API:** [developer_api.md](developer_api.md)

---

## Migration Note

This document replaces the previous "Card-based data model" documentation. The current implementation uses field-based encrypted storage with Firebase UID as the primary identifier, not phone_number-based cards.

---

_Last updated: January 2026_
