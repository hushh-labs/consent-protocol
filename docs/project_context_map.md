# Project Context Map

> **Purpose**: Single source of truth for repo organization, immutable invariants, and Capacitor tri-flow architecture.
>
> **Read first**: `docs/reference/architecture.md`, `docs/reference/consent_protocol.md`

---

## Contact Information

- **Engineering**: eng@hush1one.com
- **Support**: eng@hush1one.com
- **GitHub**: https://github.com/hushh-labs/hushh-research

## Quick Start

### Development Servers

```bash
# Terminal 1: Python Backend (port 8000)
cd consent-protocol
source .venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Next.js Frontend (port 3000)
cd hushh-webapp
npm run dev
```

| Server | URL | Health Check |
|--------|-----|--------------|
| **Backend** | http://localhost:8000 | `curl http://localhost:8000/health` |
| **Frontend** | http://localhost:3000 | Open in browser |

### Environment Files

- Backend: `consent-protocol/.env` (DB_* per .env.example, GOOGLE_API_KEY)
- Frontend: `hushh-webapp/.env.local` (NEXT_PUBLIC_BACKEND_URL, Firebase config)

---

## Repo Topology

| Directory | Purpose |
|-----------|---------|
| `consent-protocol/` | Python FastAPI backend + MCP server + protocol core |
| `hushh-webapp/` | Next.js App Router + Capacitor (iOS/Android) |

**Critical**: Native (Capacitor) is a static export in a WebView → **no Next.js `/api` server at runtime**.

---

## Non-Negotiable Invariants

### 1. BYOK / Zero-Knowledge

- Vault keys **never** belong to the server
- Backend stores **ciphertext only**
- Decrypted keys are **memory-only** (React state)

### 2. Consent-First Architecture

**All consent-gated operations use VAULT_OWNER token** - no bypasses.

| Route Category | Auth Type | Example |
|----------------|-----------|---------|
| **Public** | None | `/health`, `/api/investors/*` |
| **Bootstrap** | Firebase | `/api/consent/vault-owner-token` |
| **Consent-Gated** | VAULT_OWNER | ALL `/kai/*`, `/api/world-model/*` |

### Consent Endpoint Auth Patterns

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/consent/vault-owner-token` | Firebase Bearer | Bootstrap - get VAULT_OWNER token |
| `/api/consent/pending` | VAULT_OWNER | List pending requests |
| `/api/consent/pending/approve` | VAULT_OWNER | Approve consent |
| `/api/consent/pending/deny` | VAULT_OWNER | Deny consent |
| `/api/consent/cancel` | VAULT_OWNER | Cancel pending |
| `/api/consent/revoke` | VAULT_OWNER | Revoke active consent |
| `/api/consent/data` | Consent Token | MCP data retrieval |

**Key Principle**: Only `/vault-owner-token` uses Firebase auth (to bootstrap). All other consent operations require the VAULT_OWNER token.

**Full documentation**: `docs/reference/consent_protocol.md`

### 3. Tri-Flow Architecture

Every feature must work on Web, iOS, and Android:

```
Component → Service → [Web: Next.js Proxy | Native: Capacitor Plugin] → Backend
```

---

## Critical Rules

### Rule 1: No Direct Fetch in Components

```typescript
// ❌ BANNED
fetch("/api/...")

