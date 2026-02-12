# API Contracts

> Complete endpoint reference, authentication model, and developer integration guide.

---

## Token Hierarchy

All data access is gated by consent tokens. Firebase auth is only used to bootstrap the initial VAULT_OWNER token.

```
Firebase Sign-In
      │
      ▼
POST /api/consent/vault-owner-token  (Firebase Bearer)
      │
      ▼
  VAULT_OWNER Token (24h)
      │
      ├── All vault/data operations
      ├── Agent operations
      └── Can delegate scoped tokens to MCP agents (7d)
```

| Token Type            | Purpose                          | Duration | Auth Header Format              |
| --------------------- | -------------------------------- | -------- | ------------------------------- |
| Firebase ID Token     | Identity verification only       | 1 hour   | `Bearer <firebase-id-token>`   |
| VAULT_OWNER Token     | Consent + identity for all data  | 24 hours | `Bearer <vault-owner-token>`   |
| Agent Scoped Token    | Delegated MCP agent access       | 7 days   | `Bearer <consent-token>`       |
| Developer Token       | External API access              | N/A      | In request body                 |

---

## Route Categories

### Public (No Auth)

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Detailed health check with agent list |
| GET | `/api/kai/health` | Kai subsystem health |
| GET | `/api/v1` | Developer API root |
| GET | `/api/v1/list-scopes` | List all available consent scopes |
| GET | `/api/investors/search?q={name}` | Fuzzy search investors by name |
| GET | `/api/investors/{investor_id}` | Full investor profile by ID |
| GET | `/api/investors/cik/{cik}` | Investor profile by SEC CIK |
| GET | `/api/investors/stats` | Investor database statistics |
| POST | `/api/validate-token` | Validate a consent token |

### Firebase Auth (Bootstrap)

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/consent/vault-owner-token` | Issue VAULT_OWNER token |
| POST | `/api/notifications/register` | Register FCM push token |
| DELETE | `/api/notifications/unregister` | Unregister FCM tokens (logout) |
| GET | `/api/identity/auto-detect` | Auto-detect investor from Firebase name |
| POST | `/api/kai/consent/grant` | Grant consent for Kai scopes |

### VAULT_OWNER (Consent-Gated)

#### Consent Management

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/consent/pending` | List pending consent requests |
| POST | `/api/consent/pending/approve` | Approve consent (zero-knowledge export) |
| POST | `/api/consent/pending/deny` | Deny consent request |
| POST | `/api/consent/cancel` | Cancel pending request |
| POST | `/api/consent/revoke` | Revoke active consent |
| GET | `/api/consent/history` | Paginated consent audit history |
| GET | `/api/consent/active` | Active (non-expired) tokens |

#### World Model

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/world-model/store-domain` | Store encrypted domain data + update index |
| GET | `/api/world-model/data/{user_id}` | Get full encrypted data blob |
| GET | `/api/world-model/domain-data/{user_id}/{domain}` | Get encrypted domain data |
| DELETE | `/api/world-model/domain-data/{user_id}/{domain}` | Delete a domain |
| GET | `/api/world-model/metadata/{user_id}` | Get world model metadata for UI |
| GET | `/api/world-model/scopes/{user_id}` | Get available scopes for user |
| POST | `/api/world-model/get-context` | Get user context for analysis |

#### Kai Chat

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/kai/chat` | Conversational Kai endpoint |
| GET | `/api/kai/chat/history/{conversation_id}` | Conversation history |
| GET | `/api/kai/chat/conversations/{user_id}` | List all conversations |
| GET | `/api/kai/chat/initial-state/{user_id}` | Initial chat state |
| POST | `/api/kai/chat/analyze-loser` | Analyze a specific loser |

#### Kai Portfolio

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/kai/portfolio/import` | Import brokerage statement (CSV/PDF) |
| POST | `/api/kai/portfolio/import/stream` | Streaming import with Gemini progress |
| GET | `/api/kai/portfolio/summary/{user_id}` | Portfolio summary from world model |
| POST | `/api/kai/portfolio/analyze-losers` | Analyze losers vs Renaissance |
| POST | `/api/kai/portfolio/analyze-losers/stream` | Streaming losers analysis (SSE) |

#### Kai Analysis

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/kai/analyze` | 3-agent investment analysis |
| GET | `/api/kai/analyze/stream` | SSE streaming debate analysis |
| POST | `/api/kai/analyze/stream` | SSE streaming with context body |
| POST | `/api/analysis/analyze` | Deep fundamental analysis |

