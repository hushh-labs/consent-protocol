# Hushh - How It Works

> A plain-English guide for anyone to understand Hushh

---

## What is Hushh?

Hushh is your **Personal Data Agent (PDA)** - a fiduciary intelligence that works for YOU.

> _"Hushh is the agent you would hire if your data were your business."_

### The Problem We Solve

Every app today collects your data - your preferences, habits, investments. But:

- You don't know what they store
- You can't access it
- You can't control who sees it
- They optimize for their profits, not your outcomes

**Hushh flips this.** Your data lives in YOUR vault. Agents work FOR you, bound by consent.

### What Makes Hushh Different

| Traditional Apps            | Hushh                        |
| --------------------------- | ---------------------------- |
| Your data on their servers  | Your data on YOUR device     |
| AI runs in the cloud        | AI runs on your phone        |
| Can't work offline          | Works completely offline     |
| Company can read your data  | Zero-knowledge encryption    |
| Shares data with "partners" | Never shares without consent |

---

## 🔒 On-Device AI: Your Data Never Leaves

> **⚠️ Roadmap Feature**: On-device AI is a future implementation planned for Phase 1-4. Current architecture uses hybrid cloud model with E2E encryption.

Hushh plans to use cutting-edge on-device AI that runs entirely on your phone:

| Platform    | Technology   | What It Means                 |
| ----------- | ------------ | ----------------------------- |
| **iPhone**  | Apple MLX    | AI runs on your iPhone's chip |
| **Android** | Google Gemma | AI runs locally via MediaPipe |

**Why this matters:**

1. **Privacy**: Your data never leaves your device
2. **Speed**: No waiting for internet response
3. **Offline**: Works without connection
4. **Security**: No cloud servers to hack

**Current Architecture (Hybrid Cloud):**

- Data is encrypted client-side with AES-256-GCM
- Encrypted data is stored in PostgreSQL (Supabase)
- Server stores only ciphertext - cannot decrypt user data
- Token-based consent ensures agents only access what you authorize

---

## Our Product Focus

### 🎯 Agent Kai — PRIMARY (Investor Intelligence)

> _"Decide like a committee, carry it in your pocket."_

Kai brings an investment committee in silicon to every iPhone. Three specialist agents analyze, debate, and deliver a **Buy/Hold/Reduce decision with receipts**.

| Agent           | Focus                        | Tools                     |
| --------------- | ---------------------------- | ------------------------- |
| **Fundamental** | 10-K/10-Q financial analysis | SEC RAG retrieval         |
| **Sentiment**   | News, earnings calls         | Reflection summarization  |
| **Valuation**   | P/E ratios, returns          | Deterministic calculators |

> [!IMPORTANT] > **Agent Kai is an EDUCATIONAL TOOL, not investment advice.**
> Always consult a licensed financial professional before making investment decisions.

**Key Differentiator:** Every recommendation comes with receipts — sources, math, dissent, and risk-persona fit.

---

### 🍽️ Food & Dining — SECONDARY (Agentic Commerce)

Demonstrates the consent-aware agent model for everyday transactions:

- Remember dietary preferences, allergies, budgets
- **Location Favorites**: Save Home, Work, and custom addresses
- Order from restaurants with full consent trail
- AP2 Protocol integration for secure agent payments

---

## How Does It Work?

### 1. Your Local Vault

When you create a Hushh account:

```
📱 You → Sign In → Create a passphrase → Done!
```

Your passphrase encrypts everything on YOUR device. **We never see it.**

| Storage Mode   | Description                   | Default?    |
| -------------- | ----------------------------- | ----------- |
| **Local-Only** | Data stays on your phone only | ✅ Yes      |
| **Cloud Sync** | E2E encrypted backup (opt-in) | ❌ Optional |

### 2. AI Agents (Work FOR You)

| Agent               | What It Does                                |
| ------------------- | ------------------------------------------- |
| 📈 **Kai**          | Explainable investment analysis with debate |
| 🍕 **Food**         | Remember dietary preferences, order food    |
| 💼 **Professional** | Store skills, experience, career goals      |

These agents work FOR you, not for platforms or advertisers.

### 3. Permission System

