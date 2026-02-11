x# Hushh Documentation Index

> **Embedding-Optimized Navigation** — Search keywords: hushh, personal data agents, consent-first, morphy-ux, capacitor, nextjs, fastapi, ai agent, vault encryption, zero-knowledge  
> **Last Updated**: February 2026 | Version: v1.5

---

## Quick Start

| Task | Document |
|------|----------|
| **Set up environment** | [Getting Started](../getting_started.md) |
| **Understand the system** | [Project Context Map](project_context_map.md) |
| **Make first contribution** | [Contributor Onboarding](guides/contributor_onboarding.md) |
---

## Authentication Patterns

All consent management endpoints use VAULT_OWNER token (not Firebase auth):

| Endpoint | Auth Type | Notes |
|----------|-----------|-------|
| `POST /api/consent/vault-owner-token` | Firebase | Bootstrap - issues VAULT_OWNER token |
| `GET /api/consent/pending?user_id={id}` | VAULT_OWNER | Consent-gated |
| `POST /api/consent/pending/approve` | VAULT_OWNER | Consent-gated |
| `POST /api/consent/pending/deny` | VAULT_OWNER | Consent-gated |
| `POST /api/consent/cancel` | VAULT_OWNER | Consent-gated |
| `POST /api/consent/revoke` | VAULT_OWNER | Consent-gated |
| `GET /api/consent/data` | Consent Token | MCP data retrieval |

**Key Principle**: Only `/vault-owner-token` uses Firebase auth (to bootstrap). All other consent operations require the VAULT_OWNER token.

---

## Core Documentation

### Architecture & Security

| Document | Purpose |
|----------|---------|
| [Project Context Map](project_context_map.md) | **Start here** - Repo topology, invariants, tri-flow rules |
| [Architecture](reference/architecture.md) | System design, ADK agents, service layer |
| [Consent Protocol](reference/consent_protocol.md) | VAULT_OWNER tokens, security model, compliance |
| [Consent Push (FCM)](reference/consent_push_notifications.md) | FCM vs gcloud: what cannot be done with gcloud CLI alone; setup and test |

### Building Features

| Document | Purpose |
|----------|---------|
| [Feature Checklist](guides/feature_checklist.md) | Step-by-step feature development |
| [Route Contracts](reference/route_contracts.md) | API endpoint specifications |
| [Mobile Development](guides/mobile_development.md) | Capacitor plugins, native code |

### Building Agents

| Document | Purpose |
|----------|---------|
| [Agent Development](agents/agent_development_guidelines.md) | Complete agent guide |
| [ADK Implementation](agents/adk_implementation.md) | Google ADK integration |
| [ADK Standards](agents/adk_standards.md) | ADK v2.0 standards and patterns |
| [A2A Protocol](agents/a2a_implementation.md) | Agent-to-Agent communication |

---

## Reference

| Topic | Document |
|-------|----------|
| **CI configuration** | [ci.md](reference/ci.md) |
| Env vars and secrets | [env_and_secrets.md](reference/env_and_secrets.md) |
| Consent push (FCM) | [consent_push_notifications.md](reference/consent_push_notifications.md) |
| Database Schema | [database_schema.md](reference/database_schema.md) |
| Service Layer | [database_service_layer.md](reference/database_service_layer.md) |
| Developer API | [developer_api.md](reference/developer_api.md) |
| MCP Integration | [mcp_integration.md](reference/mcp_integration.md) |
| Frontend Design | [frontend_design_system.md](reference/frontend_design_system.md) |
| Agent Kai | [kai.md](reference/kai.md) |
| Base User Schema | [base_user_schema.md](reference/base_user_schema.md) |

---

## Deployment

| Document | Purpose |
|----------|---------|
| [Deployment Guide](guides/deployment.md) | Production deployment |
| [Deployment Workflows](deployment_workflows.md) | CI/CD pipelines |

---

## Business & Vision

| Document | Purpose |
|----------|---------|
| [Business Overview](business/overview.md) | Plain-English product explanation |
| [Roadmap](business/roadmap.md) | Business roadmap and phases |
| [Launch Strategy](business/launch_strategy.md) | Product Hunt & community strategy |
| [Vision](vision/readme.md) | Hushh philosophy and vision |
| [Agent Kai Vision](vision/kai/readme.md) | Comprehensive Kai agent vision |

---

## Directory Structure

