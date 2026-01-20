# Hushh System Architecture

---

## 🎯 Overview

Hushh is a **Consent-First Personal Data Agent System** that gives users complete control over their digital context through cryptographic consent primitives and **on-device AI processing**.

### Design Philosophy

```
"Agents should serve the person — and only when asked to."
"Your data never leaves your device unless you explicitly choose."
```

### The Stack

| Layer             | Technology                   | Purpose                        |
| ----------------- | ---------------------------- | ------------------------------ |
| **On-Device AI**  | MLX (iOS) / Gemma (Android)  | Local LLM inference            |
| **Local Vault**   | SQLite + AES-256-GCM         | Encrypted on-device storage    |
| **Local MCP**     | HushhMCP (on-device)         | Consent protocol for system AI |
| **Frontend**      | Next.js 16, React, Capacitor | User interface                 |
| **Protocol**      | HushhMCP (Python)            | Consent tokens, TrustLinks     |
| **API**           | FastAPI                      | Agent chat endpoints (opt-in)  |
| **Cloud Storage** | PostgreSQL + AES-256-GCM     | Encrypted vault (opt-in sync)  |
| **Auth**          | Firebase + PBKDF2            | Identity + Key derivation      |

---

## ⚠️ Critical: Tri-Flow Enforcement

Every feature that accesses backend data MUST implement all three flows:

| Flow             | Purpose                        | When It Runs             |
| ---------------- | ------------------------------ | ------------------------ |
| **Web Flow**     | Next.js proxy → Python backend | Browser (localhost:3000) |
| **iOS Flow**     | Swift plugin → Python backend  | iOS app (no Next.js)     |
| **Android Flow** | Kotlin plugin → Python backend | Android app (no Next.js) |

### Common Violations

❌ **Component calls fetch() directly**

```typescript
// WRONG: Only works on web
await fetch("/api/vault/food", { ... })
```

❌ **Service missing platform detection**

```typescript
// WRONG: Assumes Next.js always exists
static async getData() {
  return fetch("/api/..."); // Breaks on native
}
```

❌ **Native plugin missing**

```
app/api/feature/route.ts exists ✅
iOS plugin missing ❌
Android plugin missing ❌
Result: Works on web, silent failure on native
```

### Correct Implementation

✅ **Component uses service**

```typescript
import { ApiService } from "@/lib/services/api-service";
await ApiService.getData();
```

✅ **Service detects platform**

```typescript
static async getData() {
  if (Capacitor.isNativePlatform()) {
    return await HushhVault.getData(); // Native plugin
  }
  return fetch("/api/..."); // Next.js proxy
}
```

✅ **All three layers exist**

```
app/api/feature/route.ts ✅
ios/.../HushhFeaturePlugin.swift ✅
android/.../HushhFeaturePlugin.kt ✅
```

**See Also**:

- [Project Context Map](../PROJECT_CONTEXT_MAP.md) - Detailed tri-flow rules
- [Feature Checklist](../FEATURE_CHECKLIST.md) - Implementation guide
- [Component Guidelines](../../hushh-webapp/components/README.md) - Network call ban

---

