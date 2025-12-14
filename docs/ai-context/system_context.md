# Hushh System Context for AI Agents

> **AI Development Context** - This document provides essential context for LLMs and AI assistants working on the Hushh codebase.

---

## 🎯 Project Identity

| Field            | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Name**         | Hushh                                                                                |
| **Mission**      | Consent-first Personal Data Agents                                                   |
| **Philosophy**   | "Consent is not a checkbox. It's a contract, a signal, and a programmable boundary." |
| **Key Metaphor** | "Operons" - Biological units of reusable logic                                       |

---

## 🛠️ Technology Stack

| Layer          | Technologies                                          |
| -------------- | ----------------------------------------------------- |
| **Frontend**   | Next.js 15, React, Shadcn UI, Morphy-UX, Tailwind CSS |
| **Backend**    | Python 3.10+, FastAPI, HushhMCP                       |
| **Storage**    | PostgreSQL (Cloud SQL via GCP)                        |
| **Auth**       | Firebase (Google OAuth) + Passphrase (PBKDF2)         |
| **Encryption** | AES-256-GCM (client-side)                             |

---

## 📂 Code Locations

### Active Code

| Directory                     | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `hushh-webapp/`               | Next.js frontend application             |
| `consent-protocol/`           | **PRIMARY** - Python agents and protocol |
| `consent-protocol/hushh_mcp/` | Core protocol implementation             |
| `docs/`                       | Documentation                            |

### Key Files

| File                                             | Purpose                                               |
| ------------------------------------------------ | ----------------------------------------------------- |
| `consent-protocol/server.py`                     | FastAPI server with all agent endpoints               |
| `hushh_mcp/consent/token.py`                     | `issue_token()`, `validate_token()`, `revoke_token()` |
| `hushh_mcp/agents/food_dining/agent.py`          | Food preferences agent (786 lines)                    |
| `hushh_mcp/agents/professional_profile/agent.py` | Professional agent (624 lines)                        |
| `hushh-webapp/app/api/chat/route.ts`             | Chat API proxy to Python agents                       |
| `hushh-webapp/lib/vault/encrypt.ts`              | Client-side encryption                                |

---

## 🏗️ Architecture Pattern

```
User → Chat UI → /api/chat → Orchestrator → TrustLink → Domain Agent → Vault
                     ↓                                        ↓
              Fallback Routing                        issue_token()
              (if Python offline)                     on user confirm
```

### Agent Port Mapping

| Port  | Agent              | Status      |
| ----- | ------------------ | ----------- |
| 10000 | Orchestrator       | Active      |
| 10001 | Food & Dining      | Active      |
| 10002 | Professional       | Active      |
| 10003 | Identity           | Placeholder |
| 10004 | Shopping           | Placeholder |
| 8000  | FastAPI Dev Server | Active      |

---

## 🔐 Consent Protocol Primitives

### ONLY use these functions:

```python
# consent/token.py
issue_token(user_id, agent_id, scope) -> HushhConsentToken
validate_token(token_str, expected_scope) -> Tuple[bool, str, HushhConsentToken]
revoke_token(token_str) -> None

# trust/link.py
create_trust_link(source_agent, target_agent, scope, duration) -> TrustLink
verify_trust_link(link) -> bool

# vault/encrypt.py
encrypt_data(data, key) -> EncryptedPayload
decrypt_data(payload, key) -> str
```

### ConsentScope Enum

```python
class ConsentScope(str, Enum):
    VAULT_READ_FOOD = "vault.read.food"
    VAULT_WRITE_FOOD = "vault.write.food"
    VAULT_READ_PROFESSIONAL = "vault.read.professional"
    VAULT_WRITE_PROFESSIONAL = "vault.write.professional"
    VAULT_READ_FINANCE = "vault.read.finance"
    VAULT_WRITE_FINANCE = "vault.write.finance"
    AGENT_IDENTITY_VERIFY = "agent.identity.verify"
```

---

## 📊 Data Flow

### Token Issuance Flow

```
1. User confirms "Save" in UI
2. Agent calls issue_token(user_id, agent_id, scope)
3. Token returned to frontend with collected data
4. Frontend encrypts data with vault key (client-side)
5. POST /api/vault/store-preferences (with consent_token)
6. Server validates token before write
7. Only encrypted ciphertext stored
```

### Authentication Flow

```
New User:    OAuth → Create Passphrase → Recovery Key → Dashboard
Return User: OAuth → Enter Passphrase → Dashboard
Fallback:    Enter Recovery Key (HRK-XXXX-XXXX-XXXX-XXXX)
```

---

## ⚠️ Critical Guidelines

### DO:

- ✅ Always call `issue_token()` before vault writes
- ✅ Always call `validate_token()` before vault reads
- ✅ Use HushhMCP primitives - no custom consent logic
- ✅ Include `userId` in all chat API calls
- ✅ Keep vault key in sessionStorage only
- ✅ Encrypt all sensitive data client-side

### DON'T:

- ❌ Never store vault key in localStorage
- ❌ Never send plaintext preferences to server
- ❌ Never bypass consent validation
- ❌ Never use mock user IDs in production
- ❌ Never hardcode consent scopes

---

## 🎨 UI Guidelines

### Design System

| Component             | Usage                |
| --------------------- | -------------------- |
| `Button showRipple`   | Ripple on click only |
| `Card effect="glass"` | Frosted glass        |
| `variant="gradient"`  | Blue-purple gradient |
| `variant="none"`      | No color variant     |

### Colors

| Token                   | Value                 | Usage        |
| ----------------------- | --------------------- | ------------ |
| `--color-hushh-blue`    | #0071e3               | Primary CTAs |
| `--color-hushh-emerald` | #10b981               | Success      |
| `bg-gradient-to-br`     | Use `bg-linear-to-br` | Tailwind v4  |

---

## 🧪 Common Issues & Fixes

### "User mismatch" error

**Cause:** `userId` not passed to chat API
**Fix:** Ensure `handleSelection` and `handleSend` include userId from localStorage/sessionStorage

### Port mismatch in fallback

**Cause:** Hardcoded wrong ports in `fallbackIntentClassification`
**Fix:** Use AGENT_PORTS from constants.py (10001 for food, 10002 for professional)

### Token validation fails

**Cause:** Token issued for different user than request
**Fix:** Pass real Firebase userId to agents, not mocks

---

## 📚 Documentation Map

| Document          | Path                                |
| ----------------- | ----------------------------------- |
| Main README       | `docs/README.md`                    |
| Architecture      | `docs/technical/architecture.md`    |
| Developer API     | `docs/technical/developer-api.md`   |
| Database Schema   | `docs/technical/database-schema.md` |
| Design System     | `docs/design-system.md`             |
| Business Overview | `docs/business/overview.md`         |
| Protocol Spec     | `consent-protocol/docs/`            |

---

## 🔄 Compliance Checklist

When implementing any agent action:

```
[ ] 1. Collect data through multi-turn conversation
[ ] 2. Show user summary before save
[ ] 3. Call issue_token() when user confirms
[ ] 4. Return token to frontend
[ ] 5. Frontend encrypts with vault key
[ ] 6. POST to vault API with consent_token
[ ] 7. Server validates token
[ ] 8. Store only encrypted data
[ ] 9. Log to consent_audit table
```

---

_Context Version: 2.0 | Updated: 2024-12-14_