#### Kai Decisions

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/kai/decisions/{user_id}` | Decision history from domain summaries |

#### Kai Preferences

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/kai/preferences/store` | Store user preferences |
| GET | `/api/kai/preferences/{user_id}` | Retrieve user preferences |
| DELETE | `/api/kai/preferences/{user_id}` | Delete Kai preferences |

#### Account & Sync

| Method | Path | Description |
| ------ | ---- | ----------- |
| DELETE | `/api/account/delete` | Delete user account and all data |
| POST | `/api/sync/vault` | Trigger vault sync |
| POST | `/api/sync/batch` | Push batch of offline changes |
| GET | `/api/sync/pull` | Pull changes since timestamp |

### Consent Token (MCP Data Access)

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/consent/data?token={consent_token}` | Retrieve encrypted export for token |

### SSE (Server-Sent Events)

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/consent/events/{user_id}` | Real-time consent notifications |
| GET | `/api/consent/events/{user_id}/poll/{request_id}` | Poll specific consent request |

### Deprecated (410 Gone)

| Method | Path | Replacement |
| ------ | ---- | ----------- |
| POST | `/api/v1/food-data` | `GET /api/world-model/domain-data/{uid}/food` |
| POST | `/api/v1/professional-data` | `GET /api/world-model/domain-data/{uid}/professional` |
| DELETE | `/api/world-model/attributes/{uid}/{domain}/{key}` | Client-side BYOK operation |
| POST | `/api/kai/decision/store` | `POST /api/world-model/store-domain` with domain=`kai_decisions` |
| GET | `/api/kai/decision/{id}` | `GET /api/kai/decisions/{user_id}` |
| DELETE | `/api/kai/decision/{id}` | `POST /api/world-model/store-domain` with domain=`kai_decisions` |

---

## External Developer API

### Consent Flow

External developers (MCP agents, third-party apps) use the `/api/v1` endpoints:

```
1. POST /api/v1/request-consent
   Body: { user_id, scope, agent_id, developer_token, description }
   → Returns: { request_id, status: "pending" }

2. User receives FCM notification → approves in app

3. POST /api/validate-token
   Body: { token: "<consent-token>" }
   → Returns: { valid, user_id, scope, expires_at }

4. GET /api/consent/data?token=<consent-token>
   → Returns: { ciphertext, iv, tag, export_key }
   → Developer decrypts with export_key
```

### Available Scopes

```
attr.financial.*      # Financial data (portfolio, preferences)
attr.food.*           # Food & dining preferences
attr.professional.*   # Professional profile
attr.health.*         # Health & wellness data
attr.kai_decisions.*  # Kai analysis decisions
vault.owner           # Full vault access (owner only)
```

### Token Format

```
HCT:<base64(user_id|agent_id|scope|issued_at|expires_at)>.<hmac_sha256_signature>
```

### Error Responses

| Status | Meaning | Action |
| ------ | ------- | ------ |
| 401 | Missing or invalid token | Re-authenticate or re-request consent |
| 403 | Insufficient scope | Request additional scopes |
| 404 | Resource not found | Verify user_id or resource exists |
| 410 | Endpoint deprecated | Use the replacement endpoint |
| 429 | Rate limited | Back off and retry |

---

## Response Format

Backend returns **snake_case**. Frontend transforms to **camelCase** in the service layer.

```
Backend:  { "user_id": "abc", "domain_summaries": {...} }
Service:  { userId: "abc", domainSummaries: {...} }
React:    Uses camelCase throughout
```

Plugins requiring camelCase transformation: WorldModel, Kai, Identity.

---

## How to Add a New Endpoint

1. Create route function in `consent-protocol/api/routes/{module}.py`
2. Add auth dependency (`require_vault_owner_token` / `verify_firebase_bearer`)
3. Use service layer for all DB access (never direct SQL)
4. Register router in `server.py`: `app.include_router(router)`
5. Create Next.js proxy: `hushh-webapp/app/api/{path}/route.ts`
6. Create Capacitor plugin: iOS Swift + Android Kotlin
7. Add service method: `hushh-webapp/lib/services/{name}-service.ts`
8. Add route contract: `hushh-webapp/route-contracts.json`
9. Verify: `npm run verify:routes`

See [Architecture: Tri-Flow](./architecture.md#tri-flow-architecture) for the full pattern.

---

## See Also

- [Architecture](./architecture.md) -- System overview and tri-flow
- [World Model](../../consent-protocol/docs/reference/world-model.md) -- Data storage endpoints
- [Consent Protocol](../../consent-protocol/docs/reference/consent-protocol.md) -- Token lifecycle
