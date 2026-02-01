# Hushh Technical Architecture

> **Status**: Production Ready  
> **Core Principle**: "Google ADK Brains, Hushh Security Soul."

## Overview

Hushh uses a **Hub-and-Spoke** agent architecture built on the Google Agent Development Kit (ADK).

- **Orchestrator (Hub)**: Single entry point for user intent. Delegates, doesn't execute.
- **Specialist Agents (Spokes)**: Independent ADK Agents for specific domains (Finance).
- **Hushh Security Layer**: Wrapper enforcing the Consent Protocol on every agent.

### ADK Runtime

ADK uses conditional imports with fallback stubs:

```python
# consent-protocol/hushh_mcp/hushh_adk/core.py
try:
    from google.adk import Agent
except ImportError:
    class Agent:  # Fallback stub
        def __init__(self, *args, **kwargs): pass
```

---

## Hushh ADK Standard

Every agent must conform to:

1. **Manifest (`agent.yaml`)**: Declarative Model, System Prompt, and Scopes
2. **HushhAgent Wrapper**: Extends ADK Agent, validates tokens before execution
3. **Secure Tools (`@hushh_tool`)**: Runtime scope verification per tool

---

## Data Flow: "Analyze AAPL"

1. **User Input**: `POST /kai/chat` → "Analyze AAPL"
2. **Router**: Orchestrator delegates to KaiAgent
3. **Execution**: KaiAgent calls `perform_fundamental_analysis(ticker="AAPL")`
4. **Security**: `@hushh_tool(scope="attr.financial.*")` validates token
5. **Response**: Encrypted/decrypted as needed, returned to user

---

## Agent Catalog

| Agent | Role | Model | Key Tools |
|-------|------|-------|-----------|
| **Orchestrator** | Router | `gemini-3-flash` | `delegate_to_kai` |
| **Kai (Finance)** | Coordinator | `gemini-3-flash` | `perform_fundamental`, `perform_sentiment`, `perform_valuation`, `chat` |
| **Renaissance** | Research | N/A | `get_renaissance_rating`, `enhance_analysis` |

---

## Directory Structure

```
consent-protocol/
├── api/routes/           # FastAPI endpoints
├── hushh_mcp/
│   ├── agents/           # ADK Agents (orchestrator, kai)
│   ├── hushh_adk/        # HushhAgent, @hushh_tool, HushhContext
│   ├── services/         # WorldModelService, ChatDBService, etc.
│   ├── consent/          # Token validation, scope generation
│   └── operons/          # Business logic (pure functions)
└── mcp_modules/          # MCP server tools

hushh-webapp/
├── app/                  # Next.js pages and API routes
├── components/           # React components
├── lib/
│   ├── services/         # Platform-aware API services
│   ├── capacitor/        # Plugin interfaces
│   └── vault/            # Vault context (BYOK)
├── ios/App/App/Plugins/  # iOS Swift plugins
└── android/.../plugins/  # Android Kotlin plugins
```

---

## Service Layer

All database access goes through service classes that validate consent tokens.

| Service | Purpose |
|---------|---------|
| `WorldModelService` | Unified user data model |
| `ConsentDBService` | Consent management |
| `ChatDBService` | Persistent chat history |
| `RenaissanceService` | Investable universe queries |

```
API Routes → Service Layer → DatabaseClient → PostgreSQL
```

**Key Principle**: API routes MUST use service layer, never access database directly.

---

## Tri-Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Component (app/ or components/)                              │
│ - Calls service method only                                  │
│ - NO direct fetch() allowed                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Service Layer (lib/services/)                                │
│ - Detects platform: Capacitor.isNativePlatform()            │
│ - Web: calls Next.js proxy                                   │
│ - Native: calls Capacitor plugin                             │
└────────┬────────────────────────────────┬───────────────────┘
         │ WEB                            │ NATIVE
         ▼                                ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│ Next.js Proxy        │    │ Capacitor Plugin               │
│ (app/api/route.ts)   │    │ (iOS Swift + Android Kotlin)   │
└──────────┬───────────┘    └──────────┬─────────────────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
           ┌────────────────────────────┐
           │ Python Backend             │
           │ (consent-protocol/api/)    │
           └────────────────────────────┘
```

---

## Security

- **Consent-First**: All data access requires valid VAULT_OWNER token
- **Zero-Trust Tools**: Tools verify consent again, even if Agent has it
- **Manifest Truth**: Permissions defined in YAML, not code
- **Audit Logging**: Every tool invocation logged with user_id

**Full consent protocol documentation**: [Consent Protocol](./consent_protocol.md)

---

## See Also

- [Consent Protocol](./consent_protocol.md) - Token model and security
- [Database Service Layer](./database_service_layer.md) - Database architecture
- [Kai Agent](./kai.md) - Financial agent details