```
docs/
├── index.md                    # This file - Navigation + Auth patterns
├── project_context_map.md      # Canonical repo map (START HERE for AI)
├── prompt_context.md           # AI assistant context
├── deployment_workflows.md     # CI/CD pipelines
│
├── reference/                  # Technical reference
│   ├── architecture.md         # System architecture
│   ├── consent_protocol.md     # Security & consent
│   ├── consent_push_notifications.md  # FCM vs gcloud, push setup
│   ├── database_schema.md      # Database tables
│   ├── database_service_layer.md
│   ├── route_contracts.md      # API contracts
│   ├── developer_api.md        # External API guide
│   ├── frontend_design_system.md
│   ├── mcp_integration.md
│   ├── base_user_schema.md
│   └── kai.md                  # Agent Kai reference
│
├── guides/                     # How-to guides
│   ├── contributor_onboarding.md
│   ├── feature_checklist.md    # Building features
│   ├── mobile_development.md   # Capacitor/native
│   └── deployment.md           # Deployment
│
├── agents/                     # Agent development
│   ├── agent_development_guidelines.md
│   ├── adk_implementation.md
│   ├── adk_standards.md
│   └── a2a_implementation.md
│
├── business/                   # Business docs
│   ├── overview.md
│   ├── roadmap.md
│   ├── launch_strategy.md
│   └── DISCORD_BLUEPRINT.md
│
└── vision/                     # Product vision
    ├── readme.md
    ├── agent_nav/readme.md
    └── kai/
        ├── readme.md           # Comprehensive Kai vision
        ├── data/               # Investor data
        └── miscellaneous/      # Additional notes
```

---

## AI Context Priority

When AI reads docs, recommended priority order:

1. `project_context_map.md` - Invariants, tri-flow rules, key files
2. `index.md` - Navigation and auth patterns
3. `reference/consent_protocol.md` - Token model details
4. `reference/architecture.md` - System design

---

## 📚 Quick Search Index (For Embedding/Retrieval)

### Core Topics
- **Morphy-UX** - Glass morphism UI system, button variants, card effects, ripple mechanics
- **Capacitor** - iOS/Android native plugins, 8 plugins, native HTTP calls
- **Tri-Flow Architecture** - Component → Service → [Web Proxy | Native Plugin] → Backend
- **BYOK / Zero-Knowledge** - Vault keys never leave device, ciphertext-only storage

### Technology Stack
- **Backend**: FastAPI, Python, Supabase (PostgreSQL), MCP server
- **Frontend**: Next.js 16 App Router, React 19, TailwindCSS, GSAP animations
- **Mobile**: Capacitor 8, iOS Swift, Android Kotlin, FaceID/TouchID biometrics
- **Security**: AES-256-GCM encryption, VAULT_OWNER tokens, Firebase auth (bootstrap only)

### Key Documentation Keywords
| Keyword | File(s) |
|---------|---------|
| `tri-flow` | `project_context_map.md`, `guides/mobile_development.md` |
| `vault_flow` | `reference/frontend_design_system.md`, `components/vault/vault-flow.tsx` |
| `glass_morphism` | `reference/frontend_design_system.md`, `globals.css` |
| `consent_token` | `reference/consent_protocol.md`, `api/middleware.py` |
| `kai_agent` | `reference/kai.md`, `agents/kai/` |
| `mcp_server` | `reference/mcp_integration.md`, `consent-protocol/mcp_server.py` |

### Component Categories
| Category | Files |
|----------|-------|
| **UI Components** | `Button`, `Card`, `Tabs`, `SegmentedControl` (Morphy-UX) |
| **Vault Components** | `VaultFlow`, `HushhVaultPlugin` |
| **Agent Components** | `KaiStreamingComponent`, `AgentChat`, `ConsentDialog` |
| **Charts** | `PortfolioHistoryChart`, `TransactionActivity`, `CashFlowCard` |

### Navigation Patterns
| Pattern | File(s) |
|---------|---------|
| Client-side routing | `next/link`, `BreadcrumbLink asChild` |
| Bottom navigation | Pill navigation, glass-morphic, smooth cubic-bezier easing |
| Page transitions | GSAP opacity crossfade, preserve flex layout |

---

## 📖 Quick Navigation by Role

### For AI Agents / Context Understanding
```
project_context_map.md → reference/consent_protocol.md → 
reference/architecture.md → index.md (search keywords above)
```

### For Frontend Developers
```
index.md → reference/frontend_design_system.md → 
components/kai/ → lib/morphy-ux/
```

### For Backend Developers
```
project_context_map.md → reference/architecture.md → 
reference/consent_protocol.md → api/routes/
```

### For Mobile Developers (iOS/Android)
```
guides/mobile_development.md → project_context_map.md#tri-flow →
ios/App/App/Plugins/ / android/.../plugins/
```
