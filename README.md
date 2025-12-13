# 🤫 Hushh AI Consent Protocol (HushhMCP)

Welcome to the official Python implementation of the **HushhMCP** — a programmable trust and consent protocol for AI agents. This repo powers the agentic infrastructure for the **Hushh PDA Hackathon**, where real humans give real consent to AI systems acting on their behalf.

> 🔐 Built with privacy, security, modularity, and elegance in mind.

---

## 🧠 What is HushhMCP?

HushhMCP (Hushh Micro Consent Protocol) is the cryptographic backbone for **Personal Data Agents (PDAs)** that can:

- 🔐 Issue & verify **cryptographically signed consent tokens**
- 🔁 Delegate trust across **agent-to-agent (A2A) links**
- 🗄️ Store & retrieve **AES-encrypted personal data**
- 🤖 Operate within well-scoped, revocable, user-issued permissions

Inspired by biology (operons), economics (trust-based contracts), and real-world privacy laws.

---

## 🏗️ Key Concepts

| Concept         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| **Consent Token** | A signed proof that a user granted an agent a specific permission          |
| **TrustLink**     | A time-bound signed relationship between two agents                        |
| **Vault**         | An encrypted datastore with AES-256-GCM for storing user data              |
| **Operons**       | Reusable, modular agent actions — like genes in biology                    |
| **Agents**        | Modular, scoped AI workers that operate on your behalf, with your consent  |

---

## 📦 Folder Structure

```bash
hushh-ai-consent-protocol/
├── hushh_mcp/                # Core protocol logic (modular)
│   ├── config.py             # .env loader + global settings
│   ├── constants.py          # Consent scopes, prefixes, default values
│   ├── types.py              # Pydantic models: ConsentToken, TrustLink, VaultRecord
│   ├── consent/token.py      # issue_token(), validate_token(), revoke_token()
│   ├── trust/link.py         # TrustLink creation + verification
│   ├── vault/encrypt.py      # AES-256-GCM encryption/decryption
│   ├── agents/               # Real & sample agents
│   │   ├── shopping.py       # Uses consent to fetch personalized deals
│   │   └── identity.py       # Validates email + issues TrustLink
│   ├── operons/verify_email.py  # Reusable email validation logic
│   └── cli/generate_agent.py    # CLI to scaffold new agents
├── tests/                   # All pytest test cases
├── .env.example            # Sample environment variables
├── requirements.txt        # All runtime + dev dependencies
├── README.md               # You are here
└── docs/                   # Hackathon + protocol documentation
````

---

## 🚀 Getting Started

### 1. 📥 Clone & Install

```bash
git clone https://github.com/yourname/hushh-ai-consent-protocol.git
cd hushh-ai-consent-protocol
pip install -r requirements.txt
```

### 2. 🔐 Configure Secrets

Create your `.env` file:

```bash
cp .env.example .env
```

And paste in secure keys (generated via `python -c "import secrets; print(secrets.token_hex(32))"`).

---

## 🧪 Running Tests

```bash
pytest
```

Includes full test coverage for:

* Consent issuance, validation, revocation
* TrustLink creation, scope checks
* Vault encryption roundtrip
* Real agent workflows (e.g. shopping, identity)

---

## ⚙️ CLI Agent Generator

Scaffold a new agent with:

```bash
python hushh_mcp/cli/generate_agent.py finance-assistant
```

Outputs:

```bash
hushh_mcp/agents/finance_assistant/index.py
hushh_mcp/agents/finance_assistant/manifest.py
```

---

## 🤖 Sample Agents

### 🛍️ `agent_shopper`

* Requires: `vault.read.email`
* Returns personalized product recommendations

### 🪪 `agent_identity`

* Validates user email
* Issues TrustLink to other agents with scoped delegation

---

## 🔐 Security Architecture

* All **tokens and trust links are stateless + signed** using HMAC-SHA256
* Vault data is **encrypted using AES-256-GCM**, with IV + tag integrity
* Agent actions are **fully gated by scope + revocation checks**
* System is **testable, auditable, and modular**

---

## 📚 Documentation

Explore full guides in `/docs`:

* `docs/index.md` — Overview & roadmap
* `docs/consent.md` — Consent token lifecycle
* `docs/agents.md` — Building custom agents
* `docs/faq.md` — Hackathon questions
* `docs/manifesto.md` — Design philosophy

---

## 💡 Roadmap

* [ ] Add persistent TrustLink registry (e.g. Redis)
* [ ] Extend scope framework for write-level permissions
* [ ] Launch Open Agent Directory
* [ ] Release SDKs for iOS and Android

---

## 🏁 Built For: Hushh PDA Hackathon

* 🎓 Hosted in collaboration with DAV Team and Analytics Club, IIT Bombay
* 💰 INR 1,70,000+ prize pool
* 👩‍💻 Real-world AI agents
* 🚀 Build the infrastructure for programmable trust

---

## 🫱🏽‍🫲 Contributing

* Fork → Build → Pull Request
* Add a test for every feature
* Run `pytest` before submitting

---

## ⚖️ License

MIT — open to the world.

Let’s build a better agentic internet together.

```
