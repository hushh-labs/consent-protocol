# Project Context Map (Canonical)

> **Purpose**: A single “source of truth” for how this repo is organized, what is **immutable** (consent protocol invariants), and how to build features without breaking **Capacitor iOS/Android**.
>
> **Read first**: `docs/technical/architecture.md`, `docs/technical/consent-implementation.md`, `docs/technical/mobile.md`, `docs/technical/mcp-integration.md`

---

## Repo Topology (What Lives Where)

- **`consent-protocol/`**: **Python FastAPI backend + MCP server + protocol core**
  - Treat the **protocol core** (`consent-protocol/hushh_mcp/**`) as **read-only** unless explicitly working on **agents/operons/MCP/API** changes.
- **`hushh-webapp/`**: **Next.js App Router + Capacitor (iOS/Android)**
  - Web can run Next.js server routes.
  - Native (Capacitor) is **static export in a WebView** → **no Next.js `/api` server at runtime**.

---

## Non‑Negotiable Security & Consent Invariants

### BYOK / Zero‑Knowledge (Cloud Storage is Always Encrypted)

- **Vault keys never belong to the server**.
- The backend stores **ciphertext only**; the user’s key stays client-side.
- In the web app, decrypted keys are **memory-only** (React state), not persisted (`hushh-webapp/lib/vault/vault-context.tsx`).

### “Implicit Consent” Internally ≠ No Consent Mechanism

Internally, the user is “the owner”, but the system still enforces a **consent-first gate** using a **VAULT_OWNER token** (no bypass paths).

- **Vault owner access is still token-gated**, via **`vault.owner`** scope.
- Token validation supports a **hierarchical master scope**:
  - `vault.owner` satisfies other scopes in `validate_token()` (`consent-protocol/hushh_mcp/consent/token.py`).

### Scopes Are For External/Delegated Access

- Third-party agents (MCP hosts, external developers, agent-to-agent delegation) require explicit consent:
  - **Consent tokens** (scoped, time-limited)
  - **TrustLinks** for A2A delegation (signed, time-limited)

---

## The 3 Consent Surfaces (Know Which One You’re Touching)

### 1) Vault Owner Session (User → their own vault)

- **VAULT_OWNER token** issued after vault unlock (passphrase verified client-side).
- Backend endpoint (FastAPI): `POST /api/consent/vault-owner-token`
  - Implemented in `consent-protocol/api/routes/consent.py`.
- Web flow issues it via Next.js route:
  - `hushh-webapp/app/api/consent/vault-owner-token/route.ts`
  - Called by `hushh-webapp/lib/services/vault-service.ts`.
- Native flow issues it via Capacitor plugin:
  - iOS: `hushh-webapp/ios/App/App/Plugins/HushhConsentPlugin.swift`
  - Android: `hushh-webapp/android/app/src/main/java/com/hushh/pda/plugins/HushhConsent/HushhConsentPlugin.kt`

### 2) External Developer API (3P app → user’s data)

- Developer requests consent → user approves in UI → token issued.
- Docs: `docs/technical/developer-api.md`
- Backend routes: `consent-protocol/api/routes/developer.py` + `consent-protocol/api/routes/consent.py`

### 3) MCP Zero‑Knowledge Export (Claude Desktop / Cursor / etc.)

- External MCP host requests consent → UI approves → browser **re-encrypts** with an export key → server stores export ciphertext only.
- Docs: `docs/technical/mcp-integration.md`
- Backend export storage + retrieval:
  - `POST /api/consent/pending/approve` stores encrypted export in memory (`_consent_exports`)
  - `GET /api/consent/data?consent_token=...` returns encrypted export + export key
  - Implemented in `consent-protocol/api/routes/consent.py`
- MCP server entrypoint: `consent-protocol/mcp_server.py` (handlers in `consent-protocol/mcp_modules/tools/*`)

---

## Runtime Architecture (Web vs Native)

### Web (Next.js server available)

- Calls Next.js `app/api/*` routes.
- Next.js routes typically proxy to the Python backend and/or coordinate UI-specific behaviors.
- Existing web API routes live under: `hushh-webapp/app/api/**/route.ts`

### Native (Capacitor static export; no Next.js server)

**Rule**: any feature that uses `/app/api/*` must have a **native plugin path** (or it won’t work on iOS/Android).

