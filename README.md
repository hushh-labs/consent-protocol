<p align="center">
  <img src="https://img.shields.io/badge/🤫_Hushh-Personal_Data_Agents-blueviolet?style=for-the-badge" alt="Hushh"/>
</p>

<h1 align="center">Hushh Research</h1>

<p align="center">
  <strong>Consent-First Personal Data Agent System</strong><br/>
  <em>Your data. Your vault. Your agents.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Protocol-v2.0-success?style=flat-square" alt="Protocol"/>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square" alt="Encryption"/>
  <img src="https://img.shields.io/badge/Zero_Knowledge-✓-green?style=flat-square" alt="Zero Knowledge"/>
  <img src="https://img.shields.io/badge/Consent_First-✓-orange?style=flat-square" alt="Consent First"/>
  <br/>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Capacitor-Native-1199EE?style=flat-square&logo=capacitor&logoColor=white" alt="Capacitor"/>
  <img src="https://img.shields.io/badge/Python-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <br/>
  <img src="https://img.shields.io/badge/MLX-Apple_Silicon-000000?style=flat-square&logo=apple&logoColor=white" alt="MLX"/>
  <img src="https://img.shields.io/badge/AI-Gemini_Nano-4E86F6?style=flat-square&logo=google&logoColor=white" alt="Gemini Nano"/>
  <a href="https://discord.gg/fd38enfsH5"><img src="https://img.shields.io/badge/Discord-Join%20Us-7289da?style=flat-square&logo=discord&logoColor=white" alt="Discord"/></a>
</p>

---

## 🤫 What is Hushh?

**Hushh** is a consent-first platform where AI agents work **for you**, not against you. Every data access requires cryptographic consent tokens—no backdoors, no bypasses, complete audit trails.

```
Traditional AI:  You → Platform → (Platform owns your data)
Hushh:           You → Encrypt → Vault → Token-Gated Agents
```

### Why Consent-First Matters

| Traditional Apps                | Hushh                           |
| ------------------------------- | ------------------------------- |
| Implied consent (buried in TOS) | Cryptographic consent tokens    |
| Platform can access anytime     | Zero access without valid token |
| No audit trail                  | Every access logged             |
| Data on their servers           | Data encrypted on YOUR device   |

---

## 🔒 Security Architecture

### Four-Layer Authentication (Correct Order)

```
Layer 1: Firebase Auth    → OAuth (ACCOUNT - who you are) [Always first]
Layer 2: Vault Unlock     → Passphrase/Recovery Key (KNOWLEDGE)
                            [Current: Passphrase + Recovery Key]
                            [Future: FaceID/TouchID/Passkey primary, passphrase fallback]
Layer 3: VAULT_OWNER Token → Cryptographic consent (DATA ACCESS)
Layer 4: Agent Tokens     → Scoped permissions (OPERATIONS)
```

### Current Implementation

**✅ Implemented Today:**

- Firebase OAuth (Google Sign-In)
- Passphrase-based vault unlock (PBKDF2)
- Recovery key system (HRK-xxxx-xxxx-xxxx-xxxx)
- VAULT_OWNER tokens for data access
- Agent-scoped tokens for operations

**🔜 Future Enhancements:**

- WebAuthn/Passkey support
- FaceID/TouchID direct integration
- Biometric-only unlock (passphrase as fallback)

### VAULT_OWNER Token (Consent-First)

**Every vault data operation requires a VAULT_OWNER token:**

- ✅ Read your food preferences → Token required
- ✅ Write your professional profile → Token required
- ✅ Access your Kai analysis history → Token required
- ❌ No token = No access (even for encrypted data)

**Token Lifecycle:**

1. User unlocks vault → Backend issues VAULT_OWNER token
2. Token stored in memory only (React Context)
3. Backend reuses valid tokens (no duplicates)
4. Token expires after 24 hours
5. All operations logged to `consent_audit` table

**Why this matters for compliance:**

- **CCPA**: Cryptographic proof of user consent
- **GDPR**: Explicit consent mechanism with audit trail
- **SEC**: Complete access log for regulatory review

---

## 🏗️ Quick Overview

| Layer        | Technology           | Purpose                          |
| ------------ | -------------------- | -------------------------------- |
| **Frontend** | Next.js 16, React 19 | Chat UI, Dashboard               |
| **Protocol** | HushhMCP (Python)    | Consent tokens, TrustLinks       |
| **Agents**   | FastAPI              | Food, Professional, Orchestrator |
| **Storage**  | PostgreSQL + AES-256 | Encrypted vault                  |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/hushh/hushh-research.git
cd hushh-research

