<p align="center">
  <img src="https://img.shields.io/badge/Hushh-Personal_Data_Agents-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAydjEwbTAgMHY2bTAgLTZsLTQgNG0wIC00bDQgNCIvPjwvc3ZnPg==" alt="Hushh Badge"/>
  <br/>
  <img src="https://img.shields.io/badge/Consent_Protocol-v1.0-success?style=flat-square" alt="Protocol"/>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square" alt="Encryption"/>
  <img src="https://img.shields.io/badge/Zero_Knowledge-✓-green?style=flat-square" alt="Zero Knowledge"/>
  <img src="https://img.shields.io/badge/Open_Source-MIT-orange?style=flat-square" alt="License"/>
</p>

<h1 align="center">🤫 Hushh - Personal Data Agents</h1>

<p align="center">
  <strong>Your data. Your vault. Your agents.</strong>
  <br/>
  <em>A consent-first personal data platform where AI works FOR you, not against you.</em>
</p>

---

## 🎯 What is Hushh?

**Hushh** is an open-source **Personal Data Agent (PDA)** system that fundamentally reimagines how AI interacts with your personal data:

| Traditional AI                | Hushh                                |
| ----------------------------- | ------------------------------------ |
| 📤 Sends your data to servers | 🔐 Encrypts locally, never leaves    |
| 🤷 Access without permission  | ✅ Explicit consent for every action |
| 🕵️ Platform owns your data    | 👤 YOU own your data                 |
| 🔓 Plaintext storage          | 🔒 AES-256-GCM encryption            |

### The Flow

```
You → Chat with Agent → Agent asks "Can I save this?" → You approve →
     Data encrypted in YOUR browser → Stored as ciphertext → Only YOU can decrypt
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              HUSHH STACK                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐      ┌──────────────────┐      ┌─────────────────────┐    │
│   │   Next.js   │ ───► │   HushhMCP       │ ───► │   PostgreSQL        │    │
│   │   Frontend  │      │   Python API     │      │   (Encrypted Vault) │    │
│   │             │      │                  │      │                     │    │
│   │  • React    │      │  • FastAPI       │      │  • AES-256-GCM      │    │
│   │  • Tailwind │      │  • Consent Tokens│      │  • Zero-Knowledge   │    │
│   │  • Vault.js │      │  • TrustLinks    │      │  • Cloud SQL        │    │
│   └─────────────┘      └──────────────────┘      └─────────────────────┘    │
│         ▲                      ▲                          ▲                  │
│         │                      │                          │                  │
│         └──────────────────────┼──────────────────────────┘                  │
│                                │                                             │
│                    🔐 Consent Token Required                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 The Consent Protocol

> **"Consent is not a checkbox. It's a contract, a signal, and a programmable boundary."**

### Core Primitives

| Primitive         | Purpose                          | Code                                 |
| ----------------- | -------------------------------- | ------------------------------------ |
| **Consent Token** | Proves user authorized an action | `issue_token()` / `validate_token()` |
| **TrustLink**     | Agent-to-Agent delegation        | `create_trust_link()`                |
| **Vault**         | Encrypted storage                | `encrypt_data()` / `decrypt_data()`  |
| **Operons**       | Reusable logic units             | Stateless functions                  |

### Token Format

```
HCT:base64(user_id|agent_id|scope|issued_at|expires_at).hmac_sha256_signature
```

### Token Flow

```python
# 1. User confirms "Save" in UI
consent_token = issue_token(
    user_id="firebase_user_id",
    agent_id="agent_food_dining",
    scope=ConsentScope.VAULT_WRITE_FOOD
)

# 2. Frontend encrypts data locally
encrypted = await encryptData(preferences, vaultKey)  # Browser-side

# 3. Vault validates token before write
valid, reason, token = validate_token(consent_token, expected_scope)
if not valid:
    raise PermissionError(f"❌ Access denied: {reason}")

# 4. Only then is data stored
db.insert(encrypted_data)  # Server only sees ciphertext
```

---

## 🤖 Agents

### Active Agents

| Agent             | Port  | Description                           | Status     |
| ----------------- | ----- | ------------------------------------- | ---------- |
| **Orchestrator**  | 10000 | Routes user intent to domain agents   | ✅ Active  |
| **Food & Dining** | 10001 | Dietary preferences, cuisines, budget | ✅ Active  |
| **Professional**  | 10002 | Skills, experience, career goals      | ✅ Active  |
| Identity          | 10003 | Email/phone verification              | 🔧 Planned |
| Shopping          | 10004 | Purchase preferences                  | 🔧 Planned |

### Agent Architecture

Each agent follows this structure:

```python
class HushhAgent:
    def __init__(self):
        self.manifest = {
            "name": "agent_food_dining",
            "scopes_required": [ConsentScope.VAULT_WRITE_FOOD]
        }

    def handle_message(self, message, user_id, session_state):
        # Multi-turn conversation flow
        # Returns: response, session_state, consent_token (on save)
        pass

    # On user confirmation:
    consent_token = issue_token(user_id, agent_id, scope)
    # Token returned to frontend → validated before vault write
