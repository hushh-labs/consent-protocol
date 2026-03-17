# Developer API

> **Status:** UAT public beta  
> **Audience:** External developers, MCP hosts, and internal teams building against Kai consent flows

---

## Overview

The Hushh developer contract is versioned under `/api/v1` and built around one scalable rule:

1. Discover the user's scopes at runtime.
2. Request consent for one discovered scope.
3. Wait for the user's approval in Kai.
4. Read only the approved slice with `get_scoped_data`.

Do not hardcode domain keys. Dynamic scopes are derived from the indexed world model and domain registry.

---

## Self-Serve Developer Access

Developer access is self-serve from `/developers` in the app:

- Sign in with the same Google or Apple auth flow used in Kai.
- Enable developer access once per Kai account.
- Receive one active developer token, revealed only when first issued or rotated.
- Update the app identity users see during consent review.

Portal endpoints:

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/developer/access` | Firebase bearer token | Read the current developer workspace state |
| `POST` | `/api/developer/access/enable` | Firebase bearer token | Create the self-serve app and first active token |
| `PATCH` | `/api/developer/access/profile` | Firebase bearer token | Update display name, website, support, and policy links |
| `POST` | `/api/developer/access/rotate-key` | Firebase bearer token | Revoke the current token and issue a replacement |

The developer token is then used as:

```http
GET /api/v1/user-scopes/{user_id}?token=<developer-token>
```

---

## Public Endpoints

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/v1` | Developer API enabled | Root summary for the versioned contract |
| `GET` | `/api/v1/list-scopes` | Developer API enabled | Canonical dynamic scope grammar |
| `GET` | `/api/v1/tool-catalog` | Optional `?token=...` | Current public-beta tool visibility |
| `GET` | `/api/v1/user-scopes/{user_id}` | `?token=<developer-token>` | Per-user discovered domains and scopes |
| `GET` | `/api/v1/consent-status` | `?token=<developer-token>` | App-scoped consent status by scope or request id |
| `POST` | `/api/v1/request-consent` | `?token=<developer-token>` | Create or reuse consent for one discovered scope |

---

## Scope Model

Requestable developer scopes:

- `world_model.read`
- `world_model.write`
- `attr.{domain}.*`
- `attr.{domain}.{subintent}.*`
- `attr.{domain}.{path}`

Availability is derived from:

- `world_model_index_v2.available_domains`
- `world_model_index_v2.domain_summaries`
- `domain_registry`

Two users can legitimately expose different scope catalogs.

---

## Request Flow

### 1. Discover user scopes

```http
GET /api/v1/user-scopes/{user_id}
?token=<developer-token>
```

### 2. Request consent

```http
POST /api/v1/request-consent
?token=<developer-token>
Content-Type: application/json

{
  "user_id": "user_123",
  "scope": "attr.financial.*",
  "expiry_hours": 24,
  "reason": "Explain why the app needs this scope"
}
```

### 3. Poll status

```http
GET /api/v1/consent-status?user_id=user_123&scope=attr.financial.*
?token=<developer-token>
```

### 4. Wait for approval in Kai

The user approves in the Kai app. Approval is separate from developer auth and remains app-scoped plus scope-scoped.

### 5. Consume scoped data

For MCP integrations, prefer `get_scoped_data`.

---

## Developer MCP Surface

The public beta machine flow is:

1. `discover_user_domains(user_id)`
2. `request_consent(user_id, discovered_scope)`
3. `check_consent_status(user_id, discovered_scope)`
4. `get_scoped_data(user_id, consent_token)`

Machine-readable references:

- `hushh://info/connector`
- `hushh://info/developer-api`

---

## Scale Guidance

- Discover scopes per user and treat them as mutable runtime state.
- The app identity shown to users comes from the self-serve developer workspace, not a caller-supplied agent id.
- Prefer one generic scoped data path over named domain-specific getters.
- Keep request volume bounded after denials; cooldown behavior may apply to repeated re-requests.
