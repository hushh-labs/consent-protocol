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
attr.{domain}.{subintent}.*  # Optional subintent subtree
attr.{domain}.{path}         # Specific nested path
vault.owner                  # Full vault access (owner only)
```

### How It Works

1. `DynamicScopeGenerator` reads `world_model_index_v2.available_domains`
2. It enriches optional subintent hints from `domain_summaries` (`intent_map`, `sub_intents`, etc.) and `domain_registry` metadata
3. It generates domain and subintent wildcard scopes (`attr.{domain}.*`, `attr.{domain}.{subintent}.*`)
4. MCP agent requests consent for a discovered scope
5. User approves/denies in the consent UI

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

Runtime world-model code supports optional RPC accelerators, but always keeps fallback read/write paths when functions are missing.

### Core helper functions used by application code

| Function | Purpose |
| --- | --- |
| `get_user_world_model_metadata(p_user_id text)` | Preferred metadata read helper |
| `update_world_model_data_timestamp()` | Timestamp maintenance helper |
| `consent_audit_notify()` | Consent-audit trigger helper |

### Optional legacy/migration functions

Functions such as `merge_domain_summary` and `remove_domain_summary_key` may exist in some environments/migrations, but must not be treated as mandatory runtime dependencies.

---

## Sanitization Rules

`world_model_index_v2.domain_summaries` must never contain sensitive financial data. The following fields are stripped before writing:

| Stripped Field   | Reason                               |
| ---------------- | ------------------------------------ |
| `holdings`       | Individual stock positions           |
| `total_value`    | Raw portfolio dollar amount key is stripped from index summaries (mapped to `portfolio_total_value` when numeric) |
| `vault_key`      | Encryption key material              |
| `password`       | Authentication credentials           |

The `WorldModelService.update_domain_summary()` method enforces this sanitization server-side before any `world_model_index_v2` write.

## Summary Field Contract

Domain summaries use a canonical counter contract so backend context assembly never depends on stripped fields:

| Field | Rule |
| --- | --- |
| `attribute_count` | Canonical authoritative count for the domain |
| `item_count` | Mirrors `attribute_count` for compatibility |
| `holdings_count` | Mirrors canonical count for financial/portfolio-like summaries |
| `portfolio_total_value` | Optional aggregated portfolio value for UI hero cards (non-holdings scalar) |

Normalization is applied on store/update and reconciliation paths. Count extraction order in consumers:
`attribute_count -> holdings_count -> item_count`.

---

## Kai Financial V2 Canonical Shape

Kai runtime stores canonical portfolio data only under the `financial` top-level domain:

- `financial.portfolio` = canonical app-consumed portfolio payload (V2)
- `financial.analytics` = materialized analytics for dashboard/debate/optimize (V2)
- `financial.documents.statements[]` snapshots may contain:
  - `raw_extract_v2`
  - `canonical_v2`
  - `analytics_v2`

Cash-equivalent positions remain part of totals/allocation but are excluded from investable optimize/debate eligibility.

### Migration Utility

Use `consent-protocol/scripts/migrate_financial_v2.py` to align existing users:

- default mode: index-only summary migration
- deep mode: user-scoped decrypt/re-encrypt migration with `--user-id` and `--passphrase`

## Domain Determination Rules

To keep registry/index coherence:

1. Domain key is normalized to lowercase canonical top-level keys (for example `financial`, `food`, `professional`).
2. Every domain store/update auto-registers the domain in `domain_registry`.
3. `available_domains` is reconciled with `domain_summaries` keys.
4. `total_attributes` is recomputed from canonical domain counters.
5. Reconciliation helper (`reconcile_user_index_domains`) is callable at runtime for drift repair.

## Cache Alignment (Web Runtime)

Frontend memory cache keys aligned to world-model blobs and summaries:

- `world_model_metadata_${userId}`
- `world_model_blob_${userId}`
- `domain_blob_${userId}_${domain}`

Compatibility notes:
- Domain summary patches must keep canonical counters coherent.
- Sanitized scalar `portfolio_total_value` is the compatible summary value for portfolio hero contexts.
- CRUD flows should prefer write-through when ciphertext and summary data are already available.

## Operational Reconciliation

Use runtime reconciliation/audit tools for drift repair and verification:

```bash
node scripts/ops/audit-world-model-user.mjs --userId <uid> --passphrase '<passphrase>'
python scripts/ops/reconcile_financial_domain.py --user-id <uid> --passphrase '<passphrase>'
```

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

Seeded domains: `financial`, `subscriptions`, `health`, `travel`, `food`, `professional`, `entertainment`, `shopping`, `social`, `location`, `general`.

New domains auto-register when first stored via `WorldModelService`.

---

## Related Runtime Tables (Non-World-Model)

These tables are used by adjacent Kai/runtime subsystems and are fact-checked in the runtime DB snapshot:

| Table | Purpose |
| --- | --- |
| `kai_market_cache_entries` | Server-side cached market payloads for Kai views |
| `tickers` | Ticker master/enrichment metadata used by market and picks flows |

---

## See Also

- [Agent Development](./agent-development.md) -- How agents access world model data
- [Consent Protocol](./consent-protocol.md) -- Token lifecycle and validation
- [Kai Agents](./kai-agents.md) -- Multi-agent financial analysis system
- [Environment Variables](./env-vars.md) -- Backend configuration reference
