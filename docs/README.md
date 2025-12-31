<p align="center">
  <img src="https://img.shields.io/badge/Hushh-Personal_Data_Agents-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAydjEwbTAgMHY2bTAgLTZsLTQgNG0wIC00bDQgNCIvPjwvc3ZnPg==" alt="Hushh Badge"/>
  <br/>
  <img src="https://img.shields.io/badge/On_Device_AI-MLX_/_Gemma-purple?style=flat-square" alt="On-Device"/>
  <img src="https://img.shields.io/badge/Consent_Protocol-v1.0-success?style=flat-square" alt="Protocol"/>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square" alt="Encryption"/>
  <img src="https://img.shields.io/badge/Zero_Knowledge-✓-green?style=flat-square" alt="Zero Knowledge"/>
  <img src="https://img.shields.io/badge/Local_First-✓-orange?style=flat-square" alt="Local First"/>
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

| Traditional AI                | Hushh                                |
| ----------------------------- | ------------------------------------ |
| 📤 Sends your data to servers | 📱 AI runs on YOUR device            |
| 🌐 Requires internet          | ✈️ Works completely offline          |
| 🤷 Access without permission  | ✅ Explicit consent for every action |
| 🕵️ Platform owns your data    | 👤 YOU own your data                 |
| 🔓 Data on their servers      | 🔒 Data encrypted on YOUR phone      |

### The Flow (On-Device)

```
You → Chat with Agent → Agent asks "Can I save this?" → You approve with FaceID →
     Data encrypted on YOUR device → Stored in local vault → Never leaves your phone
```

---

## 📱 On-Device AI Architecture

Hushh runs AI directly on your phone — no cloud required:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           ON-DEVICE AI STACK                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│   │        iOS (Apple Silicon)       │  │          Android                 │   │
│   │  ┌────────────────────────────┐  │  │  ┌────────────────────────────┐ │   │
│   │  │   Apple Intelligence       │  │  │  │   MediaPipe LLM API        │ │   │
│   │  │   (iOS 18+) OR MLX Swift   │  │  │  │   + Gemma Models           │ │   │
│   │  │   via Custom Plugin        │  │  │  │   via Custom Plugin        │ │   │
│   │  └────────────────────────────┘  │  │  └────────────────────────────┘ │   │
│   └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                          │                              │                     │
│                          └──────────────┬───────────────┘                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │          CAPACITOR NATIVE PLUGINS (HushhAI, HushhMCP)                │   │
│   │                                                                      │   │
│   │  • Bridge between WebView and native AI frameworks                  │   │
│   │  • Consent-first tool access via HushhMCP                           │   │
│   │  • @PluginMethod / CAPPluginMethod annotations                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    LOCAL ENCRYPTED VAULT                             │   │
│   │                                                                      │   │
│   │  • SQLite with AES-256-GCM encryption                               │   │
│   │  • Keys stored in Keychain (iOS) / Keystore (Android)               │   │
│   │  • Data NEVER leaves device unless user opts-in to cloud sync       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Approach

| Platform    | Framework                    | Integration Method                           |
| ----------- | ---------------------------- | -------------------------------------------- |
| **iOS**     | Apple Intelligence (iOS 18+) | Native support, no custom model needed       |
| **iOS**     | MLX Swift (custom models)    | Custom Capacitor plugin wrapping MLXLMCommon |
| **Android** | MediaPipe LLM Inference API  | Custom Capacitor plugin with tasks-genai     |
| **Both**    | `@capgo/capacitor-llm`       | Community plugin for on-device LLM           |

### Platform Availability

| Feature                | Web | iOS Native                  | Android Native       |
| ---------------------- | --- | --------------------------- | -------------------- |
| **On-Device LLM**      | ❌  | ✅ Apple Intelligence / MLX | ✅ MediaPipe + Gemma |
| **Local SQLite Vault** | ❌  | ✅                          | ✅                   |
| **Offline Mode**       | ❌  | ✅ Full                     | ✅ Full              |
| **Cloud Vault**        | ✅  | ✅ (opt-in)                 | ✅ (opt-in)          |
| **Biometric Auth**     | ❌  | ✅ FaceID                   | ✅ Fingerprint       |

---

## 🤖 Agents

### Active Agents

