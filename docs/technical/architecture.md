# Hushh System Architecture

## 1. Overview

Hushh is a **Consent-First Personal Data Agent System** designed to give users control over their digital context.

### The Stack

- **Frontend:** Next.js 15 (React) - User Interface for managing Agents and Consent.
- **Protocol:** HushhMCP (Python) - Cryptographic backbone for Permissions and Agent Logic.
- **Backend:** FastAPI (Python) - Exposes HushhMCP agents via REST/A2A.
- **Storage:** PostgreSQL (Cloud SQL) - Encrypted vault for user data.

## 2. Core Concepts (HushhMCP)

### Operons

Atomic units of logic (pure, stateless, testable functions). Think of them as the "Genes" of an Agent.

### Agents

Modular orchestrators that act on behalf of the user:

- **Orchestrator** - Routes user intent to domain agents
- **Food & Dining** - Manages dietary preferences, budgets
- **Professional** - Manages career/resume data

### Consent Tokens

Cryptographic proofs (`HCT:...`) that authorize an Agent to perform an action for a specific scope.

- **Stateless:** Validated via HMAC signature.
- **Scoped:** Access is limited (e.g., `vault.read.food`).
- **Short-lived:** Tokens expire to limit risk.

### TrustLinks

Signed relationships allowing Agent-to-Agent (A2A) communication and delegation.

## 3. Agent Port Mapping

| Port  | Agent                | Description               |
| ----- | -------------------- | ------------------------- |
| 10000 | Orchestrator         | Intent detection, routing |
| 10001 | Food & Dining        | Dietary/cuisine/budget    |
| 10002 | Professional Profile | Career data management    |
| 10003 | Identity             | Identity verification     |
| 10004 | Shopping             | Purchase management       |
| 8000  | FastAPI Dev Server   | REST API                  |

## 4. Agentic Data Collection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CHAT UI                              │
│                    (Next.js localhost:3000)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/chat
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (10003)                        │
│                                                                  │
│  1. Receive user message                                         │
│  2. Classify intent → identify domain                            │
│  3. Create TrustLink for delegation                              │
│  4. Route to domain agent                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ A2A Delegation
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN AGENT (e.g., 10005)                    │
│                                                                  │
│  1. Receive delegated task + TrustLink                           │
│  2. Collect data via conversation                                │
│  3. Request consent token from user                              │
│  4. Validate token with hushh_mcp                                │
│  5. Encrypt data with vault key                                  │
│  6. Store to PostgreSQL vault                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL VAULT (Cloud SQL)                  │
│                                                                  │
│  Tables:                                                         │
│  - vault_keys: User encryption keys (encrypted)                  │
│  - vault_data: Encrypted user preferences (scope-based)          │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Communication Flow

`User` → `Next.js UI` → `/api/chat` → `Orchestrator` → (TrustLink) → `Domain Agent` → `Vault`

## 6. Directory Structure

- `/hushh-webapp` → Frontend application (Next.js)
- `/consent-protocol` → Core protocol logic (Python) **← Active code**
- `/consent-protocol/hushh_mcp/agents/` → Agent implementations
- `/consent-protocol/hushh_mcp/operons/` → Reusable logic units
- `/hushh-adk-agents` → Reference implementations (not active)
- `/docs` → System documentation
