# Hushh System Architecture

> Technical deep-dive into the consent-first Personal Data Agent system.

---

## 🎯 Overview

Hushh is a **Consent-First Personal Data Agent System** that gives users complete control over their digital context through cryptographic consent primitives.

### Design Philosophy

```
"Agents should serve the person — and only when asked to."
```

### The Stack

| Layer        | Technology                  | Purpose                    |
| ------------ | --------------------------- | -------------------------- |
| **Frontend** | Next.js 15, React, Tailwind | User interface             |
| **Protocol** | HushhMCP (Python)           | Consent tokens, TrustLinks |
| **API**      | FastAPI                     | Agent chat endpoints       |
| **Storage**  | PostgreSQL + AES-256-GCM    | Encrypted vault            |
| **Auth**     | Firebase + PBKDF2           | Identity + Key derivation  |

---

## 🏗️ System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Next.js Frontend (localhost:3000)                 │   │
│   │                                                                      │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│   │   │   Login +    │  │   AgentChat  │  │   Dashboard              │  │   │
│   │   │   Passphrase │  │   Component  │  │   (Decrypted View)       │  │   │
│   │   └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│   │            │                │                        │               │   │
│   │            ▼                ▼                        ▼               │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │                 lib/vault/encrypt.ts                          │  │   │
│   │   │         (Client-side AES-256-GCM encryption)                  │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │ POST /api/chat
                                     │ (userId + message + sessionState)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            PROTOCOL LAYER                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │            FastAPI Server (server.py) - localhost:8000               │   │
│   │                                                                      │   │
│   │   ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │   │
│   │   │  /api/agents/  │  │  /api/agents/  │  │  /api/v1/          │   │   │
│   │   │  food-dining/  │  │  professional- │  │  (Developer API)   │   │   │
│   │   │  chat          │  │  profile/chat  │  │  request-consent   │   │   │
│   │   └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘   │   │
│   │           │                   │                      │              │   │
│   │           ▼                   ▼                      ▼              │   │
│   │   ┌─────────────────────────────────────────────────────────────┐  │   │
│   │   │                      HushhMCP Core                           │  │   │
│   │   │                                                              │  │   │
│   │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │   │
│   │   │  │   consent/  │  │   trust/    │  │   vault/            │  │  │   │
│   │   │  │   token.py  │  │   link.py   │  │   encrypt.py        │  │  │   │
│   │   │  │             │  │             │  │                     │  │  │   │
│   │   │  │ issue_token │  │ create_     │  │ encrypt_data        │  │  │   │
│   │   │  │ validate_   │  │ trust_link  │  │ decrypt_data        │  │  │   │
│   │   │  │ token       │  │ verify_     │  │                     │  │  │   │
│   │   │  │ revoke_     │  │ trust_link  │  │                     │  │  │   │
│   │   │  │ token       │  │             │  │                     │  │  │   │
│   │   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │   │
│   │   └─────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │ Encrypted writes only
                                     │ (Validated by consent token)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE LAYER                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               PostgreSQL (Cloud SQL) - Encrypted Vault               │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │   │
│   │   │   vault_keys    │  │   vault_food    │  │   vault_professional│ │   │
│   │   │                 │  │                 │  │                     │ │   │
│   │   │ user_id         │  │ user_id         │  │ user_id             │ │   │
│   │   │ encrypted_      │  │ dietary_        │  │ professional_       │ │   │
│   │   │ vault_key       │  │ restrictions    │  │ title               │ │   │
│   │   │ recovery_       │  │ (encrypted)     │  │ (encrypted)         │ │   │
│   │   │ encrypted_      │  │ cuisine_prefs   │  │ skills              │ │   │
│   │   │ vault_key       │  │ (encrypted)     │  │ (encrypted)         │ │   │
│   │   │                 │  │ monthly_budget  │  │ experience_level    │ │   │
│   │   │                 │  │ (encrypted)     │  │ (encrypted)         │ │   │
│   │   └─────────────────┘  └─────────────────┘  └─────────────────────┘ │   │
│   │                                                                      │   │
│   │   ⚠️ Server only stores ciphertext - cannot decrypt without key     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Consent Protocol Flow

### Data Collection Flow

