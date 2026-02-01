# Project Context Map (Canonical)

> **Purpose**: A single "source of truth" for how this repo is organized, what is **immutable** (consent protocol invariants), and how to build features without breaking **Capacitor iOS/Android**.
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
- The backend stores **ciphertext only**; the user's key stays client-side.
- In the web app, decrypted keys are **memory-only** (React state), not persisted (`hushh-webapp/lib/vault/vault-context.tsx`).

### "Implicit Consent" Internally ≠ No Consent Mechanism

Internally, the user is "the owner", but the system still enforces a **consent-first gate** using a **VAULT_OWNER token** (no bypass paths).

- **Vault owner access is still token-gated**, via **`vault.owner`** scope.
- Token validation supports a **hierarchical master scope**:
  - `vault.owner` satisfies other scopes in `validate_token()` (`consent-protocol/hushh_mcp/consent/token.py`).

### Scopes Are For External/Delegated Access

- Third-party agents (MCP hosts, external developers, agent-to-agent delegation) require explicit consent:
  - **Consent tokens** (scoped, time-limited)
  - **TrustLinks** for A2A delegation (signed, time-limited)

---

## The 3 Consent Surfaces (Know Which One You're Touching)

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

### 2) External Developer API (3P app → user's data)

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

**Rule**: any feature that uses `/app/api/*` must have a **native plugin path** (or it won't work on iOS/Android).

Authoritative guideline: `docs/technical/mobile.md` ("Critical: API Routes Require Native Plugins").

Native plugin registration:

- iOS: `hushh-webapp/ios/App/App/MyViewController.swift`
- Android: `hushh-webapp/android/app/src/main/java/com/hushh/pda/MainActivity.kt`

Platform-aware routing is centralized in:

- `hushh-webapp/lib/services/api-service.ts`
- `hushh-webapp/lib/services/vault-service.ts`
- Capacitor interfaces: `hushh-webapp/lib/capacitor/index.ts`

---

## Canonical "Where Do I Implement X?" Guide

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

### Add a new UI feature that needs "API"

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

## ⚠️ CRITICAL RULES - READ BEFORE CODING

### Rule 1: Component Network Call Ban

**Components MUST NOT use `fetch()` directly.**

```typescript
// ❌ BANNED in components:
fetch("/api/...")
axios.get("/api/...")
$.ajax(...)

// ✅ REQUIRED in components:
ApiService.method()
VaultService.method()
```

**Rationale**: Native platforms have no Next.js server. Direct API calls fail silently.

**Enforcement**:
- ESLint rule: Ban `fetch()` in `/components/**` and `/app/**/page.tsx`
- Pre-commit hook: Check for fetch violations
- AI instruction: Flag fetch() in components as CRITICAL ERROR

### Rule 2: Every Next.js API Route Needs Native Plugin

When you create `app/api/{feature}/route.ts`:

**Required checklist** (all 5 must exist):
1. ✅ Next.js route: `app/api/{feature}/route.ts` (web proxy)
2. ✅ iOS plugin: `ios/App/App/Plugins/Hushh{Feature}Plugin.swift`
3. ✅ Android plugin: `android/.../plugins/Hushh{Feature}/Hushh{Feature}Plugin.kt`
4. ✅ Service abstraction: `lib/services/{feature}-service.ts` (platform detector)
5. ✅ TypeScript interface: `lib/capacitor/index.ts` (type safety)

**If any is missing, the feature is INCOMPLETE and will break on native.**

### Rule 3: Tri-Flow Implementation Template

Every new feature that touches data follows this exact structure:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UI Component (app/ or components/)                       │
│    - Calls service method only                              │
│    - NO direct fetch() allowed                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Service Layer (lib/services/)                            │
│    - Detects platform: Capacitor.isNativePlatform()        │
│    - Web: calls Next.js proxy                               │
│    - Native: calls Capacitor plugin                         │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         │ WEB                            │ NATIVE
         ▼                                ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│ 3a. Next.js Proxy    │    │ 3b. Capacitor Plugin           │
│ (app/api/route.ts)   │    │ (iOS Swift + Android Kotlin)   │
│ - Forwards to backend│    │ - Calls backend directly       │
└──────────┬───────────┘    └──────────┬─────────────────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
           ┌────────────────────────────┐
           │ 4. Python Backend          │
           │ (consent-protocol/api/)    │
           │ - Single source of truth   │
           └────────────────────────────┘
```

**Missing any layer = broken native experience.**

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
- **Never** add auth/consent bypasses "because it's the user".
- **Always** keep web + iOS + Android feature parity for anything user-facing:
  - If it uses `/app/api/*`, it must also have a **Capacitor plugin** path.
- Prefer `/api/*` token-gated routes; treat `/db/*` as legacy only.
- **Always** use dynamic `attr.{domain}.*` scopes (NOT legacy `vault.read.*`/`vault.write.*`).
- **Always** store new data in `world_model_attributes` table via `WorldModelService`.

---

## Dynamic Consent Scopes (IMPORTANT)

### Scope Migration: Legacy to Dynamic

The codebase has migrated from legacy `vault.read.*`/`vault.write.*` scopes to dynamic `attr.{domain}.*` scopes.

**Legacy scopes (DEPRECATED - do not use in new code):**
- `vault.read.food` → Use `attr.food.*`
- `vault.read.professional` → Use `attr.professional.*`
- `vault.read.finance` → Use `attr.financial.*`
- `vault.write.decision` → Use `attr.kai_decisions.*`

**Dynamic scope pattern:**
```
attr.{domain}.{attribute_key}   # Specific attribute (e.g., attr.food.dietary_restrictions)
attr.{domain}.*                  # All attributes in domain (e.g., attr.food.*)
vault.owner                      # Full access (user's own data)
```

### Key Files for Dynamic Scopes

- **Scope Generator**: `consent-protocol/hushh_mcp/consent/scope_generator.py`
- **Domain Registry**: `consent-protocol/hushh_mcp/services/domain_registry_service.py`
- **World Model Service**: `consent-protocol/hushh_mcp/services/world_model_service.py`
- **Attribute Learner**: `consent-protocol/hushh_mcp/services/attribute_learner.py`

### World Model Tri-Flow

The World Model feature follows the tri-flow architecture:

| Layer | File |
|-------|------|
| Backend | `consent-protocol/api/routes/world_model.py` |
| Web Proxy | `hushh-webapp/app/api/world-model/[...path]/route.ts` |
| iOS Plugin | `hushh-webapp/ios/App/App/Plugins/WorldModelPlugin.swift` |
| Android Plugin | `hushh-webapp/android/.../plugins/WorldModel/WorldModelPlugin.kt` |
| Service | `hushh-webapp/lib/services/world-model-service.ts` |
| Web Fallback | `hushh-webapp/lib/capacitor/plugins/world-model-web.ts` |
| Plugin Interface | `hushh-webapp/lib/capacitor/world-model.ts` |

---

## Dynamic Domain Architecture (NEW - PRODUCTION READY)

### Overview

The platform now supports **infinite scalability** through dynamic domain management. Domains are discovered at runtime from the `domain_registry` table, eliminating all hardcoded domain references.

### Core Principles

1. **No Hardcoded Domains** - All domain lists fetched from database
2. **Dynamic Scope Generation** - Scopes created as `attr.{domain}.{attribute_key}`
3. **Auto-Registration** - New domains automatically registered when attributes are stored
4. **Backward Compatibility** - Legacy `vault.read.*` scopes mapped to `attr.*` format

### Architecture Components

**Backend Services**:
- `DomainRegistryService` - Manages domain metadata in `domain_registry` table
- `DynamicScopeGenerator` - Generates and validates `attr.{domain}.*` scopes
- `DomainInferrer` - Auto-categorizes attributes into domains
- `scope_helpers.py` - Centralized scope resolution utilities

**Frontend Services**:
- `WorldModelService` - Platform-aware domain/scope fetching
- `domains.ts` - Dynamic `DomainInfo` interface (replaces hardcoded `VaultDomain`)

**API Endpoints** (5 new):
- `GET /api/world-model/domains` - List all domains
- `GET /api/world-model/domains/{userId}` - User domains
- `GET /api/world-model/metadata/{userId}` - User metadata
- `GET /api/world-model/scopes/{userId}` - Available scopes
- `GET /api/world-model/attributes/{userId}` - User attributes

### Migration Path

**Old Code** (Hardcoded):
```python
# Backend
DOMAINS = ["food", "professional", "financial"]
if domain in DOMAINS:
    process(domain)
```

**New Code** (Dynamic):
```python
# Backend
from hushh_mcp.services.domain_registry_service import get_domain_registry_service
registry = get_domain_registry_service()
domains = await registry.list_domains()
for domain in domains:
    process(domain.domain_key)
```

**Old Code** (Frontend):
```typescript
// Frontend
type VaultDomain = "food" | "professional";
```

**New Code** (Frontend):
```typescript
// Frontend
const domains = await WorldModelService.listDomains();
// Returns: DomainInfo[]
```

### Compliance Tests

New architecture compliance tests enforce:
- ✅ No hardcoded domain string literals in API routes
- ✅ No hardcoded domain lists/arrays
- ✅ All scope resolution uses `scope_helpers.py`
- ✅ VaultDBService has deprecation notice
- ✅ WorldModelService exists and is preferred

Run: `pytest consent-protocol/tests/quality/test_architecture_compliance.py`

---

## Financial Intelligence (Agent Kai Enhanced)

### Portfolio Parser Enhancements

**New Capabilities**:
- ✅ PDF parsing via `pdfplumber` (Fidelity, JPMorgan)
- ✅ Enhanced holding data (acquisition dates, sectors, estimated income)
- ✅ Account metadata extraction (account numbers, types, statement periods)
- ✅ Asset allocation from statements
- ✅ Income metrics (dividends, interest, capital gains)
- ✅ Tax reporting data (realized/unrealized gains)

**Supported Statement Formats**:
1. **CSV** - Schwab, Fidelity, Robinhood, generic
2. **Fidelity PDF** - Full account summary, asset allocation, holdings, income
3. **JPMorgan PDF** - Account values, holdings with acquisition dates, realized G/L

### 20+ Financial KPIs

Stored in `world_model_attributes` table under `financial` domain:

**Basic**: `holdings_count`, `portfolio_value_bucket`

**Asset Allocation**: `allocation_domestic_stock`, `allocation_foreign_stock`, `allocation_bonds`, `allocation_cash`, `allocation_etf`

**Income**: `annual_dividend_income`, `portfolio_yield`, `taxable_dividends`, `tax_exempt_dividends`, `interest_income`

**Tax Efficiency**: `tax_loss_harvesting_candidates`, `long_term_gain_positions`, `unrealized_gain_positions`

**Concentration**: `top_5_concentration`, `top_holding_symbol`, `top_holding_pct`, `top_holding_value`

**Sector Exposure**: `sector_technology`, `sector_financial`, `sector_healthcare`, `sector_consumer_cyclical`, `sector_energy` *(dynamic based on holdings)*

**Risk**: `margin_exposure`, `short_positions_count`, `sector_diversity_score`, `risk_bucket`

**Performance**: `total_unrealized_gain_loss`, `total_unrealized_gain_loss_pct`, `ytd_return_pct`, `losers_count`, `winners_count`

### Proactive Data Collection

Agent Kai tracks profile completeness and proactively prompts for missing data:

```python
# In kai_chat_service.py
completeness = await _check_data_completeness(user_id)
# Tracks: portfolio, risk_tolerance, investment_horizon, investment_goals, 
#         age_bracket, tax_situation, income_bracket, liquidity_needs

if completeness["completeness_score"] < 0.7:
    prompt = await get_proactive_data_collection_prompt(user_id)
    # Returns contextual prompt for highest-priority missing attribute
```

**Attribute Priority**:
1. `portfolio_imported` (highest)
2. `risk_tolerance`
3. `investment_horizon`
4. `investment_goals`
5. `age_bracket`

---

## Production Deployment Checklist

### Backend ✅
- ✅ All scope resolution centralized (`scope_helpers.py`)
- ✅ World Model API endpoints operational
- ✅ PDF parsing with `pdfplumber` installed
- ✅ Enhanced KPI derivation (20+ metrics)
- ✅ Kai data completeness checking
- ✅ Dynamic domain registry
- ✅ Legacy scope backward compatibility

### Frontend ✅
- ✅ Dynamic `DomainInfo` type
- ✅ `WorldModelService` methods implemented
- ✅ Web API proxies for all World Model endpoints
- ✅ Tri-flow architecture preserved
- ✅ Backward compatible domain utilities

### Native (iOS) ✅
- ✅ `listDomains()` method
- ✅ `getUserDomains()` method
- ✅ `getAvailableScopes()` method
- ✅ All existing methods maintained

### Tests ✅
- ✅ Architecture compliance tests for dynamic domains
- ✅ No hardcoded domain detection
- ✅ Scope resolution validation
- ✅ World Model service existence checks

### Documentation ✅
- ✅ Dynamic domain architecture documented
- ✅ Financial KPIs documented (20+ metrics)
- ✅ Migration paths provided
- ✅ API endpoints documented
- ✅ Compliance checklist complete

---

## Breaking Changes & Migration

### No Breaking Changes for End Users

All changes are backward compatible. Legacy scopes (`vault.read.food`) are automatically converted to dynamic scopes (`attr.food.*`).

### For Developers

**If you're adding new domains**: Don't add them to code. Just store attributes with the domain name, and the system will auto-register it.

**If you're checking domains**: Use `await domain_registry.list_domains()` instead of hardcoded lists.

**If you're resolving scopes**: Import `scope_helpers.py` instead of creating SCOPE_TO_ENUM dictionaries.

---