```

---

## 🔒 Security Model

### Zero-Knowledge Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                    BANKING-LEVEL SECURITY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  New User:                                                       │
│    1. Google OAuth (Identity verification)                       │
│    2. Create Passphrase (Vault encryption)                       │
│    3. Receive Recovery Key (HRK-XXXX-XXXX-XXXX-XXXX)            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   KEY DERIVATION                         │    │
│  │                                                          │    │
│  │  Passphrase → PBKDF2 (100,000 iterations) → AES-256 Key  │    │
│  │                          ↓                               │    │
│  │              Vault Key (React Context, memory only)      │    │
│  │              Session Cookie (httpOnly, Firebase Admin)   │    │
│  │                                                          │    │
│  │  ⚠️ Server NEVER sees passphrase or vault key           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What the Server Sees

| Server Has             | Server Does NOT Have  |
| ---------------------- | --------------------- |
| Encrypted ciphertext   | Your passphrase       |
| Your email (OAuth)     | Your vault key        |
| Consent token metadata | Decrypted preferences |
| Audit logs             | Any plaintext data    |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **PostgreSQL** 14+ (or use Cloud SQL)

### 1. Clone & Install

```bash
git clone https://github.com/hushh/hushh-research.git
cd hushh-research

# Frontend
cd hushh-webapp
npm install

# Backend
cd ../consent-protocol
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy templates
cp hushh-webapp/.env.example hushh-webapp/.env.local

# Required variables:
# NEXT_PUBLIC_FIREBASE_*  (Authentication)
# DATABASE_URL            (PostgreSQL connection)
```

### 3. Start Services

```bash
# Terminal 1: Python API
cd consent-protocol
uvicorn server:app --reload --port 8000

# Terminal 2: Next.js Frontend
cd hushh-webapp
npm run dev
```

### 4. Open http://localhost:3000

---

## 📁 Project Structure

```
hushh-research/
├── 🌐 hushh-webapp/                 # Next.js Frontend
│   ├── app/                         # App Router pages
│   │   ├── api/chat/route.ts        # Chat API → Orchestrator
│   │   ├── dashboard/food/          # Food preferences UI
│   │   └── login/                   # OAuth + Passphrase
│   ├── components/
│   │   ├── chat/                    # AgentChat components
│   │   └── consent/                 # ConsentDialog
│   └── lib/
│       ├── vault/                   # Client-side encryption
│       └── db.ts                    # Vault data operations
│
├── 🐍 consent-protocol/             # Python Backend (Modular)
│   ├── server.py                    # FastAPI entry (80 lines)
│   ├── mcp_server.py                # MCP Server entry (170 lines)
│   │
│   ├── api/                         # FastAPI Route Modules
│   │   ├── models/schemas.py        # All Pydantic models
│   │   └── routes/                  # Modular route handlers
│   │       ├── agents.py            # Agent chat endpoints
│   │       ├── consent.py           # Consent management
│   │       └── developer.py         # Developer API v1
│   │
│   ├── mcp_modules/                 # MCP Server Modules
│   │   ├── config.py                # MCP configuration
│   │   └── tools/                   # Tool handlers
│   │
│   ├── db/                          # Database Modules
│   │   ├── connection.py            # Pool management
│   │   ├── queries.py               # DB queries
│   │   └── migrate.py               # Modular migration script
│   │
│   └── hushh_mcp/                   # Core Protocol (UNTOUCHED)
│       ├── agents/                  # AI Agents
│       │   ├── orchestrator/        # Intent routing
│       │   ├── food_dining/         # 🍽️ Food preferences
│       │   └── professional_profile/# 💼 Career data
│       ├── consent/token.py         # issue_token, validate_token
│       ├── trust/link.py            # TrustLinks (A2A)
│       └── vault/                   # Encryption helpers
│
├── 📚 docs/                         # Documentation
│   ├── technical/                   # Architecture, DB Schema
│   ├── business/                    # Non-technical overview
│   └── ai-context/                  # LLM context
│
└── 📦 consent-protocol/docs/        # Protocol Specification
    ├── manifesto.md                 # Design principles
    ├── consent.md                   # Token lifecycle
    └── agents.md                    # Building agents
```

---

## 📚 Documentation

| Document                                                        | Audience      | Description                |
| --------------------------------------------------------------- | ------------- | -------------------------- |
| [Architecture](./technical/architecture.md)                     | Developers    | System design & data flow  |
| [Database Schema](./technical/database-schema.md)               | Developers    | PostgreSQL table structure |
| [Consent Implementation](./technical/consent-implementation.md) | Developers    | How agents issue tokens    |
| [Design System](./design-system.md)                             | Frontend Devs | Morphy-UX components       |
| [Business Overview](./business/overview.md)                     | Everyone      | Plain-English explanation  |
| [AI Context](./ai-context/system_context.md)                    | AI/LLMs       | Development context        |

---

## 🎨 Design Philosophy

### Core Principles

1. **Consent First** — No action without explicit, cryptographic permission
2. **Zero-Knowledge** — Server never sees plaintext data or keys
3. **Scoped Access** — Agents only access what they're authorized for
4. **Auditability** — Every consent decision is logged
5. **Modularity** — Operons enable composable, testable logic

### UI/UX

- **Glass morphism** — Frosted glass effects
- **Minimal gradients** — Hushh blue/purple palette
- **Ripple on click** — Physical feedback, not hover
- **Mobile-first** — Responsive design

---

## 🧪 Testing

```bash
# Backend tests
cd consent-protocol
pytest tests/

# Frontend build
cd hushh-webapp
npm run build
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>🤫 Hushh — Because your data should work for you.</strong>
  <br/><br/>
  <a href="https://hushh.ai">Website</a> •
  <a href="./technical/architecture.md">Architecture</a> •
  <a href="./business/overview.md">How It Works</a>
</p>