## 🏗️ On-Device AI Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           ON-DEVICE AI LAYER                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│   │        iOS (Apple Silicon)       │  │          Android                 │   │
│   │  ┌────────────────────────────┐  │  │  ┌────────────────────────────┐ │   │
│   │  │   MLX Framework            │  │  │  │   MediaPipe + Gemma        │ │   │
│   │  │   • A-series/M-series opt  │  │  │  │   • LLM Inference API      │ │   │
│   │  │   • Unified Memory Model   │  │  │  │   • LiteRT runtime         │ │   │
│   │  │   • 4-bit quantization     │  │  │  │   • GPU/NPU acceleration   │ │   │
│   │  │   • MLX Swift integration  │  │  │  │   • Gemini Nano (14+)      │ │   │
│   │  └────────────────────────────┘  │  │  └────────────────────────────┘ │   │
│   └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                          │                              │                     │
│                          └──────────────┬───────────────┘                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │            LOCAL MCP SERVER (Offline HushhMCP)                       │   │
│   │                                                                      │   │
│   │  • Runs on-device (like Claude Desktop MCP pattern)                 │   │
│   │  • Connects to Apple Intelligence / Gemini locally                  │   │
│   │  • Consent-first tool access                                        │   │
│   │  • JSON-RPC 2.0 / stdio transport                                   │   │
│   │  • Same protocol as cloud MCP (code reuse)                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                         │                                     │
│                                         ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    LOCAL ENCRYPTED VAULT                             │   │
│   │                                                                      │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │   │
│   │  │   SQLite DB     │  │   AES-256-GCM   │  │   Keychain/Keystore  │ │   │
│   │  │   (CoreData)    │  │   Encryption    │  │   (Key Storage)      │ │   │
│   │  └─────────────────┘  └─────────────────┘  └──────────────────────┘ │   │
│   │                                                                      │   │
│   │  ⚠️ Data NEVER leaves device unless user opts-in to cloud sync      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ OPT-IN ONLY
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD LAYER (OPT-IN)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Cloud Sync (if user enables)                           │   │
│   │                                                                      │   │
│   │  • Multi-device sync                                                 │   │
│   │  • Cloud backup                                                      │   │
│   │  • E2E encrypted (same BYOK model)                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Online Services (per-request consent)                  │   │
│   │                                                                      │   │
│   │  • SEC filings retrieval (for Kai Fundamental Agent)                │   │
│   │  • News APIs (for Kai Sentiment Agent)                              │   │
│   │  • Restaurant APIs (for Food & Dining ordering)                     │   │
│   │  • Each external call requires explicit user consent                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Platform Availability Matrix

| Feature                | Web App | iOS Native        | Android Native     |
| ---------------------- | ------- | ----------------- | ------------------ |
| **On-Device LLM**      | ❌      | ✅ MLX            | ✅ Gemma/MediaPipe |
| **Local SQLite Vault** | ❌      | ✅                | ✅                 |
| **Local MCP Server**   | ❌      | ✅                | ✅                 |
| **Cloud Vault**        | ✅      | ✅ (opt-in)       | ✅ (opt-in)        |
| **Offline Mode**       | ❌      | ✅ Full           | ✅ Full            |
| **Apple Intelligence** | N/A     | ✅                | N/A                |
| **Gemini Integration** | N/A     | N/A               | ✅                 |
| **Biometric Auth**     | ❌      | ✅ FaceID/TouchID | ✅ Fingerprint     |

---