Authoritative guideline: `docs/technical/mobile.md` (“Critical: API Routes Require Native Plugins”).

Native plugin registration:

- iOS: `hushh-webapp/ios/App/App/MyViewController.swift`
- Android: `hushh-webapp/android/app/src/main/java/com/hushh/pda/MainActivity.kt`

Platform-aware routing is centralized in:

- `hushh-webapp/lib/services/api-service.ts`
- `hushh-webapp/lib/services/vault-service.ts`
- Capacitor interfaces: `hushh-webapp/lib/capacitor/index.ts`

---

## Canonical “Where Do I Implement X?” Guide

### Add/Change a backend endpoint (protocol-safe)

- Add/modify a FastAPI route in `consent-protocol/api/routes/*`
- Register router in `consent-protocol/server.py`
- If it will be called from mobile, **design it to be callable from plugins** (simple JSON payloads, stable URL).

### Add a new MCP tool (external agent access)

- Add tool definition + handler in `consent-protocol/mcp_modules/tools/*`
- Ensure handler enforces consent scopes and uses the **zero-knowledge export** model when returning user data.

### Add a new Agent / Operon (inside the protocol layer)

- Agents: `consent-protocol/hushh_mcp/agents/**`
- Operons: `consent-protocol/hushh_mcp/operons/**`
- Required behaviors:
  - Validate tokens (and scopes) before touching any vault data
  - Prefer reuse of operons to keep agents small and testable

### Add a new UI feature that needs “API”

Follow the **Capacitor-safe 5-step workflow**:

1. **Web**: implement Next.js route in `hushh-webapp/app/api/.../route.ts`
2. **TS interface**: add method types to `hushh-webapp/lib/capacitor/index.ts`
3. **Android**: implement Kotlin method in `hushh-webapp/android/app/src/main/java/com/hushh/pda/plugins/**`
4. **iOS**: implement Swift method in `hushh-webapp/ios/App/App/Plugins/**`
5. **Routing**: add a platform-aware method in `hushh-webapp/lib/services/api-service.ts`

---

## Important Legacy / Compatibility Notes

### `/db/*` routes are deprecated (and partially insecure)

- `consent-protocol/api/routes/db_proxy.py` explicitly warns:
  - `/db/food/get` and `/db/professional/get` lack authentication and bypass consent-first architecture.
- **Do not add new features** on `/db/*`.
- Prefer the modular, token-gated routes:
  - Food: `POST /api/food/preferences` (VAULT_OWNER token required) in `consent-protocol/api/routes/food.py`
  - Professional: `POST /api/professional/preferences` (VAULT_OWNER token required) in `consent-protocol/api/routes/professional.py`

> If mobile still calls `/db/*` for some reads, treat it as backward compatibility only; new work should use `/api/*` + VAULT_OWNER tokens.

---

## Quick Pointers (High Signal Files)

### Protocol / Backend

- **FastAPI app**: `consent-protocol/server.py`
- **Consent routes**: `consent-protocol/api/routes/consent.py`
- **Token crypto + hierarchical scope**: `consent-protocol/hushh_mcp/consent/token.py`
- **MCP server**: `consent-protocol/mcp_server.py`

### Web / Mobile

- **Platform routing**: `hushh-webapp/lib/services/api-service.ts`
- **Vault owner issuance + vault ops**: `hushh-webapp/lib/services/vault-service.ts`
- **Memory-only vault key + VAULT_OWNER token**: `hushh-webapp/lib/vault/vault-context.tsx`
- **Capacitor plugin interfaces**: `hushh-webapp/lib/capacitor/index.ts`
- **Native consent plugins**:
  - iOS: `hushh-webapp/ios/App/App/Plugins/HushhConsentPlugin.swift`
  - Android: `hushh-webapp/android/app/src/main/java/com/hushh/pda/plugins/HushhConsent/HushhConsentPlugin.kt`

---

## Working Agreement (for future changes)

- **Never** persist the vault key (BYOK).
- **Never** add auth/consent bypasses “because it’s the user”.
- **Always** keep web + iOS + Android feature parity for anything user-facing:
  - If it uses `/app/api/*`, it must also have a **Capacitor plugin** path.
- Prefer `/api/*` token-gated routes; treat `/db/*` as legacy only.

