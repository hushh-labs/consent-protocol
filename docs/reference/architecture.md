# Architecture

> System-level technical architecture for the Hushh Personal Data Agent platform.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Next.js 16 / React 19 / Capacitor 8                             │   │
│  │ ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌───────────────┐  │   │
│  │ │ Vault    │ │ Kai       │ │ Portfolio    │ │ Consent       │  │   │
│  │ │ Context  │ │ Dashboard │ │ Manager      │ │ Notifications │  │   │
│  │ └────┬─────┘ └─────┬─────┘ └──────┬───────┘ └───────┬───────┘  │   │
│  │      └──────────────┴──────────────┴─────────────────┘          │   │
│  │                        Service Layer                             │   │
│  │                    (ApiService / Zustand)                        │   │
│  └────────────────────────────┬─────────────────────────────────────┘   │
│           WEB: Next.js Proxy  │  NATIVE: Capacitor Plugin              │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND LAYER                                 │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ FastAPI (Python 3.13) on Cloud Run                               │   │
│  │                                                                  │   │
│  │  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐   │   │
│  │  │ API Routes │──▶│ Service Layer│──▶│ DatabaseClient       │   │   │
│  │  │ (consent,  │   │ (World Model,│   │ (SQLAlchemy +        │   │   │
│  │  │  kai, wm)  │   │  Consent DB, │   │  Supabase Pooler)    │   │   │
│  │  └────────────┘   │  Chat DB,    │   └──────────┬───────────┘   │   │
│  │                    │  Renaissance)│              │               │   │
│  │  ┌────────────┐   └──────────────┘              │               │   │
│  │  │ Agents     │                                  │               │   │
│  │  │ (ADK +     │   ┌──────────────┐              ▼               │   │
│  │  │  Hushh     │──▶│ Operons      │   ┌──────────────────────┐   │   │
│  │  │  Security) │   │ (calculators,│   │ PostgreSQL           │   │   │
│  │  └────────────┘   │  fetchers,   │   │ (Supabase)           │   │   │
│  │                    │  llm, etc.)  │   └──────────────────────┘   │   │
│  │  ┌────────────┐   └──────────────┘                              │   │
│  │  │ MCP Server │                                                  │   │
│  │  └────────────┘                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backend: consent-protocol

**Runtime**: Python 3.13, FastAPI, Uvicorn, Cloud Run

### Route Organization

All endpoints live in `api/routes/`. Each module is a FastAPI `APIRouter` registered in `server.py`.

| Router Module       | Prefix              | Purpose                                  |
| -------------------- | -------------------- | ---------------------------------------- |
| `health`            | `/health`, `/kai/health` | Liveness probes                      |
| `consent`           | `/api/consent`       | Token issuance, approval, revocation     |
| `kai/__init__`      | `/kai`               | Chat, streaming, analysis, preferences   |
| `world_model`       | `/api/world-model`   | Domain data CRUD, index, scopes          |
| `notifications`     | `/api/notifications` | FCM push token registration              |
| `developer`         | `/api/v1`            | External developer consent flow          |
| `agents`            | `/api/agents`        | Agent card discovery                     |
| `session`           | `/api/session`       | Kai session management                   |
| `sync`              | `/api/sync`          | Offline-to-online sync                   |
| `account`           | `/api/account`       | Account deletion                         |
| `db_proxy`          | `/api/db`            | Renaissance universe queries             |

### Service Layer

**Rule**: API routes never access the database directly. All DB operations go through service classes.

```
API Route → Service (validates consent) → DatabaseClient → PostgreSQL
```

| Service                | File                                          | Purpose                                   |
| ---------------------- | --------------------------------------------- | ----------------------------------------- |
| `WorldModelService`   | `hushh_mcp/services/world_model_service.py`   | Unified user data: store, retrieve, index |
| `ConsentDBService`    | `hushh_mcp/services/consent_db_service.py`    | Consent audit trail, token lookup         |
| `ChatDBService`       | `hushh_mcp/services/chat_db_service.py`       | Kai chat history persistence              |
| `RenaissanceService`  | `hushh_mcp/services/renaissance_service.py`   | Investable universe data                  |
| `PushTokensService`   | `hushh_mcp/services/push_tokens_service.py`   | FCM push token CRUD                       |
| `DomainRegistryService` | `hushh_mcp/services/domain_registry_service.py` | Domain metadata registry               |

### Agent Architecture

Hub-and-spoke model built on Google ADK with Hushh security wrapper.