## 🏗️ System Diagram (Web + Cloud Mode)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              Next.js Frontend (localhost:3000)                       │   │
│   │                                                                      │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│   │   │   Login +    │  │   AgentChat  │  │   Dashboard              │  │   │
│   │   │   Passphrase │  │   Component  │  │   (Decrypted View)       │  │   │
│   │   └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│   │            │                │                        │               │   │
│   │            ▼                ▼                        ▼               │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │              lib/vault/encrypt.ts                            │  │   │
│   │   │        (Client-side AES-256-GCM encryption)                  │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     │ POST /api/chat (via Proxy)
                                     │ (userId + message + sessionState)
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            PROTOCOL LAYER                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │          FastAPI Server (server.py) - localhost:8000                 │   │
│   │                                                                      │   │
│   │   ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │   │
│   │   │  /api/agents/  │  │  /api/agents/  │  │  /api/v1/          │   │   │
│   │   │  food-dining/  │  │  professional- │  │  (Developer API)   │   │   │
│   │   │  chat          │  │  profile/chat  │  │  request-consent   │   │   │
│   │   └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘   │   │
│   │           │                   │                      │              │   │
│   │           └───────────────────┼──────────────────────┘              │   │
│   │                               ▼                                     │   │
│   │   ┌─────────────────────────────────────────────────────────────┐  │   │
│   │   │                    HushhMCP Core                             │  │   │
│   │   │                                                              │  │   │
│   │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │   │
│   │   │  │   consent/  │  │   trust/    │  │   vault/            │  │  │   │
│   │   │  │   token.py  │  │   link.py   │  │   encrypt.py        │  │  │   │
│   │   │  │             │  │             │  │                     │  │  │   │
│   │   │  │ • issue     │  │ • create    │  │ • encrypt_data      │  │  │   │
│   │   │  │ • validate  │  │ • verify    │  │ • decrypt_data      │  │  │   │
│   │   │  │ • revoke    │  │             │  │                     │  │  │   │
│   │   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │   │
│   │   └─────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     │ Encrypted writes only
                                     │ (Validated by consent token)
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE LAYER                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │            PostgreSQL (Cloud SQL) - Encrypted Vault                  │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │   │
│   │   │   vault_keys    │  │   vault_food    │  │   vault_professional│ │   │
│   │   │                 │  │                 │  │                     │ │   │
│   │   │ • user_id       │  │ • user_id       │  │ • user_id           │ │   │
│   │   │ • encrypted_    │  │ • dietary_      │  │ • professional_     │ │   │
│   │   │   vault_key     │  │   restrictions  │  │   title             │ │   │
│   │   │ • recovery_     │  │   (encrypted)   │  │   (encrypted)       │ │   │
│   │   │   encrypted_    │  │ • cuisine_prefs │  │ • skills            │ │   │
│   │   │   vault_key     │  │   (encrypted)   │  │   (encrypted)       │ │   │
│   │   │                 │  │ • monthly_budget│  │ • experience_level  │ │   │
│   │   │                 │  │   (encrypted)   │  │   (encrypted)       │ │   │
│   │   └─────────────────┘  └─────────────────┘  └─────────────────────┘ │   │
│   │                                                                      │   │
│   │   ⚠️ Server only stores ciphertext - cannot decrypt without key     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Local MCP Server (Offline HushhMCP)

The on-device MCP server enables Apple Intelligence and Google Gemini to interact with Hushh data locally:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL MCP CONNECTIONS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐              ┌─────────────────┐              │
│   │ Apple           │              │ Gemini          │              │
│   │ Intelligence    │◄────────────►│ (on Android)    │              │
│   │ (Siri, etc.)    │              │                 │              │
│   └────────┬────────┘              └────────┬────────┘              │
│            │                                │                        │
│            │     JSON-RPC 2.0 / stdio       │                        │
│            │                                │                        │
│            ▼                                ▼                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  LOCAL HUSHH MCP SERVER                      │   │
│   │                                                              │   │
│   │  Tools:                                                      │   │
│   │  • request_consent          (prompt user for permission)     │   │
│   │  • validate_token           (verify consent token)           │   │
│   │  • get_food_preferences     (read dietary data)              │   │
│   │  • get_professional_profile (read work data)                 │   │
│   │  • get_kai_decisions        (read investment history)        │   │
│   │  • delegate_to_agent        (A2A delegation)                 │   │
│   │                                                              │   │
│   │  Resources:                                                  │   │
│   │  • hushh://version                                           │   │
│   │  • hushh://compliance                                        │   │
│   │  • hushh://scopes                                            │   │
│   └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     LOCAL SQLITE VAULT                       │   │
│   │                                                              │   │
│   │  • Encrypted with user's passphrase (PBKDF2 → AES-256)       │   │
│   │  • Never synced unless user opts in                          │   │
│   │  • Same schema as cloud vault                                │   │
│   │  • iOS: Keychain for key storage                             │   │
│   │  • Android: EncryptedSharedPreferences                       │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Example: Siri + Hushh Integration

```
User: "Hey Siri, what should I have for dinner based on my preferences?"

Apple Intelligence → Local HushhMCP Server
                  → request_consent(scope: "vault.read.food")
                  → User approves via FaceID
                  → get_food_preferences(consent_token)
                  → Returns: {vegetarian: true, budget: $30}

Apple Intelligence → Generates contextual response

⚠️ No data ever leaves the device. Siri gets the answer locally.
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
      ├── iOS: Stored in Keychain (SecureEnclave where available)
      ├── Android: Stored in EncryptedSharedPreferences (Keystore)
      ├── Web: React Context (memory only, XSS protection)
      └── NEVER stored in plaintext or transmitted
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
      └── Stored locally (or cloud if sync enabled)
```