| Agent             | Port  | Description                             | Status     |
| ----------------- | ----- | --------------------------------------- | ---------- |
| **Orchestrator**  | 10000 | Routes user intent to domain agents     | ✅ Active  |
| **Agent Kai**     | 10003 | **PRIMARY** — Investment analysis       | ✅ Active  |
| **Food & Dining** | 10001 | Dietary preferences, location favorites | ✅ Active  |
| **Professional**  | 10002 | Skills, experience, career goals        | ✅ Active  |
| Identity          | 10004 | Email/phone verification                | 🔧 Planned |
| Shopping          | 10005 | Purchase preferences                    | 🔧 Planned |

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

- **Node.js** 18+
- **Python** 3.10+
- **PostgreSQL** 14+ (for cloud mode only)
- **Xcode 15+** (for iOS development)
- **Android Studio** (for Android development)

### 1. Clone & Install

```bash
git clone https://github.com/hushh/hushh-research.git
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
uvicorn server:app --reload --port 8000

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
│   │       │   └── Plugins/                 # Native Plugins
│   │       │       ├── HushhAuthPlugin.swift
│   │       │       ├── HushhVaultPlugin.swift
│   │       │       ├── HushhConsentPlugin.swift
│   │       │       ├── HushhAIPlugin.swift  # MLX/Apple Intelligence
│   │       │       └── ...
│   │       └── App.xcodeproj
│   │
│   └── 📱 android/                  # Android Native (Capacitor)
│       └── app/src/main/
│           ├── java/com/hushh/pda/
│           │   ├── MainActivity.kt          # Plugin registration
│           │   └── plugins/                 # Native Plugins
│           │       ├── HushhAuth/HushhAuthPlugin.kt
│           │       ├── HushhVault/HushhVaultPlugin.kt
│           │       ├── HushhConsent/HushhConsentPlugin.kt
│           │       ├── HushhAI/HushhAIPlugin.kt  # MediaPipe+Gemma
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

## 🔌 Native AI Plugin Architecture

### iOS: Apple Intelligence / MLX Swift

```swift
// ios/App/App/Plugins/HushhAIPlugin.swift
import Capacitor
import MLX        // For custom models
import MLXLMCommon

@objc(HushhAIPlugin)
public class HushhAIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HushhAIPlugin"
    public let jsName = "HushhAI"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "generateResponse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    private var model: LLMModel?

    @objc func generateResponse(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("Missing prompt")
            return
        }

        Task {
            // Option 1: Use Apple Intelligence (iOS 18+)
            // Option 2: Use MLX with custom model
            let response = try await model?.generate(prompt: prompt)
            call.resolve(["response": response ?? ""])
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        // Check if Apple Intelligence or MLX model is available
        call.resolve(["available": true])
    }
}
```

### Android: MediaPipe + Gemma

```kotlin
// android/app/src/main/java/com/hushh/pda/plugins/HushhAI/HushhAIPlugin.kt
package com.hushh.pda.plugins.HushhAI

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mediapipe.tasks.genai.llminference.*

@CapacitorPlugin(name = "HushhAI")
class HushhAIPlugin : Plugin() {
    private var llmInference: LlmInference? = null

    override fun load() {
        super.load()
        // Model stored in app's files directory (downloaded post-install)
        val modelPath = context.filesDir.resolve("gemma-2b-it-q4.bin").absolutePath

        if (File(modelPath).exists()) {
            val options = LlmInference.LlmInferenceOptions.builder()
                .setModelPath(modelPath)
                .setMaxTokens(256)
                .build()
            llmInference = LlmInference.createFromOptions(context, options)
        }
    }

    @PluginMethod
    fun generateResponse(call: PluginCall) {
        val prompt = call.getString("prompt") ?: run {
            call.reject("Missing prompt")
            return
        }

        val response = llmInference?.generateResponse(prompt) ?: ""
        val ret = JSObject()
        ret.put("response", response)
        call.resolve(ret)
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", llmInference != null)
        call.resolve(ret)
    }
}
```

### TypeScript Interface

```typescript
// lib/capacitor/index.ts
import { registerPlugin } from "@capacitor/core";

export interface HushhAIPlugin {
  generateResponse(options: { prompt: string }): Promise<{ response: string }>;
  isAvailable(): Promise<{ available: boolean }>;
}

export const HushhAI = registerPlugin<HushhAIPlugin>("HushhAI");
```

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
  <a href="./vision/kai/">Agent Kai</a> •
  <a href="./business/overview.md">How It Works</a>
</p>