```
User Request
    │
    ▼
OrchestratorAgent (Hub)
    │  ── intent detection ──
    ▼
KaiAgent (Spoke)
    │  ── consent validated at entry ──
    ├── perform_fundamental_analysis  (@hushh_tool)
    ├── perform_sentiment_analysis    (@hushh_tool)
    └── perform_valuation_analysis    (@hushh_tool)
         │  ── consent re-validated per tool ──
         ▼
    Operons (calculators, fetchers, LLM, analysis)
         │
         ▼
    Structured Response (DecisionCard / SSE stream)
```

Four-layer dependency stack (the **DNA Model**):

| Layer      | Responsibility                        | DB Access | Consent Check  |
| ---------- | ------------------------------------- | --------- | -------------- |
| **Agent**  | Orchestrate tools, enforce consent    | No        | At entry       |
| **Tool**   | LLM-callable function (`@hushh_tool`) | No        | Per invocation |
| **Operon** | Business logic (pure or impure)       | No        | If impure      |
| **Service**| Database operations                   | Yes       | Validated upstream |

### Directory Structure

```
consent-protocol/
├── server.py                     # FastAPI app, CORS, rate limiting
├── consent_db.py                 # DatabaseClient singleton
├── api/
│   ├── middlewares/               # Rate limiting, auth helpers
│   └── routes/                    # All endpoint routers
│       ├── consent.py
│       ├── world_model.py
│       ├── notifications.py
│       ├── kai/                   # Kai sub-routers
│       │   ├── __init__.py        # Router aggregation
│       │   ├── chat.py
│       │   ├── stream.py
│       │   ├── preferences.py
│       │   └── portfolio.py
│       └── ...
├── hushh_mcp/
│   ├── hushh_adk/                 # Security-wrapped ADK
│   │   ├── core.py                # HushhAgent base class
│   │   ├── tools.py               # @hushh_tool decorator
│   │   ├── context.py             # HushhContext (contextvars)
│   │   └── manifest.py            # AgentManifest + ManifestLoader
│   ├── agents/
│   │   ├── orchestrator/          # Intent routing
│   │   └── kai/                   # Financial analysis
│   │       ├── agent.py           # KaiAgent(HushhAgent)
│   │       ├── agent.yaml         # Manifest
│   │       ├── tools.py           # @hushh_tool wrappers
│   │       ├── fundamental_agent.py
│   │       ├── sentiment_agent.py
│   │       ├── valuation_agent.py
│   │       └── debate_engine.py
│   ├── operons/kai/               # Business logic
│   │   ├── calculators.py         # Pure math (10+ functions)
│   │   ├── fetchers.py            # External data (SEC, yfinance, news)
│   │   ├── analysis.py            # Analysis orchestrators
│   │   ├── llm.py                 # Gemini integration
│   │   └── storage.py             # Encrypted vault operations
│   ├── services/                  # Database access layer
│   ├── consent/                   # Token crypto, scope helpers
│   └── config.py                  # Environment config
├── db/migrations/                 # SQL migration files
└── mcp_modules/                   # MCP server tools
```

---

## Frontend: hushh-webapp

**Runtime**: Next.js 16, React 19, TailwindCSS, Capacitor 8

### Stack

| Layer            | Technology                          | Purpose                         |
| ---------------- | ----------------------------------- | ------------------------------- |
| Framework        | Next.js 16 (App Router)            | Pages, API proxies, SSR         |
| UI               | React 19 + TailwindCSS             | Components                      |
| Design System    | Shadcn UI + Morphy-UX              | Component library + extensions  |
| State            | Zustand (memory-only)              | Session state, no persistence   |
| Charts           | Recharts + Shadcn ChartContainer   | Financial data visualization    |
| Animation        | GSAP                               | Motion and transitions          |
| Toast            | Sonner                             | Notification toasts             |
| Native           | Capacitor 8                        | iOS + Android builds            |

### Tri-Flow Architecture

Every feature must work identically on Web, iOS, and Android.

```
Component → Service → [Web: Next.js Proxy | Native: Capacitor Plugin] → Backend
```

**Rule**: No `fetch()` in components. All API calls go through `ApiService` which detects the platform and routes accordingly.

| Platform | Path                                     |
| -------- | ---------------------------------------- |
| Web      | Component → ApiService → `/api/...` → Backend |
| iOS      | Component → ApiService → Swift Plugin → Backend |
| Android  | Component → ApiService → Kotlin Plugin → Backend |

### Directory Structure