# Frontend
cd hushh-webapp && npm install && npm run dev

# Backend (new terminal)
cd consent-protocol && pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Open http://localhost:3000
```

---

## 📚 Documentation

| Document                                                              | Description                |
| --------------------------------------------------------------------- | -------------------------- |
| [**🚀 Getting Started**](./GETTING_STARTED.md)                        | Setup and run locally      |
| [**📖 Main Docs**](./docs/README.md)                                  | Complete documentation hub |
| [**🏗️ Architecture**](./docs/technical/architecture.md)               | System design & flows      |
| [**🔐 Consent Protocol**](./docs/technical/consent-implementation.md) | Token lifecycle            |
| [**🔧 Developer API**](./docs/technical/developer-api.md)             | External API access        |
| [**💾 Database Schema**](./docs/technical/database-schema.md)         | PostgreSQL tables          |

---

## 🔐 Core Concepts

### 1. VAULT_OWNER Tokens (Master Consent)

**The vault owner (you) accesses your own data using consent tokens:**

```python
# Backend issues token after vault unlock
token = issue_token(
    user_id="firebase_uid",
    agent_id="self",
    scope=ConsentScope.VAULT_OWNER,
    expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
)

# Every vault operation validates the token
validate_vault_owner_token(token, user_id)
# Checks: signature, expiry, scope, user_id match
# Logs: All validations to consent_audit table
```

### 2. Agent-Scoped Tokens (Limited Access)

```python
# Agent Kai gets scoped token for analysis
kai_token = issue_token(
    user_id="firebase_uid",
    agent_id="agent_kai",
    scope="agent.kai.analyze",  # Limited to analysis only
    expires_in_ms=7 * 24 * 60 * 60 * 1000  # 7 days
)
```

### 3. Zero-Knowledge Encryption (BYOK)

```
Passphrase → PBKDF2 (100k iterations) → AES-256 Key
                                          ↓
                              Stored in browser memory only
                              Server NEVER sees it
```

**Backend receives:** Encrypted ciphertext + consent token  
**Backend validates:** Token (not data—it can't decrypt it)  
**Backend stores:** Ciphertext only

---

## 📁 Structure

```
hushh-research/
├── 🌐 hushh-webapp/           # Next.js Frontend + Capacitor
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── lib/
│   │   ├── capacitor/         # Native plugins (iOS/Android)
│   │   ├── services/          # Platform-aware API services
│   │   └── vault/             # Client-side encryption
│   ├── ios/                   # Native iOS (Swift)
│   └── android/               # Native Android (Kotlin)
│
├── 🐍 consent-protocol/       # Python Backend + Protocol
│   ├── server.py              # FastAPI endpoints
│   ├── hushh_mcp/
│   │   ├── agents/            # Food, Professional, Kai
│   │   ├── consent/           # Token issuance & validation
│   │   └── vault/             # Encryption helpers
│   └── db/                    # PostgreSQL migrations
│
└── 📚 docs/                   # Comprehensive documentation
    ├── technical/             # Developer guides
    ├── business/              # Product & market
    └── vision/                # Long-term roadmap
```

---

## 🎯 Platform Support

| Platform             | Status        | Token Flow                          | Backend Access                |
| -------------------- | ------------- | ----------------------------------- | ----------------------------- |
| **Web (Browser)**    | ✅ Production | Dashboard → Next.js Proxy → Backend | Consent tokens via API routes |
| **iOS (Native)**     | ✅ Production | Dashboard → Swift Plugin → Backend  | Direct with consent tokens    |
| **Android (Native)** | ✅ Production | Dashboard → Kotlin Plugin → Backend | Direct with consent tokens    |

All platforms enforce identical token validation—no platform bypasses.

---

## 👨‍💻 Meet the Founder

**Manish Sainani** ([LinkedIn](https://www.linkedin.com/in/manishsainani/) | [X.com](https://x.com/manishsainani))
_Founder & CEO, [hushh.ai](https://hushh.ai)_

Manish is a former **Google Product Management Director**, where he spent 4+ years leading machine learning product initiatives. Prior to Google, he served as **Senior Director of Machine Learning Products at Splunk** and **Senior Program Manager at Microsoft**, work on Azure Machine Learning. He is the architect behind the **Consent-First** vision, dedicated to returning data sovereignty to the individual.

---

## 🤝 Contributing

1. Fork & clone
2. Create feature branch
3. Make changes
4. Submit PR

---

<p align="center">
  <strong>🤫 Because your data should work for you.</strong>
</p>