```
┌──────────┐   ┌─────────────┐   ┌───────────────┐   ┌────────────────┐   ┌───────────┐
│   User   │   │   Next.js   │   │  Orchestrator │   │  Domain Agent  │   │   Vault   │
│          │   │  /api/chat  │   │    (10000)    │   │  (10001/10002) │   │           │
└────┬─────┘   └──────┬──────┘   └───────┬───────┘   └───────┬────────┘   └─────┬─────┘
     │                │                   │                   │                  │
     │ "Set up food"  │                   │                   │                  │
     │───────────────►│                   │                   │                  │
     │                │    POST /agent/   │                   │                  │
     │                │────────chat───────►                   │                  │
     │                │                   │                   │                  │
     │                │                   │ Classify intent   │                  │
     │                │                   │ Create TrustLink  │                  │
     │                │                   │──────────────────►│                  │
     │                │                   │                   │                  │
     │                │◄──────Delegation info + TrustLink─────│                  │
     │                │                   │                   │                  │
     │◄───Agent starts conversation───────│                   │                  │
     │                │                   │                   │                  │
     │ Multi-turn conversation            │                   │                  │
     │◄──────────────►│                   │                   │                  │
     │                │                   │                   │ (collecting data)│
     │                │                   │                   │                  │
     │ "Save"         │                   │                   │                  │
     │───────────────►│                   │                   │                  │
     │                │───────────────────┼───────────────────►                  │
     │                │                   │                   │                  │
     │                │                   │                   │ issue_token()    │
     │                │                   │                   │──────────────────►
     │                │                   │                   │                  │
     │◄────────consent_token + collected_data─────────────────│                  │
     │                │                   │                   │                  │
     │ Encrypt locally│                   │                   │                  │
     │ (vault key)    │                   │                   │                  │
     │                │                   │                   │                  │
     │ POST /api/vault/store-preferences──►                   │                  │
     │ (userId, encrypted_data, consent_token)                │                  │
     │                │                   │                   │                  │
     │                │ validate_token()  │                   │                  │
     │                │───────────────────┼───────────────────┼─────────────────►│
     │                │                   │                   │                  │
     │                │                   │                   │ if valid: INSERT │
     │                │                   │                   │                  │
     │◄───────────────"Saved successfully"─────────────────────────────────────┘
     │
```

---

## 🔑 Key Derivation

### Passphrase to Vault Key

```
User Passphrase
      │
      ▼
  PBKDF2
  ├── Iterations: 100,000
  ├── Salt: User-specific
  └── Algorithm: SHA-256
      │
      ▼
AES-256 Vault Key
      │
      ├── Stored in React Context (memory only, XSS protection)
      ├── Session cookie (httpOnly, Firebase Admin SDK)
      └── NEVER stored in sessionStorage or sent to server
```

### Recovery Key Flow

```
Random 256-bit Recovery Key
      │
      ├── Display to user: HRK-XXXX-XXXX-XXXX-XXXX
      │
      ▼
  PBKDF2 (100k iterations)
      │
      ▼
AES-256 Recovery Key
      │
      ▼
Encrypt(Vault Key, Recovery Key) → recovery_encrypted_vault_key
      │
      └── Stored in database (allows key recovery)
```

---

## 🤖 Agent Port Mapping

| Port      | Agent         | Scope                                                 |
| --------- | ------------- | ----------------------------------------------------- |
| **10000** | Orchestrator  | Intent detection, routing                             |
| **10001** | Food & Dining | `VAULT_WRITE_FOOD`, `VAULT_READ_FOOD`                 |
| **10002** | Professional  | `VAULT_WRITE_PROFESSIONAL`, `VAULT_READ_PROFESSIONAL` |
| 10003     | Identity      | `AGENT_IDENTITY_VERIFY`                               |
| 10004     | Shopping      | `AGENT_SHOPPING_PURCHASE`                             |
| **8000**  | FastAPI Dev   | All agent endpoints                                   |

---

## 📦 HushhMCP Core Modules

### consent/token.py

