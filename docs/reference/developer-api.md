# Developer API

> **Status**: Active  
> **Audience**: External developers, MCP hosts, and internal integrations publishing against Hushh dynamic scopes

---

## Overview

The Hushh developer integration surface is versioned under `/api/v1` and is designed around dynamic scope discovery.

The key rule is simple:

1. Discover the user's scopes at runtime.
2. Request consent for one discovered scope.
3. Wait for user approval.
4. Use the approved token with `get_scoped_data` in MCP or with the consent export APIs.

Do not hardcode domain keys into developer integrations.

---

## Endpoints

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/v1/list-scopes` | Developer API enabled | Generic scope catalog and canonical patterns |
| `GET` | `/api/v1/user-scopes/{user_id}` | `X-MCP-Developer-Token` | Per-user discovered domains and scopes |
| `POST` | `/api/v1/request-consent` | `developer_token` body field or `X-MCP-Developer-Token` | Create or reuse consent for one discovered scope |

---

## Scope Model

Requestable developer scopes:

- `world_model.read`
- `world_model.write`
- `attr.{domain}.*`
- `attr.{domain}.{subintent}.*`
- `attr.{domain}.{path}`

Scope availability is derived from:

- `world_model_index_v2.available_domains`
- `world_model_index_v2.domain_summaries`
- `domain_registry`

This means two users can legitimately expose different scope catalogs.

---

## Request Flow

### 1. Discover user scopes

```http
GET /api/v1/user-scopes/{user_id}
X-MCP-Developer-Token: <token>
```

### 2. Request consent

```http
POST /api/v1/request-consent
Content-Type: application/json

{
  "user_id": "user_123",
  "developer_token": "<token>",
  "agent_id": "partner-app",
  "scope": "attr.{domain}.*",
  "expiry_hours": 24,
  "reason": "Explain why the app needs this scope"
}
```

### 3. Wait for approval

The user approves in the Hushh app. Delivery is FCM-first in production.

### 4. Consume scoped data

For MCP integrations, prefer `get_scoped_data`.

---

## Developer MCP Surface

For agent hosts and MCP clients, the supported machine-consumable flow is:

1. `discover_user_domains(user_id)`
2. `request_consent(user_id, discovered_scope)`
3. `check_consent_status(user_id, discovered_scope)`
4. `get_scoped_data(user_id, consent_token)`

Machine-readable references are published as:

- `hushh://info/connector`
- `hushh://info/developer-api`

---

## Scale Guidance

- Discover scopes per user and cache briefly, but treat them as mutable runtime state.
- Use a stable `agent_id` per developer app or MCP deployment.
- Prefer one generic scoped data path over named domain-specific getters.
- Keep request volume bounded after denials; the platform may apply cooldown behavior to repeated re-requests.

---

## Compatibility Policy

Legacy named MCP getters such as `get_food_preferences` and `get_professional_profile` remain compatibility surfaces only. New integrations should use `get_scoped_data` plus discovered scopes.