// ✅ REQUIRED
ApiService.method()
```

**Rationale**: Native platforms have no Next.js server.

### Rule 2: Every API Route Needs Native Plugin (7-Step Process)

When creating `app/api/{feature}/route.ts`, ALL must exist:

1. ✅ Next.js route: `app/api/{feature}/route.ts`
2. ✅ iOS plugin: `ios/App/App/Plugins/{Feature}Plugin.swift`
3. ✅ Android plugin: `android/.../plugins/{Feature}/{Feature}Plugin.kt`
4. ✅ Service: `lib/services/{feature}-service.ts`
5. ✅ Interface: `lib/capacitor/{feature}.ts`
6. ✅ **Plugin Registration**: Register iOS plugin in `ios/App/App/MyViewController.swift` and Android plugin in `android/.../MainActivity.kt`
7. ✅ **Update route-contracts.json** (`hushh-webapp/route-contracts.json`) - Add contract entry with native block

If you add a new iOS Swift file and edit `project.pbxproj` manually: use **24-character hexadecimal IDs only** (0-9, A-F). Any other character causes Xcode "invalid hex digit" errors. See `docs/guides/feature_checklist.md` and `docs/guides/mobile_development.md` for details.

**If any is missing, the feature is INCOMPLETE.** Unregistered plugins will cause runtime failures when TypeScript calls them on native platforms.

**Tri-flow plugin mapping:** Every contract that has native support is declared in `hushh-webapp/route-contracts.json` with a `native` block (tsPluginFile, iosPluginFile, androidPluginFile, requiredMethodNames). Contracts with native blocks: kaiProxy (Kai), vaultWebProxy (HushhVault), vaultOwnerToken (HushhConsent), worldModelProxy (WorldModel), identityProxy (HushhIdentity), consentPendingMgmt (HushhConsent). Run `npm run verify:routes` in `hushh-webapp/` to validate.

**Optional CI:** The Tri-Flow CI workflow (`.github/workflows/ci.yml`) can run frontend-only or backend-only. On push/PR, path filters run `web-check` only when `hushh-webapp/**` changes and `protocol-check` only when `consent-protocol/**` changes. Manual run: use **Actions → Tri-Flow CI → Run workflow** and choose scope: `frontend`, `backend`, or `all`.

---

## Where to Implement

| Task | Location |
|------|----------|
| Backend endpoint | `consent-protocol/api/routes/*` |
| MCP tool | `consent-protocol/mcp_modules/tools/*` |
| Agent/Operon | `consent-protocol/hushh_mcp/agents/*` or `operons/*` |
| UI feature with API | Follow 5-step tri-flow (see Rule 2) |

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `consent-protocol/server.py` | FastAPI app |
| `consent-protocol/api/middleware.py` | Token validation (`require_vault_owner_token`) |
| `consent-protocol/hushh_mcp/consent/token.py` | Token crypto + hierarchical scope |
| `consent-protocol/api/routes/consent.py` | Consent endpoints |

### Frontend

| File | Purpose |
|------|---------|
| `hushh-webapp/lib/services/api-service.ts` | Platform routing |
| `hushh-webapp/lib/vault/vault-context.tsx` | Memory-only vault key + token |
| `hushh-webapp/lib/capacitor/*.ts` | Plugin interfaces |

### Native Plugins

| Platform | Location |
|----------|----------|
| iOS | `hushh-webapp/ios/App/App/Plugins/*.swift` |
| Android | `hushh-webapp/android/.../plugins/**/*.kt` |

---

## Dynamic Domains

### Scope Pattern

```
attr.{domain}.{attribute_key}   # Specific
attr.{domain}.*                  # All in domain
vault.owner                      # Full access
```

### Legacy → Dynamic Migration

| Legacy | Use Instead |
|--------|-------------|
| `vault.read.food` | `attr.food.*` |
| `vault.read.finance` | `attr.financial.*` |
| `vault.write.decision` | `attr.kai_decisions.*` |

### Key Services

- `DomainRegistryService` - Manages `domain_registry` table
- `DynamicScopeGenerator` - Generates `attr.{domain}.*` scopes
- `WorldModelService` - Unified user data model

---

## Working Agreement

- **Never** persist the vault key
- **Never** add auth/consent bypasses
- **Always** maintain web + iOS + Android feature parity
- **Always** use dynamic `attr.{domain}.*` scopes
- **Always** store data via `WorldModelService`

---

## See Also

- [Architecture](./reference/architecture.md) - Full system architecture
- [Consent Protocol](./reference/consent_protocol.md) - Token model and security
- [Feature Checklist](./guides/feature_checklist.md) - New feature workflow
- [Mobile Development](./guides/mobile_development.md) - Capacitor guide
