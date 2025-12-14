<p align="center">
  <img src="https://img.shields.io/badge/🤫_Hushh-Personal_Data_Agents-blueviolet?style=for-the-badge" alt="Hushh"/>
</p>

<h1 align="center">Hushh Research</h1>

<p align="center">
  <strong>Consent-First Personal Data Agent System</strong><br/>
  <em>Your data. Your vault. Your agents.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Protocol-v1.0-success?style=flat-square" alt="Protocol"/>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square" alt="Encryption"/>
  <img src="https://img.shields.io/badge/Zero_Knowledge-✓-green?style=flat-square" alt="Zero Knowledge"/>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Python-FastAPI-009688?style=flat-square" alt="FastAPI"/>
</p>

---

## ✨ What is Hushh?

**Hushh** is a privacy-first platform where AI agents work **for you**, not against you. Your data stays encrypted on your terms, and agents need **explicit cryptographic consent** to access it.

```
Traditional AI:  You → Platform → (Platform owns your data)
Hushh:           You → Encrypt → Vault → Agents (with YOUR permission)
```

---

## 🏗️ Quick Overview

| Layer        | Technology           | Purpose                          |
| ------------ | -------------------- | -------------------------------- |
| **Frontend** | Next.js 15, React    | Chat UI, Dashboard               |
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
| [**📖 Main Docs**](./docs/README.md)                                  | Complete documentation hub |
| [**🏗️ Architecture**](./docs/technical/architecture.md)               | System design & flows      |
| [**🔐 Consent Protocol**](./docs/technical/consent-implementation.md) | Token lifecycle            |
| [**🔧 Developer API**](./docs/technical/developer-api.md)             | External API access        |
| [**💾 Database Schema**](./docs/technical/database-schema.md)         | PostgreSQL tables          |
| [**🎨 Design System**](./docs/design-system.md)                       | Morphy-UX components       |

---

## 🔐 Core Concepts

### Consent Token

```python
# Agent issues token when user confirms "Save"
token = issue_token(user_id, agent_id, scope)

# Vault validates before any write
valid, reason, _ = validate_token(token, expected_scope)
```

### Zero-Knowledge Encryption

```
Passphrase → PBKDF2 (100k iterations) → AES-256 Key
                                          ↓
                              Stored in browser only
                              Server NEVER sees it
```

---

## 📁 Structure

```
hushh-research/
├── 🌐 hushh-webapp/          # Next.js Frontend
├── 🐍 consent-protocol/      # Python Agents & Protocol
│   ├── server.py             # FastAPI endpoints
│   └── hushh_mcp/
│       ├── agents/           # Food, Professional, Orchestrator
│       ├── consent/          # Token issuance
│       └── vault/            # Encryption
└── 📚 docs/                  # Documentation
```

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