Before any agent can access your data, you see a permission prompt:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 Permission Request                                          │
│                                                                  │
│  "Agent Kai wants to:                                           │
│   • Analyze stocks you request                                  │
│   • Remember your risk profile                                  │
│   • Store decision history on your device"                      │
│                                                                  │
│  ⚠️ Kai will NEVER:                                             │
│   • Execute trades without explicit consent                     │
│   • Share your data with third parties                          │
│                                                                  │
│  [Deny]                         [Approve with FaceID 👆]        │
└─────────────────────────────────────────────────────────────────┘
```

**You choose. Always.**

---

## Security - In Plain English

### Your Passphrase

| What We Know             | What We DON'T Know  |
| ------------------------ | ------------------- |
| Your email (for login)   | Your passphrase     |
| That you have an account | Your vault contents |
| Nothing else             | Your data           |

### Consent-First by Design (Not Just Compliance)

**Traditional apps** ask for permission once, then access your data anytime:
```
You: "Ok, you can access my photos" [checkbox]
App: Accesses photos 24/7 without asking again
```

**Hushh uses cryptographic consent tokens:**
```
You: Unlock vault → Backend issues VAULT_OWNER token (24h)
App: Every data access validates your token
Token expires → App must ask again
```

**Why this matters:**
- ✅ **Auditable**: Every access logged with token validation
- ✅ **Revocable**: Lock vault → token instantly invalid
- ✅ **Time-Bound**: Tokens expire after 24 hours
- ✅ **Cryptographic**: No way to fake or bypass token validation
- ✅ **Compliance-Ready**: Export your complete access history

### If You Forget Your Passphrase

When you first sign up, you get a **Recovery Key** like:

```
HRK-A1B2-C3D4-E5F6-G7H8
```

Keep this somewhere safe (write it down, save in password manager). It's your backup key.

### Why This Is Safe

1. **Zero-Knowledge**: We can't read your data even if we wanted to
2. **On-Device Encryption**: AES-256-GCM (same as banks)
3. **Local-First**: Data stays on your device by default
4. **Your Control**: You can delete everything anytime
5. **Token-Based**: All access requires your cryptographic consent
6. **Complete Audit**: Export your access log anytime for transparency

---

## ⚖️ Legal & Privacy Compliance

### About the Companies

<!-- TODO: LEGAL REVIEW REQUIRED - Finalize entity names after legal paperwork -->

Hushh is built through a collaboration between entities in the Hushh ecosystem:

| Entity                         | Website       | Role                                     |
| ------------------------------ | ------------- | ---------------------------------------- |
| **[LEGAL ENTITY NAME - TBD]**  | [TBD]         | Operating entity for Agent Kai           |
| **Hushh Technology Fund L.P.** | hushhtech.com | Delaware L.P. hedge fund (SEC compliant) |

> **PENDING LEGAL REVIEW**: The exact legal entity structure will be finalized upon completion of partnership/entity paperwork.

Agent Kai is an **educational tool**. It is NOT part of Hushh Technology Fund L.P.'s investment advisory services.

### USA Regulations

| Regulation                 | How Hushh Complies                             |
| -------------------------- | ---------------------------------------------- |
| **CCPA/CPRA** (California) | Full data transparency, deletion rights        |
| **SEC Regulations**        | Kai is educational only, not investment advice |
| **Consumer Protection**    | Clear pricing, receipts, cancellation rights   |

### Your Rights

- **Know**: See all data we have about you
- **Delete**: One-tap deletion, both local and cloud
- **Control**: Every data access requires your consent
- **Port**: Export all your data anytime

---

## Target Audience

**Privacy-Conscious Individuals**

People who are:

- Highly private
- Security-focused
- Expect fiduciary duty
- Protective of their digital footprint
- Want AI that works FOR them, not against them

---

## Frequently Asked Questions

### "Can Hushh employees read my data?"

**No.** Your data is encrypted with YOUR passphrase, on YOUR device. We never see the passphrase or your data.

### "How is Kai different from other investing apps?"

1. **Runs on-device**: Analysis never leaves your phone
2. **Shows the debate**: Three agents discuss, you see why
3. **Receipts, not ratings**: Sources, math, dissent for every recommendation
4. **Educational only**: We don't give investment advice

### "What if Hushh goes out of business?"

You can export all your data anytime. Decision artifacts are stored on-device. It's YOUR data.

### "Is this really free?"

Basic features are free. Pro features (advanced analysis, priority processing) will be subscription-based.

### "Why should I trust you?"

- Data stays on YOUR device by default (local-first)
- We use industry-standard encryption
- We never sell your data (that's literally our entire point)
- Every decision has a complete audit trail

---

## Getting Started

1. Download Hushh from the App Store (iOS) or Play Store (Android)
2. Sign in with Google
3. Create a strong passphrase
4. **Save your recovery key!**
5. Set your risk profile (for Kai)
6. Save your favorite locations (for Food & Dining)
7. Start using AI that actually works for you

That's it. Private AI in your pocket.

---

_Hushh — Because your data should work for you._
