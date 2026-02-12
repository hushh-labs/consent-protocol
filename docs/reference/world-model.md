# World Model

> The two-table encrypted data architecture that powers user data sovereignty, MCP scoping, and BYOK encryption.

---

## Two-Table Architecture

All user data is stored across exactly two tables. This separation enables MCP agents to discover what data domains a user has (via the non-encrypted index) without ever accessing the encrypted content.

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│   world_model_index_v2       │     │   world_model_data           │
│   (non-encrypted metadata)   │     │   (AES-256-GCM ciphertext)  │
│                              │     │                              │
│ • available_domains[]        │     │ • encrypted_data_ciphertext  │
│ • domain_summaries (JSONB)   │     │ • encrypted_data_iv          │
│ • computed_tags[]            │     │ • encrypted_data_tag         │
│ • activity_score             │     │ • algorithm                  │
│                              │     │ • data_version               │
│ Purpose: MCP scoping,        │     │ Purpose: actual user data,   │
│ domain discovery, search     │     │ decrypted only on client     │
└──────────────────────────────┘     └──────────────────────────────┘
```

---

## Table Schemas

### world_model_data

Stores the encrypted user data blob. One row per user.

| Column                       | Type        | Description                            |
| ---------------------------- | ----------- | -------------------------------------- |
| `user_id`                    | `TEXT PK`   | Firebase UID                           |
| `encrypted_data_ciphertext`  | `TEXT`      | Base64-encoded AES-256-GCM ciphertext  |
| `encrypted_data_iv`          | `TEXT`      | Base64-encoded 12-byte initialization vector |
| `encrypted_data_tag`         | `TEXT`      | Base64-encoded 16-byte authentication tag |
| `algorithm`                  | `TEXT`      | Always `AES-256-GCM`                   |
| `data_version`               | `INTEGER`   | Monotonically increasing version       |
| `created_at`                 | `TIMESTAMPTZ` | Row creation time                    |
| `updated_at`                 | `TIMESTAMPTZ` | Last update time                     |

### world_model_index_v2

Non-encrypted metadata enabling MCP scoping and domain discovery.

| Column              | Type          | Description                                      |
| ------------------- | ------------- | ------------------------------------------------ |
| `user_id`           | `TEXT PK`     | Firebase UID                                     |
| `domain_summaries`  | `JSONB`       | Per-domain metadata (sanitized, no sensitive data) |
| `available_domains` | `TEXT[]`       | Array of active domain keys                      |
| `computed_tags`     | `TEXT[]`       | Auto-generated tags for search                   |
| `activity_score`    | `FLOAT`       | User engagement metric                           |
| `last_active_at`    | `TIMESTAMPTZ` | Last data modification                           |
| `created_at`        | `TIMESTAMPTZ` | Row creation time                                |
| `updated_at`        | `TIMESTAMPTZ` | Last update time                                 |

**GIN Indexes**: `domain_summaries`, `available_domains`, `computed_tags` are all GIN-indexed for fast JSONB and array queries.

---

## BYOK Encryption Flow

The server never sees plaintext user data. All encryption/decryption happens on the client.

### Notation

| Symbol       | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| `K_vault`    | User's vault key (64 hex chars), derived via PBKDF2 from passphrase |
| `K_export`   | One-time export key (64 hex chars), generated per MCP consent  |
| `AES-256-GCM`| Encryption with 12-byte IV, 16-byte authentication tag        |

### Storing Data

```
Client:
  1. User imports/updates data (e.g., portfolio)
  2. Client encrypts full world model blob:
     ciphertext = AES-256-GCM(K_vault, plaintext)
  3. Client POST /api/world-model/store-domain:
     { ciphertext, iv, tag, algorithm: "AES-256-GCM" }
  4. Client also sends sanitized domain_summaries for index update

Backend:
  5. Stores ciphertext in world_model_data
  6. Stores sanitized summary in world_model_index_v2
  7. Never decrypts anything
```

### Reading Data

```
Client:
  1. GET /api/world-model/domain-data/{userId}/{domain}
  2. Backend returns { ciphertext, iv, tag }
  3. Client decrypts: plaintext = AES-256-GCM-Decrypt(K_vault, ciphertext)
  4. Client renders data in UI
