# Hushh System Architecture

## 1. Overview

Hushh is a **Consent-First Personal Data Agent System** designed to give users control over their digital context.

> **Core Principles**: Consent First, Scoped Access, Data is Vaulted, Server Never Sees Key, Auditability

### The Stack

- **Frontend:** Next.js 15 (React) - User Interface for managing Agents and Consent
- **Protocol:** HushhMCP (Python) - Cryptographic backbone for Permissions and Agent Logic
- **Backend:** FastAPI (Python) - Exposes HushhMCP agents via REST/A2A
- **Storage:** PostgreSQL (Cloud SQL) - Encrypted vault for user data

---

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

- **Stateless:** Validated via HMAC signature
- **Scoped:** Access is limited (e.g., `vault.read.food`)
- **Short-lived:** Tokens expire to limit risk

### TrustLinks

Signed relationships allowing Agent-to-Agent (A2A) communication and delegation.

---

## 3. Authentication Flow (Passphrase + Recovery)

```
┌─────────────────────────────────────────────────────────────────┐
│                  BANKING-LEVEL SECURITY                          │
│                                                                  │
│  New User:                                                       │
│    1. Google OAuth (Identity)                                    │
│    2. Create Passphrase (Vault Encryption)                       │
│    3. Receive Recovery Key (HRK-XXXX-XXXX-XXXX-XXXX)            │
│    4. Redirect to Dashboard                                      │
│                                                                  │
│  Return User:                                                    │
│    1. Google OAuth (Identity)                                    │
│    2. Enter Passphrase (Unlock Vault)                           │
│    3. Redirect to Dashboard                                      │
│                                                                  │
│  Fallback (forgot passphrase):                                   │
│    1. Enter Recovery Key                                         │
│    2. Vault decrypted from recovery-encrypted copy              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                KEY DERIVATION                              │  │
│  │                                                            │  │
│  │  Passphrase → PBKDF2 (100k iterations) → AES-256 Key      │  │
│  │                        ↓                                   │  │
│  │              Vault Key (in sessionStorage only)            │  │
│  │                                                            │  │
│  │  Recovery Key → PBKDF2 → Separate AES-256 Key             │  │
│  │                        ↓                                   │  │
│  │              Backup encrypted vault key                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Zero-Knowledge: Server NEVER sees vault key or passphrase      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Agentic Data Collection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CHAT UI                              │
│                    (Next.js localhost:3000)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/chat
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (10000)                        │
│                                                                  │
│  1. Receive user message                                         │
│  2. Classify intent → identify domain                            │
│  3. Create TrustLink for delegation                              │
│  4. Route to domain agent                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ A2A Delegation + TrustLink
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN AGENT (e.g., 10001)                    │
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
│  Core Tables:                                                    │
│  - vault_keys: Passphrase + Recovery authentication             │
│    · encrypted_vault_key: Passphrase-encrypted vault key        │
│    · recovery_encrypted_vault_key: Recovery-encrypted copy      │
│                                                                  │
│  Domain Tables (Bible-Compliant Scoped Access):                  │
│  - vault_food: 🍽️ VAULT_WRITE_FOOD scope required               │
│  - vault_professional: 💼 VAULT_WRITE_PROFESSIONAL required      │
│                                                                  │
│  Audit Tables:                                                   │
│  - consent_audit: Consent token audit trail                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Agent Port Mapping

| Port  | Agent                | Description               |
| ----- | -------------------- | ------------------------- |
| 10000 | Orchestrator         | Intent detection, routing |
| 10001 | Food & Dining        | Dietary/cuisine/budget    |
| 10002 | Professional Profile | Career data management    |
| 10003 | Identity             | Identity verification     |
| 10004 | Shopping             | Purchase management       |
| 8000  | FastAPI Dev Server   | REST API                  |

---

## 6. Security Principles Compliance

| Principle                 | Implementation                                     |
| ------------------------- | -------------------------------------------------- |
| **Consent First**         | `issue_token()` before any vault write             |
| **Scoped Access**         | Domain-specific scopes (VAULT_WRITE_FOOD, etc.)    |
| **Data is Vaulted**       | AES-256-GCM encrypted, server only sees ciphertext |
| **Server Never Sees Key** | Passphrase → PBKDF2 → Key (client-side only)       |
| **Auditability**          | consent_audit table logs all token operations      |

---

## 7. Communication Flow

```
User → Next.js UI → /api/chat → Orchestrator → TrustLink → Domain Agent → Vault
```

---

## 8. Directory Structure

- `/hushh-webapp` → Frontend application (Next.js)
- `/consent-protocol` → Core protocol logic (Python) **← Active code**
- `/consent-protocol/hushh_mcp/agents/` → Agent implementations
- `/consent-protocol/hushh_mcp/operons/` → Reusable logic units
- `/hushh-adk-agents` → Reference implementations (not active)
- `/docs` → System documentation