```
hushh-webapp/
├── app/                          # Next.js App Router pages
│   ├── kai/                      # Kai feature pages
│   │   └── dashboard/
│   │       ├── page.tsx          # Main dashboard
│   │       ├── analysis/         # Stock analysis
│   │       └── manage/           # Portfolio management
│   └── api/                      # Next.js proxy routes
├── components/
│   ├── kai/                      # Kai-specific components
│   ├── consent/                  # Consent UI + notification provider
│   └── ui/                       # Shadcn primitives
├── lib/
│   ├── services/                 # ApiService, KaiService
│   ├── vault/                    # VaultContext (BYOK, memory-only)
│   ├── firebase/                 # Auth context
│   ├── notifications/            # FCM service
│   ├── morphy-ux/                # Design system extensions
│   ├── stores/                   # Zustand stores
│   └── utils/                    # Portfolio normalization, helpers
├── ios/App/App/Plugins/          # Swift native plugins
└── android/.../plugins/          # Kotlin native plugins
```

---

## Database: Supabase (PostgreSQL)

Connection: SQLAlchemy with Supabase Session Pooler. No ORM models -- raw SQL through `DatabaseClient`.

### Live Tables (10)

| Table                       | Purpose                                     | Encrypted |
| --------------------------- | ------------------------------------------- | --------- |
| `vault_keys`                | User vault key material (salt, IV, recovery)| Partial   |
| `world_model_data`          | User data blobs (AES-256-GCM ciphertext)    | Yes       |
| `world_model_index_v2`      | Non-encrypted metadata for MCP scoping      | No        |
| `domain_registry`           | Available data domains (food, financial...) | No        |
| `consent_audit`             | Token lifecycle audit trail                 | No        |
| `consent_exports`           | Encrypted exports for MCP consumption       | Yes       |
| `user_push_tokens`          | FCM push tokens per user/platform           | No        |
| `renaissance_universe`      | Investable stock universe                   | No        |
| `renaissance_screening_criteria` | Screening tier definitions              | No        |
| `renaissance_avoid`         | Excluded stocks                             | No        |

See [World Model](../../consent-protocol/docs/reference/world-model.md) for detailed schema.

### RPCs

| Function                  | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `merge_domain_summary`    | Atomic JSONB merge into `world_model_index_v2` |
| `remove_domain_summary_key` | Atomic key removal from domain summary     |

---

## Infrastructure

### Cloud Run

- **Service**: `consent-protocol` on Google Cloud Run
- **Region**: `us-east1`
- **Port**: 8000
- **Min instances**: 0 (scale to zero)
- **Max instances**: 10

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) with path-filtered jobs:

| Job              | Trigger                        | Checks                                   |
| ---------------- | ------------------------------ | ---------------------------------------- |
| `web-check`      | `hushh-webapp/**` changes      | ESLint, TypeScript, Vitest               |
| `protocol-check` | `consent-protocol/**` changes  | Ruff, mypy, pytest                       |

Manual trigger: Actions > Tri-Flow CI > scope: `frontend` / `backend` / `all`.

### GCP Secrets

| Secret                    | Used By  |
| ------------------------- | -------- |
| `GOOGLE_API_KEY`          | Backend  |
| `DB_USER` / `DB_PASSWORD` / `DB_HOST` | Backend |
| `CONSENT_TOKEN_SECRET`    | Backend  |
| `FIREBASE_*`              | Frontend |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Frontend |

---

## Security Invariants

These rules are non-negotiable across the entire codebase:

1. **BYOK (Bring Your Own Key)**: Vault keys never touch the server. Backend stores ciphertext only. Decryption happens exclusively on the client.

2. **Consent-First**: All data access requires a valid consent token. Even vault owners use `VAULT_OWNER` tokens -- no bypasses.

3. **Zero-Storage**: No `sessionStorage`, no `localStorage`. All sensitive state lives in React memory (Zustand stores, React context). Evicted on tab close.

4. **Tri-Flow Parity**: Every feature works on Web, iOS, and Android. No `fetch()` in components -- `ApiService` routes to the correct platform path.

5. **Double Consent Validation**: Consent is checked at Agent entry (`HushhAgent.run()`) AND at each tool invocation (`@hushh_tool` decorator). Belt and suspenders.

6. **Audit Everything**: Every token operation is recorded in `consent_audit`. Every tool invocation is logged with `user_id`.

---

## See Also

- [World Model](../../consent-protocol/docs/reference/world-model.md) -- Two-table encryption architecture
- [API Contracts](./api-contracts.md) -- Every endpoint documented
- [Kai Agents](../../consent-protocol/docs/reference/kai-agents.md) -- Financial analysis system
- [Agent Development](../../consent-protocol/docs/reference/agent-development.md) -- Building new agents
- [Consent Protocol](../../consent-protocol/docs/reference/consent-protocol.md) -- Token model and security
