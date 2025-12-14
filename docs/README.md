# 🤫 Hushh - Personal Data Agent System

> **Your data. Your vault. Your agents.**

A consent-first personal data platform where AI agents work FOR you, not against you.

---

## 🚀 What is Hushh?

Hushh is an **open-source Personal Data Agent (PDA)** system that:

- 🔐 **Encrypts your data** with keys only YOU control
- 🤖 **Deploys AI agents** that learn your preferences
- ✅ **Requires explicit consent** for every action
- 🏦 **Uses banking-grade security** (AES-256, PBKDF2)

```
You → Chat with Agent → Agent asks "Can I save this?" → You approve → Data encrypted → Stored safely
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HUSHH STACK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Frontend          Protocol            Storage                  │
│   ┌─────────┐      ┌─────────────┐     ┌─────────────────┐     │
│   │ Next.js │ ←──→ │  HushhMCP   │ ←──→ │  PostgreSQL    │     │
│   │ React   │      │   FastAPI   │     │  (Encrypted)   │      │
│   └─────────┘      └─────────────┘     └─────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Component            | Tech                        | Purpose                          |
| -------------------- | --------------------------- | -------------------------------- |
| **hushh-webapp**     | Next.js 15, React, Tailwind | User interface                   |
| **consent-protocol** | Python, FastAPI             | Agent logic & consent validation |
| **Vault**            | PostgreSQL + AES-256-GCM    | Encrypted data storage           |

---

## 🎯 Core Principles

| Principle           | What it means                                      |
| ------------------- | -------------------------------------------------- |
| **Consent First**   | No action without user approval                    |
| **Scoped Access**   | Agents only access what they need                  |
| **Data is Vaulted** | Everything encrypted, keys never leave your device |
| **Zero-Knowledge**  | Server never sees your passphrase                  |
| **Auditability**    | Every consent decision is logged                   |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### 1. Clone & Install

```bash
git clone https://github.com/hushh/hushh-research.git
cd hushh-research

# Frontend
cd hushh-webapp
npm install
npm run dev

# Protocol (new terminal)
cd ../consent-protocol
pip install -r requirements.txt
python -m hushh_mcp.agents.orchestrator
```

### 2. Environment Setup

```bash
# Copy environment template
cp hushh-webapp/.env.example hushh-webapp/.env.local

# Required variables:
# - NEXT_PUBLIC_FIREBASE_* (Auth)
# - DATABASE_URL (PostgreSQL)
```

### 3. Database Migration

```bash
cd hushh-webapp
node scripts/run-migration.mjs
```

### 4. Open http://localhost:3000

---

## 📁 Project Structure

```
hushh-research/
├── hushh-webapp/           # 🌐 Next.js Frontend
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   ├── lib/vault/          # Client-side encryption
│   └── lib/morphy-ux/      # Design system
│
├── consent-protocol/       # 🐍 Python Backend (ACTIVE)
│   ├── hushh_mcp/
│   │   ├── agents/         # AI Agents (Orchestrator, Food, Professional)
│   │   ├── operons/        # Reusable logic units
│   │   ├── consent/        # Token issuance & validation
│   │   ├── trust/          # Agent-to-Agent trust
│   │   └── vault/          # Encryption helpers
│
├── docs/                   # 📚 Documentation
│   ├── technical/          # Architecture, Database Schema
│   ├── business/           # Roadmap, Non-technical Overview
│   └── ai-context/         # AI/LLM Context
│
└── iwebtechno-code/        # 📦 Reference Implementation
```

---

## 🤖 Current Agents

| Agent             | Port  | Purpose                                |
| ----------------- | ----- | -------------------------------------- |
| **Orchestrator**  | 10000 | Routes user intent to domain agents    |
| **Food & Dining** | 10001 | Dietary preferences, cuisines, budgets |
| **Professional**  | 10002 | Skills, experience, career goals       |

---

## 🔐 Security Model

### Authentication Flow

```
New User:    Google OAuth → Create Passphrase → Recovery Key
Return User: Google OAuth → Enter Passphrase → Dashboard
Fallback:    Recovery Key (HRK-XXXX-XXXX-XXXX-XXXX)
```

### Key Derivation

```
Passphrase → PBKDF2 (100k iterations) → AES-256 Vault Key → sessionStorage only
```

**The server NEVER sees your vault key or passphrase.**

---

## 📚 Documentation

| Document               | Audience   | Link                                                           |
| ---------------------- | ---------- | -------------------------------------------------------------- |
| Architecture           | Developers | [technical/architecture.md](./technical/architecture.md)       |
| Database Schema        | Developers | [technical/database-schema.md](./technical/database-schema.md) |
| Non-Technical Overview | Everyone   | [business/overview.md](./business/overview.md)                 |
| AI Context             | LLMs       | [ai-context/system_context.md](./ai-context/system_context.md) |

---

## 🛠️ Development

### Run Tests

```bash
cd consent-protocol
pytest tests/
```

### Build Production

```bash
cd hushh-webapp
npm run build
```

### Database Reset

```bash
node scripts/run-migration.mjs
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

MIT License - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <b>🤫 Hushh - Because your data should work for you.</b>
</p>