```

---

## Dynamic Scope Generation

MCP agents discover user data availability through scopes generated from `world_model_index_v2`.

### Scope Pattern

```
attr.{domain}.*              # All attributes in a domain
attr.{domain}.{key}          # Specific attribute
vault.owner                  # Full vault access (owner only)
```

### How It Works

1. `DynamicScopeGenerator` reads `world_model_index_v2.available_domains`
2. For each domain (e.g., `financial`, `food`), generates scope `attr.{domain}.*`
3. MCP agent requests consent for specific scope
4. User approves/denies in the consent UI

---

## MCP Zero-Knowledge Export Flow

When an external MCP agent (e.g., Claude Desktop) needs user data:

```
1. MCP Agent → POST /api/v1/request-consent
   { user_id, scope: "attr.food.*", agent_id: "claude-mcp" }

2. Backend creates consent_audit record (PENDING)
   Backend sends FCM push notification to user

3. User sees notification → opens app → reviews request

4. User approves:
   a. Client decrypts full blob with K_vault
   b. Client filters to only requested scope (e.g., food domain)
   c. Client generates K_export (one-time key)
   d. Client re-encrypts scoped subset with K_export
   e. Client POST /api/consent/pending/approve
      { ciphertext, iv, tag, export_key: K_export }

5. Backend stores encrypted export in consent_exports
   Backend updates consent_audit to APPROVED

6. MCP Agent polls → finds APPROVED → fetches encrypted export
   MCP Agent decrypts with K_export → gets only the approved scope data
```

**Security Properties**:
- Server never decrypts user data (zero-knowledge)
- Export key is one-time, scoped to a single consent
- MCP agent only receives the approved scope subset
- Exports have TTL and auto-expire

---

## RPCs

### merge_domain_summary

Atomically merges a JSONB object into `domain_summaries` without a read-modify-write cycle.

```sql
SELECT merge_domain_summary(
  p_user_id  := 'firebase-uid',
  p_domain   := 'financial',
  p_summary  := '{"account_count": 2, "last_import": "2026-02-11"}'::jsonb
);
```

Effect: Deep-merges the provided summary into the `financial` key of `domain_summaries`, and ensures `financial` appears in `available_domains`.

### remove_domain_summary_key

Atomically removes a specific key from a domain's summary.

```sql
SELECT remove_domain_summary_key(
  p_user_id  := 'firebase-uid',
  p_domain   := 'financial',
  p_key      := 'total_value'
);
```

---

## Sanitization Rules

`world_model_index_v2.domain_summaries` must never contain sensitive financial data. The following fields are stripped before writing:

| Stripped Field   | Reason                               |
| ---------------- | ------------------------------------ |
| `holdings`       | Individual stock positions           |
| `total_value`    | Portfolio dollar amounts             |
| `vault_key`      | Encryption key material              |
| `password`       | Authentication credentials           |

The `WorldModelService.update_domain_summary()` method enforces this sanitization server-side before any `world_model_index_v2` write.

---

## domain_registry

Tracks all available data domains in the system.

| Column         | Type     | Description                |
| -------------- | -------- | -------------------------- |
| `domain_key`   | `TEXT PK`| e.g., `financial`, `food`  |
| `display_name` | `TEXT`   | Human-readable name        |
| `description`  | `TEXT`   | Domain description         |
| `icon_name`    | `TEXT`   | UI icon identifier         |
| `color_hex`    | `TEXT`   | Brand color                |
| `parent_domain`| `TEXT`   | For hierarchical domains   |

Seeded domains: `financial`, `food`, `professional`, `health`, `kai_decisions`.

New domains auto-register when first stored via `WorldModelService`.

---

## See Also

- [Agent Development](./agent-development.md) -- How agents access world model data
- [Consent Protocol](./consent-protocol.md) -- Token lifecycle and validation
- [Kai Agents](./kai-agents.md) -- Multi-agent financial analysis system
- [Environment Variables](./env-vars.md) -- Backend configuration reference