---

## 🔐 Authentication Security Layers

### Four-Layer Security Model (Corrected - January 2026)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Firebase Auth    → OAuth (ACCOUNT - who you are)       │
│          Google Sign-In → Firebase ID token [Always first]      │
│                                                                  │
│ Layer 2: Vault Unlock     → Passphrase/Recovery (KNOWLEDGE)     │
│          Current: Passphrase (PBKDF2) + Recovery Key           │
│          Future: FaceID/TouchID/Passkey (passphrase fallback)   │
│                                                                  │
│ Layer 3: VAULT_OWNER Token → Cryptographic Consent (DATA ACCESS)│
│          Issued after vault unlock, 24h expiry                  │
│                                                                  │
│ Layer 4: Agent Tokens     → Scoped Operations                   │
│          Domain-specific, 7-day expiry                          │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Status

**Current (v2.0):**

- ✅ Layer 1: Firebase Auth (Google OAuth)
- ✅ Layer 2: Passphrase-based unlock (PBKDF2, 100k iterations)
- ✅ Layer 2: Recovery key system (HRK-xxxx format)
- ✅ Layer 3: VAULT_OWNER tokens with validation
- ✅ Layer 4: Agent-scoped tokens (Kai, Food, Professional)

**Future Enhancements (v3.0):**

- 🔜 WebAuthn/Passkey support (Layer 2 enhancement)
- 🔜 FaceID/TouchID direct integration (Layer 2 primary method)
- 🔜 Biometric-only unlock with passphrase fallback
- 🔜 Hardware security key support (YubiKey, etc.)

**Design Philosophy:**

- Passphrase/Recovery will always be available as fallback
- Biometric methods enhance UX, not replace security options
- User always has non-biometric path for accessibility

### Security Evolution

**Old Approach** (❌ Insecure):

- Layers 1-2 for authentication
- Implicit vault ownership (no token)
- Agents used custom tokens
- **Problem**: No audit trail for vault owner access

**New Approach** (✅ Secure):

- Layer 1: Firebase Auth (identity)
- Layer 2: Passphrase (vault unlock)
- **Layer 3**: VAULT_OWNER token (NEW!) - Even owners use consent tokens
- **Layer 4**: Agent tokens with scoped permissions
- **Benefit**: Complete audit trail, no authentication bypasses

### Layer 3: VAULT_OWNER Token (Consent-First)

**Purpose:** Cryptographic proof that vault owner authorized data access

**Implementation:**

```python
# Backend: consent-protocol/api/routes/consent.py
@router.post("/vault-owner-token")
async def issue_vault_owner_token(request: Request):
    # 1. Verify Firebase ID token (Layer 2)
    firebase_uid = verify_firebase_bearer(auth_header)

    # 2. Check for existing active token (reuse)
    active_tokens = await consent_db.get_active_tokens(user_id)
    for token in active_tokens:
        if token.scope == VAULT_OWNER and not_expired:
            return token  # Reuse

    # 3. Issue new VAULT_OWNER token
    token = issue_token(
        user_id=firebase_uid,
        agent_id="self",
        scope=ConsentScope.VAULT_OWNER,
        expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
    )

    # 4. Log to consent_audit
    await consent_db.insert_event(...)

    return {"token": token, "expiresAt": ...}
```

**Frontend Storage:**

```typescript
// lib/vault/vault-context.tsx
// Token stored in React state (memory only, lost on refresh)
const [vaultOwnerToken, setVaultOwnerToken] = useState<string | null>(null);

unlockVault(key: string, token: string, expiresAt: number) {
  setVaultKey(key);
  setVaultOwnerToken(token);  // Memory only!
  setTokenExpiresAt(expiresAt);
}
```

**Why Memory-Only Storage:**

