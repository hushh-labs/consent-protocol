<p align="center">
  <img src="https://img.shields.io/badge/Hushh-Personal_Data_Agents-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAydjEwbTAgMHY2bTAgLTZsLTQgNG0wIC00bDQgNCIvPjwvc3ZnPg==" alt="Hushh Badge"/>
  <br/>
  <img src="https://img.shields.io/badge/Consent_Protocol-v1.0-success?style=flat-square" alt="Protocol"/>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square" alt="Encryption"/>
  <img src="https://img.shields.io/badge/Zero_Knowledge-✓-green?style=flat-square" alt="Zero Knowledge"/>
  <img src="https://img.shields.io/badge/Capacitor_8-Native-orange?style=flat-square" alt="Capacitor"/>
</p>

<h1 align="center">🤫 Hushh - Personal Data Agents</h1>

<p align="center">
  <strong>Your data. Your device. Your agents.</strong>
  <br/>
  <em>A consent-first personal data platform with on-device AI that works FOR you, not against you.</em>
</p>

---

## 🎯 What is Hushh?

**Hushh** is an open-source **Personal Data Agent (PDA)** system that fundamentally reimagines how AI interacts with your personal data:

| Traditional AI | Hushh (Today) | Hushh Vision (Roadmap) |
|----------------|---------------|------------------------|
| 📤 Sends data to servers | 🔒 E2E encrypted (server can't read) | 📱 On-device AI (no cloud) |
| 🤷 Access without permission | ✅ Consent tokens for every action | ✅ Biometric consent |
| 🕵️ Platform owns your data | 👤 YOU own your encryption keys | 👤 Fully local vault |
| 🔓 Plaintext on servers | 🔐 Zero-knowledge backend | 🔐 Nothing leaves device |

### Current Flow (Hybrid Cloud)

```
You → Chat with Agent → Agent asks "Can I save this?" → You approve →
     Data encrypted CLIENT-SIDE → Stored as ciphertext on cloud → 
     Server CANNOT decrypt (zero-knowledge)
```

### Future Flow (On-Device - Roadmap)

```
You → Chat with LOCAL Agent → Agent asks "Can I save this?" → FaceID approval →
     Data encrypted on YOUR device → Stored in LOCAL vault → Never leaves your phone
```

---

## 📱 Mobile Architecture

Hushh uses Capacitor 8 for native iOS and Android apps:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CAPACITOR MOBILE ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     NEXT.JS STATIC EXPORT                            │   │
│   │                                                                      │   │
│   │  • React 19 + TailwindCSS UI                                        │   │
│   │  • Morphy-UX glass design system                                    │   │
│   │  • Platform-aware services (lib/services/)                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │          CAPACITOR NATIVE PLUGINS (8 per platform)                   │   │
│   │                                                                      │   │
│   │  HushhAuth · HushhVault · HushhConsent · HushhIdentity              │   │
│   │  Kai · HushhSync · HushhSettings · HushhKeystore                    │   │
│   │                                                                      │   │
│   │  • Native HTTP calls to Python backend (bypass Next.js proxy)       │   │
│   │  • Keychain/Keystore secure key storage                             │   │
│   │  • FaceID/TouchID biometric authentication                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    PYTHON BACKEND (Cloud Run)                        │   │
│   │                                                                      │   │
│   │  • FastAPI with consent-first validation                            │   │
│   │  • AES-256-GCM encrypted vault storage                              │   │
│   │  • PostgreSQL (Cloud SQL) for production                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Platform Support

| Feature | Web | iOS Native | Android Native | Status |
|---------|-----|------------|----------------|--------|
| **Cloud Vault (E2E Encrypted)** | ✅ | ✅ | ✅ | Live |
| **Native Auth** | Firebase JS | HushhAuth | HushhAuth | Live |
| **Biometric Unlock** | ❌ | ✅ FaceID/TouchID | ✅ Fingerprint | Live |
| **Secure Key Storage** | Web Crypto | Keychain | Keystore | Live |
| **Consent Tokens** | ✅ | ✅ | ✅ | Live |

### Roadmap: On-Device Layer

| Feature | iOS | Android | Status |
|---------|-----|---------|--------|
| **Local SQLite Vault** | CoreData | Room | 🔜 Planned |
| **On-Device LLM** | MLX Framework | MediaPipe + Gemma | 🔜 Planned |
| **Local MCP Server** | HushhMCPPlugin | HushhMCPPlugin | 🔜 Planned |
| **System AI Integration** | Apple Intelligence | Gemini Nano | 🔜 Planned |
| **Full Offline Mode** | ✅ | ✅ | 🔜 Planned |

See [Mobile Documentation](technical/mobile.md#roadmap-on-device-ai-layer) for detailed on-device AI architecture.

---

## 🤖 Agents

### Active Agents

| Agent             | Port  | Description                             | Status     |
| ----------------- | ----- | --------------------------------------- | ---------- |
| **Orchestrator**  | 10000 | Routes user intent to domain agents     | ✅ Active  |
| **Food & Dining** | 10001 | Dietary preferences, location favorites | ✅ Active  |
| **Professional**  | 10002 | Skills, experience, career goals        | ✅ Active  |
| **Shopping**      | 10004 | Purchase preferences                    | 🔧 Planned |
| **Agent Kai**     | 10005 | **PRIMARY** — Investment analysis       | ✅ Active  |

### Primary Focus: Agent Kai

> _"Decide like a committee, carry it in your pocket."_

Kai brings an investment committee in silicon to every iPhone. Three specialist agents analyze, debate, and deliver a **Buy/Hold/Reduce decision with receipts**.

| Agent           | Focus                        | Tools                     |
| --------------- | ---------------------------- | ------------------------- |
| **Fundamental** | 10-K/10-Q financial analysis | SEC RAG retrieval         |
| **Sentiment**   | News, earnings calls         | Reflection summarization  |
| **Valuation**   | P/E ratios, returns          | Deterministic calculators |

> [!IMPORTANT]
> Agent Kai is an **EDUCATIONAL TOOL**, not investment advice. See [Kai Vision](./vision/kai/) for full regulatory compliance details.

---

## 🔐 The Consent Protocol

> **"Consent is not a checkbox. It's a contract, a signal, and a programmable boundary."**

### Core Primitives

| Primitive         | Purpose                          | Code                                 |
| ----------------- | -------------------------------- | ------------------------------------ |
| **Consent Token** | Proves user authorized an action | `issue_token()` / `validate_token()` |
| **TrustLink**     | Agent-to-Agent delegation        | `create_trust_link()`                |
| **Vault**         | Encrypted storage (local-first)  | `encrypt_data()` / `decrypt_data()`  |
| **Operons**       | Reusable logic units             | Stateless functions                  |

### Token Flow

```python
# 1. User confirms "Save" in UI with biometric
consent_token = issue_token(
    user_id="firebase_user_id",
    agent_id="agent_kai",
    scope=ConsentScope.VAULT_WRITE_DECISIONS
)

# 2. Data encrypted on-device
encrypted = await encryptData(decision_card, vaultKey)  # Local only

# 3. Vault validates token before write
valid, reason, token = validate_token(consent_token, expected_scope)
if not valid:
    raise PermissionError(f"❌ Access denied: {reason}")

# 4. Stored in local SQLite vault (default) or cloud (opt-in)
local_db.insert(encrypted_data)
```

---

## 🔒 Security Model

### Four-Layer Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Device Auth      → IDENTITY (FaceID/TouchID/PIN)       │
│ Layer 2: Firebase Auth    → ACCOUNT (who you are)               │
│ Layer 3: Passphrase       → KNOWLEDGE (zero-knowledge vault)    │
│ Layer 4: Consent Token    → PERMISSION (what agents can access) │
└─────────────────────────────────────────────────────────────────┘
```

### What the Server Sees (Cloud Mode Only)

| Server Has             | Server Does NOT Have  |
| ---------------------- | --------------------- |
| Encrypted ciphertext   | Your passphrase       |
| Your email (OAuth)     | Your vault key        |
| Consent token metadata | Decrypted preferences |
| Audit logs             | Any plaintext data    |

### Local-Only Mode (Default)

| On Your Device        | On Our Servers    |
| --------------------- | ----------------- |
| All your data         | Nothing           |
| Your vault key        | Nothing           |
| Decision history      | Nothing           |
| Everything, encrypted | Literally nothing |

---

## ⚖️ Legal & Compliance

### Entity Structure

<!-- TODO: LEGAL REVIEW REQUIRED - Finalize entity names after legal paperwork -->

| Entity                         | Website       | Role                                     |
| ------------------------------ | ------------- | ---------------------------------------- |
| **[LEGAL ENTITY NAME - TBD]**  | [TBD]         | Operating entity for Agent Kai           |
| **Hushh Technology Fund L.P.** | hushhtech.com | Delaware L.P. hedge fund (SEC compliant) |

> [!WARNING] > **PENDING LEGAL REVIEW**: The exact legal entity structure will be finalized upon completion of partnership/entity paperwork.

Agent Kai is an **educational tool**. It is NOT part of Hushh Technology Fund L.P.'s investment advisory services.

### USA Regulations

| Regulation              | How Hushh Complies                                             |
| ----------------------- | -------------------------------------------------------------- |
| **CCPA/CPRA**           | Local-first storage, full deletion rights, transparency        |
| **SEC Regulations**     | Kai is educational only, clear disclaimers, no trade execution |
| **Consumer Protection** | Clear pricing (for Food & Dining), receipts, audit trails      |

See [Architecture - Legal Compliance](./technical/architecture.md#legal--compliance-usa) for details.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Python** 3.11+
- **PostgreSQL** 14+ (for cloud mode only)
- **Xcode 15+** (for iOS development)
- **Android Studio** (for Android development)

### 1. Clone & Install

```bash
git clone https://github.com/hushh-labs/hushh-research.git
cd hushh-research

# Frontend + Capacitor
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
# DATABASE_URL            (PostgreSQL - cloud mode only)
```

### 3. Start Services

```bash
# Terminal 1: Python API
cd consent-protocol
uvicorn server:app --reload --port 8080

# Terminal 2: Next.js Frontend
cd hushh-webapp
npm run dev
```

### 4. Mobile Development

```bash
cd hushh-webapp

# iOS
npx cap sync ios
npx cap open ios

# Android
npx cap sync android
npx cap open android
```

---

## 📁 Project Structure

```
hushh-research/
├── 🐍 consent-protocol/             # Python Backend
│   ├── server.py                    # FastAPI entry
│   ├── mcp_server.py                # MCP Server entry
│   │
│   ├── api/                         # FastAPI Route Modules
│   │   ├── models/schemas.py        # All Pydantic models
│   │   └── routes/                  # Modular route handlers
│   │
│   ├── db/                          # Database Modules
│   │   ├── connection.py            # Pool management
│   │   └── migrate.py               # Migration script
│   │
│   └── hushh_mcp/                   # Core Protocol
│       ├── agents/                  # AI Agents
│       │   ├── orchestrator/        # Intent routing
│       │   ├── kai/                 # 📈 Investment analysis
│       │   ├── food_dining/         # 🍽️ Food preferences
│       │   └── professional_profile/# 💼 Career data
│       ├── consent/token.py         # issue_token, validate_token
│       ├── trust/link.py            # TrustLinks (A2A)
│       └── vault/                   # Encryption helpers
│
├── 🌐 hushh-webapp/                 # Next.js + Capacitor App
│   ├── app/                         # App Router pages
│   │   ├── api/chat/route.ts        # Chat API → Orchestrator
│   │   ├── dashboard/kai/           # Agent Kai UI
│   │   ├── dashboard/food/          # Food preferences UI
│   │   └── login/                   # OAuth + Passphrase
│   │
│   ├── components/                  # React Components
│   │   ├── chat/                    # AgentChat components
│   │   └── consent/                 # ConsentDialog
│   │
│   ├── lib/                         # TypeScript Libraries
│   │   ├── capacitor/               # Plugin interfaces
│   │   │   ├── index.ts             # Plugin registration
│   │   │   └── types.ts             # Type definitions
│   │   ├── services/                # Platform-aware services
│   │   │   ├── api-service.ts       # API routing
│   │   │   ├── auth-service.ts      # Auth abstraction
│   │   │   └── vault-service.ts     # Vault operations
│   │   └── vault/                   # Client-side encryption
│   │
│   ├── capacitor.config.ts          # Capacitor configuration
│   │
│   ├── 📱 ios/                      # iOS Native (Capacitor)
│   │   └── App/
│   │       ├── App/
│   │       │   ├── AppDelegate.swift        # Firebase.configure()
│   │       │   ├── MyViewController.swift   # Plugin registration
│   │       │   └── Plugins/                 # Native Plugins (8 total)
│   │       │       ├── HushhAuthPlugin.swift
│   │       │       ├── HushhVaultPlugin.swift
│   │       │       ├── HushhConsentPlugin.swift
│   │       │       ├── HushhIdentityPlugin.swift
│   │       │       ├── KaiPlugin.swift
│   │       │       └── ...
│   │       └── App.xcodeproj
│   │
│   └── 📱 android/                  # Android Native (Capacitor)
│       └── app/src/main/
│           ├── java/com/hushh/app/
│           │   ├── MainActivity.kt          # Plugin registration
│           │   └── plugins/                 # Native Plugins (8 total)
│           │       ├── HushhAuth/HushhAuthPlugin.kt
│           │       ├── HushhVault/HushhVaultPlugin.kt
│           │       ├── HushhConsent/HushhConsentPlugin.kt
│           │       ├── HushhIdentity/HushhIdentityPlugin.kt
│           │       ├── Kai/KaiPlugin.kt
│           │       └── ...
│           └── res/
│
├── 📚 docs/                         # Documentation
│   ├── technical/                   # Architecture, Mobile, Schema
│   ├── business/                    # Non-technical overview
│   └── vision/                      # Product vision documents
│       ├── kai/                     # Agent Kai vision
│       └── food-dining/             # Food & Dining vision
│
└── README.md                        # This file
```

---

## 🔌 Native Plugins

### 8 Capacitor Plugins (iOS + Android)

| Plugin | Purpose | iOS | Android |
|--------|---------|-----|---------|
| **HushhAuth** | Google/Apple Sign-In, Firebase | ✅ | ✅ |
| **HushhVault** | Encryption, vault operations | ✅ | ✅ |
| **HushhConsent** | Token management, consent flow | ✅ | ✅ |
| **HushhIdentity** | Investor identity resolution | ✅ | ✅ |
| **Kai** | Investment analysis agent | ✅ | ✅ |
| **HushhSync** | Cloud synchronization | ✅ | ✅ |
| **HushhSettings** | App preferences | ✅ | ✅ |
| **HushhKeystore** | Secure key storage | ✅ | ✅ |

See [Mobile Documentation](technical/mobile.md) for full plugin API reference.

---

## 📚 Documentation

| Document                                          | Audience    | Description                   |
| ------------------------------------------------- | ----------- | ----------------------------- |
| [Architecture](./technical/architecture.md)       | Developers  | On-device + cloud design      |
| [Mobile Development](./technical/mobile.md)       | Mobile Devs | MLX, Gemma, Capacitor plugins |
| [Database Schema](./technical/database-schema.md) | Developers  | PostgreSQL + SQLite schema    |
| [Agent Kai Vision](./vision/kai/)                 | Product     | Investment tools + compliance |
| [Food & Dining Vision](./vision/food-dining/)     | Product     | Location favorites + AP2      |
| [Business Overview](./business/overview.md)       | Everyone    | Plain-English explanation     |

---

## 🎨 Design Philosophy

### Core Principles

1. **Local-First** — Data lives on your device by default
2. **Consent First** — No action without explicit, biometric permission
3. **Zero-Knowledge** — Server never sees plaintext data or keys
4. **Scoped Access** — Agents only access what they're authorized for
5. **Auditability** — Every consent decision is logged

### UI/UX

- **Glass morphism** — Frosted glass effects
- **Minimal gradients** — Hushh blue/purple palette
- **Biometric ripple** — FaceID/TouchID feedback
- **Mobile-first** — Native iOS/Android experience

---

## 🧪 Testing

```bash
# Backend tests
cd consent-protocol
pytest tests/

# Frontend build
cd hushh-webapp
npm run build

# Mobile builds
cd hushh-webapp
npx cap sync ios && npx cap open ios
npx cap sync android && npx cap open android
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b YOUR_USERNAME/feat/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin YOUR_USERNAME/feat/amazing-feature`)
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
  <a href="./vision/kai/">Agent Kai</a> •
  <a href="./business/overview.md">How It Works</a>
</p>