```python
def issue_token(user_id, agent_id, scope) -> HushhConsentToken:
    """Issue a signed consent token."""
    raw = f"{user_id}|{agent_id}|{scope}|{issued_at}|{expires_at}"
    signature = hmac.new(SECRET_KEY, raw, sha256).hexdigest()
    return HushhConsentToken(token=f"HCT:{base64(raw)}.{signature}")

def validate_token(token_str, expected_scope) -> Tuple[bool, str, HushhConsentToken]:
    """Validate signature, scope, and expiration."""
    if token in revoked_tokens: return False, "Revoked", None
    if not hmac.compare_digest(sig, expected): return False, "Invalid", None
    if scope != expected_scope: return False, "Scope mismatch", None
    if expired: return False, "Expired", None
    return True, None, token

def revoke_token(token_str) -> None:
    """Add token to revocation registry."""
    _revoked_tokens.add(token_str)
```

### trust/link.py

```python
def create_trust_link(source_agent, target_agent, scope, duration) -> TrustLink:
    """Create A2A delegation link."""
    pass

def verify_trust_link(link) -> bool:
    """Verify TrustLink signature and validity."""
    pass
```

---

## 🔒 Security Compliance

| Principle          | Implementation                                        |
| ------------------ | ----------------------------------------------------- |
| **Consent First**  | `issue_token()` before any vault write                |
| **Scoped Access**  | Domain-specific scopes enforced by `validate_token()` |
| **Data Vaulted**   | AES-256-GCM encryption, server only sees ciphertext   |
| **Zero-Knowledge** | Passphrase → PBKDF2 → Key (client-only)               |
| **Auditability**   | `consent_audit` table logs all token operations       |

---

## 📂 Directory Structure

```
consent-protocol/
├── server.py              # FastAPI entry point (80 lines)
├── mcp_server.py          # MCP Server entry point (170 lines)
├── consent_db.py          # DB compatibility shim
│
├── api/                   # FastAPI Route Modules
│   ├── models/
│   │   └── schemas.py     # All Pydantic models
│   └── routes/
│       ├── health.py      # Health check endpoints
│       ├── agents.py      # Agent chat endpoints
│       ├── consent.py     # Consent management
│       ├── developer.py   # Developer API v1
│       └── session.py     # Session token management
│
├── mcp_modules/           # MCP Server Modules
│   ├── config.py          # MCP configuration
│   ├── resources.py       # MCP resources
│   └── tools/
│       ├── definitions.py # Tool JSON schemas
│       ├── consent_tools.py
│       ├── data_tools.py
│       └── utility_tools.py
│
├── db/                    # Database Modules
│   ├── connection.py      # Pool management
│   ├── consent.py         # Consent event insertion
│   ├── queries.py         # Pending/active/audit queries
│   └── migrate.py         # Modular migration script
│
├── shared/                # Shared Utilities
│   └── mock_data.py       # Development mock data
│
└── hushh_mcp/             # Core Protocol (UNTOUCHED)
    ├── agents/
    │   ├── orchestrator/  # Intent routing
    │   ├── food_dining/   # HushhFoodDiningAgent
    │   └── professional_profile/
    ├── consent/
    │   └── token.py       # issue, validate, revoke
    ├── trust/
    │   └── link.py        # TrustLinks for A2A
    ├── vault/
    │   └── encrypt.py     # Encryption primitives
    ├── constants.py       # ConsentScope, AGENT_PORTS
    ├── config.py          # Environment loading
    └── types.py           # HushhConsentToken, etc.
```

---

## 🧪 API Endpoints

### Agent Chat

```bash
POST /api/agents/food-dining/chat
POST /api/agents/professional-profile/chat
```

### Developer API (v1)

```bash
POST /api/v1/request-consent   # Request user consent
POST /api/v1/food-data         # Get food data (with token)
POST /api/v1/professional-data # Get professional data (with token)
GET  /api/v1/list-scopes       # List available scopes
```

---

## 🛠️ Database Migration

```bash
# Modular per-table migrations
python db/migrate.py --table consent_audit     # Single table
python db/migrate.py --consent                 # All consent tables
python db/migrate.py --clear consent_audit     # Clear table
python db/migrate.py --full                    # Full reset (DESTRUCTIVE!)
python db/migrate.py --status                  # Show summary
```

---

_Version: 3.0 | Updated: December 2025 | Modular Architecture Release_
