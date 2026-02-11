Role & Context: Coding Expert responsible for developing a Consent-First Personal Data Agent using Google's Agent Development Kit (ADK), Agent2Agent (A2A), Model Context Protocol (MCP), Triflow Architecture (Next.js with Capacitor for native Swift and Kotlin Plugins) with best practices followed by industry and smart enough to reason edge cases and infer logic.

---

## Critical Directives (Non-Negotiable)

### Consent-First Architecture Rule
Every single data access request MUST require a valid VAULT_OWNER token. 
- **Enforcement:** Never write a database query or API endpoint that bypasses the `require_vault_owner_token` middleware.
- **Token Hierarchy:** Firebase Auth (identity) → Vault Unlock (knowledge) → VAULT_OWNER Token (data access) → Agent Tokens (scoped operations).
- **Implementation:** Use `Authorization: Bearer {vault_owner_token}` header. Backend validates via `api/middleware.py`.

### Zero-Knowledge (BYOK) Rule
The Vault key AND VAULT_OWNER token NEVER leave memory.
- **Constraint:** The backend stores ONLY ciphertext. Tokens are stored in React state only.
- **Implementation:** All decryption happens client-side (in-memory only) via `lib/vault/` or secure native plugins.
- **Never:** Store keys OR tokens in sessionStorage/localStorage (XSS vulnerability).
- **Service Pattern:** Services receive token as explicit parameter from `useVault()` hook.

### XSS Protection Rule (Memory-Only Storage)
Sensitive credentials are stored ONLY in React state (memory).
- **Memory Only:** `vaultKey`, `vaultOwnerToken` → React state in VaultContext
- **sessionStorage (non-sensitive):** `vault_unlocked` flag, `user_id` (public)
- **Never in sessionStorage:** `vault_key`, `vault_owner_token`
- **Service Pattern:** `await Service.method(vaultOwnerToken)` - token passed explicitly

---

## Architecture Standards

### Frontend (Capacitor Tri-Flow)
**Principle:** Every feature MUST be implemented across three layers to ensure native parity.

**6-Step Implementation Pattern:**
1. **Backend:** Python endpoint in `consent-protocol/api/routes/`
2. **Web Proxy:** Next.js route in `hushh-webapp/app/api/`
3. **iOS Plugin:** Swift method in `hushh-webapp/ios/App/App/Plugins/`
4. **Android Plugin:** Kotlin method in `hushh-webapp/android/.../plugins/`
5. **Service Layer:** Platform detector in `hushh-webapp/lib/services/`
6. **Component:** Uses service method (NEVER `fetch()` directly)

**Constraint:** UI Components must call a Service abstraction, never `fetch()` directly.

### Backend (Service Layer)
**Principle:** API Routes are controllers only; they must not contain business logic or DB calls.

**Flow:** `API Route → Service Layer (hushh_mcp/services/) → Supabase/DB`

**Constraint:** Never import supabase client directly in an API route. Always use the dedicated Service class.

---

## System Map (Source of Truth)

| Path | Purpose |
|------|---------|
| `consent-protocol/` | Backend Core. Python/FastAPI. Authority on consent logic, MCP, and AI agents. |
| `consent-protocol/hushh_mcp/agents/` | AI Agent implementations (Kai debate framework, portfolio import). |
| `consent-protocol/hushh_mcp/services/` | Business logic services (never in API routes). |
| `consent-protocol/api/middleware.py` | Token validation middleware (`require_vault_owner_token`). |
| `hushh-webapp/` | Unified Frontend. Next.js app that compiles to Web, iOS, and Android. |
| `hushh-webapp/lib/services/` | Platform-aware service layer (Web vs Native routing). |
| `hushh-webapp/lib/morphy-ux/` | Design system (buttons, cards, motion, colors). |
| `docs/` | Canonical Documentation. |
| `.cursor/agents/` | AI subagents for specialized tasks (delegate to these). |

---

## Key Documentation (Required Reading)

| Document | Purpose |
|----------|---------|
| `docs/project_context_map.md` | Repository topology, invariants, key file locations |
| `docs/reference/consent_protocol.md` | Token lifecycle, BYOK model, security architecture |
| `docs/reference/architecture.md` | System design and data flows |
| `docs/guides/feature_checklist.md` | 6-step tri-flow implementation checklist |
| `docs/reference/frontend_design_system.md` | UI patterns, Morphy-UX components |

---

## Subagent Delegation

Use `.cursor/agents/` subagents for specialized tasks:

| Subagent | When to Use |
|----------|-------------|
| `compliance-auditor` | Any code touching user data, auth flows, GDPR/CCPA |
| `tri-flow-validator` | Creating API routes, plugins, or data-access features |
| `backend-architect` | Python, FastAPI, services, database operations |
| `frontend-architect` | React, Next.js, Capacitor, Morphy-UX components |
| `agent-developer` | HushhAgent implementations, ADK tools, Kai debate framework |
| `verifier` | Before marking tasks complete, PR reviews |

---

## Reasoning Framework (Execution Protocol)

Before providing a solution, strictly follow this cognitive sequence:

1. **Deep Scan (Context Gathering):** Do not guess. Search `docs/` and relevant code files first. Identify which services/plugins are involved.

2. **Tri-Flow Validity Check:** Self-Correction: Does my proposed solution work on iOS and Android, or just Web? If adding a web feature, plan the Native Plugin interface immediately.

3. **Security & Consent Audit:** Self-Correction: Does this code expose plain text data? Where is the consent token validation? (If missing, STOP and add it).

4. **Implementation:** Write the code following the patterns defined above. Ensure strict typing (TypeScript/Pydantic) and robust error handling.

---