- ✅ XSS cannot access (not in localStorage/sessionStorage)
- ✅ Secure by default (lost on page refresh)
- ✅ Each tab isolated
- ✅ Forces re-authentication periodically

---

## ⚖️ Legal & Compliance (USA)

### CCPA/CPRA Compliance (California)

| Requirement           | Hushh Implementation                               |
| --------------------- | -------------------------------------------------- |
| **Right to Know**     | User dashboard shows all collected data categories |
| **Right to Delete**   | One-tap vault deletion, both local and cloud       |
| **Right to Opt-Out**  | Cloud sync is opt-in; local-only is default        |
| **Data Minimization** | Agents collect only data necessary for function    |
| **Transparency**      | Consent prompts explain exactly what and why       |
| **ADMT Disclosure**   | AI decision explanations in Kai decision cards     |

### On-Device Privacy Advantage

```
┌─────────────────────────────────────────────────────────────────┐
│                    CCPA COMPLIANCE BY DESIGN                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LOCAL-ONLY MODE (Default):                                     │
│   • Data never transmitted = No "sale" under CCPA                │
│   • No third-party sharing = No opt-out required                 │
│   • User has complete control via device storage                 │
│                                                                  │
│   CLOUD SYNC (Opt-In):                                           │
│   • E2E encrypted = Server cannot read data                      │
│   • No sharing with third parties                                │
│   • User can delete at any time                                  │
│   • Clear consent before enabling                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SEC Considerations (Agent Kai)

> ⚠️ **IMPORTANT**: Agent Kai provides informational analysis, NOT investment advice.

| Regulatory Aspect          | Kai Position                                      |
| -------------------------- | ------------------------------------------------- |
| **Investment Adviser Act** | Kai is NOT a registered investment adviser        |
| **Fiduciary Duty**         | Kai does NOT execute trades or manage portfolios  |
| **Disclaimers**            | Every decision card includes required disclaimers |
| **No Recommendations**     | Kai presents analysis; user makes all decisions   |
| **Audit Trail**            | Complete debate history available for user review |

Required Disclaimer (shown on every decision card):

```
⚠️ DISCLAIMER: Agent Kai provides educational analysis only. This is NOT
investment advice. The information presented does not constitute a
recommendation to buy, sell, or hold any security. Past performance does
not guarantee future results. Always consult a licensed financial advisor
before making investment decisions. [LEGAL ENTITY NAME - TBD] is not a
registered investment adviser with the SEC or any state securities regulatory
authority. Agent Kai is not part of Hushh Technology Fund L.P.'s investment
services.

<!-- TODO: LEGAL REVIEW - Replace [LEGAL ENTITY NAME - TBD] with final entity -->
```

---

## 🤖 Agent Port Mapping

| Port      | Agent         | Scope                                                 |
| --------- | ------------- | ----------------------------------------------------- |
| **10000** | Orchestrator  | Intent detection, routing                             |
| **10001** | Food & Dining | `VAULT_WRITE_FOOD`, `VAULT_READ_FOOD`                 |
| **10002** | Professional  | `VAULT_WRITE_PROFESSIONAL`, `VAULT_READ_PROFESSIONAL` |
| **10003** | Agent Kai     | `VAULT_READ_FINANCE`, `AGENT_KAI_ANALYZE`             |
| 10004     | Identity      | `AGENT_IDENTITY_VERIFY`                               |
| 10005     | Shopping      | `AGENT_SHOPPING_PURCHASE`                             |
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
| **Local First**    | On-device SQLite is default; cloud is opt-in          |
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
├── local_mcp_server.py    # On-device MCP server (NEW)
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
│   ├── local_sqlite.py    # Local SQLite (NEW)
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
    │   ├── professional_profile/
    │   └── kai/           # Agent Kai (NEW)
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
POST /api/agents/professional-profile/chat
POST /api/kai/analyze                 # Agent Kai (via Proxy)
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

_Version: 4.0 | Updated: December 2025 | On-Device AI + Legal Compliance Release_
