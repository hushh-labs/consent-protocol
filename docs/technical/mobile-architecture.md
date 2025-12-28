# Mobile Architecture (iOS via Capacitor)

> Native mobile deployment with on-device consent protocol vs Cloud fallback.

---

## 🎯 Overview

The Hushh mobile architecture enables **offline-first, on-device data** while maintaining UI parity with the web application. The Next.js UI runs in a native WebView, while critical security and consent operations are handled by native Swift plugins.

### Design Goals

```
"Same UI, native security, offline-first data, future on-device AI"
```

| Goal                | Implementation                            |
| ------------------- | ----------------------------------------- |
| **UI Parity**       | Next.js static export in WKWebView        |
| **Native Security** | **Google Sign-In** & **Keychain** storage |
| **Offline-First**   | SQLCipher local vault (in progress)       |
| **Future MLX**      | Plugin architecture for on-device LLM     |

> **⚠️ Current State (Debugging Mode):**
> As of Dec 2025, the app defaults to **Cloud Mode** for stability. It uses native plugins for Auth and Consent, but routes database requests to Cloud Run via `CloudDBProxy` while `SQLCipherDatabase` is finalized.

---

## 🏗️ Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                   CAPACITOR iOS APP                             │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           WKWebView (Next.js Static Export)              │  │
│  │  • React 19 + TailwindCSS UI (unchanged)                 │  │
│  │  • Morphy-UX components                                  │  │
│  │  • useAuth Hook (Native Session Management)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Capacitor.call()                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Swift Native Plugins (Consent Protocol)           │  │
│  │  • HushhAuthPlugin    → Native Google Sign-In            │  │
│  │  • HushhConsentPlugin → Token issue/validate/revoke      │  │
│  │  • HushhVaultPlugin   → Encrypted storage router         │  │
│  │  • HushhKeychainPlugin → Secure secrets storage          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Data Layer (Abstracted)                       │  │
│  │  • LocalVaultStorage (SQLCipher) [Planned Default]       │  │
│  │  • CloudVaultStorage (Cloud Run) [Current Default]       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Native Authentication Flow (Critical)

iOS WKWebView restricts third-party cookies, breaking standard Firebase JavaScript SDK flows (`signInWithPopup`, `signInWithRedirect`). We use a **Native-First Authentication** strategy:

1.  **Google Sign-In**: Performed natively via `GoogleSignIn` SDK (User consents via system dialog).
2.  **Credential Exchange**: `HushhAuthPlugin` exchanges the Google ID Token for a **Firebase Credential** directly on the native layer.
3.  **Session Restoration**:
    - **JS SDK Bypass**: The web app's `useAuth` hook **manually claims** the session from the native plugin on launch.
    - It bypasses `onAuthStateChanged` (which hangs or returns null in WebView) and directly sets the React state with the native user.
4.  **Security**:
    - `vault_key` is stored in **Secure Enclave/Keychain** ONLY.
    - It is cleared from memory when the app enters the background (via `App.addListener('appStateChange')`).

---

## 🛠️ Troubleshooting & Common Issues

| Issue             | Symptom                                              | Root Cause                                                                   | Fix                                                                                                      |
| :---------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **Login Hang**    | App stuck on "Verifying identity..." or "Loading..." | **Firebase JS SDK** tries to initialize `iframe` for auth, which is blocked. | **`AuthService.ts`** detects Native platform and calls `HushhAuthPlugin` directly, bypassing JS SDK.     |
| **Vault Spinner** | Infinite "Checking vault status..."                  | `VaultLockGuard` waiting for `onAuthStateChanged` (which never fires).       | **`useAuth` hook** manually restores session. **Timeout (15s)** added to `VaultLockGuard` with Retry UI. |
| **Profile Crash** | "Invalid Base64 string" error on load                | Python/Swift URL-safe Base64 vs Standard Base64 mismatch.                    | **`safeBase64Decode`** helper in `encrypt.ts` handles padding and URL-safe chars automatically.          |
| **Sign Out**      | Navbar state doesn't update, requires restart        | JS SDK logout listener doesn't fire.                                         | **`useAuth().signOut()`** explicitly clears React state and LocalStorage immediately.                    |

---

## 📂 File Structure

```
hushh-webapp/
├── capacitor.config.ts       # iOS WebView configuration
├── next.config.capacitor.ts  # Static export config for mobile
├── package.json              # cap:build, cap:sync, cap:ios scripts
│
├── lib/capacitor/            # TypeScript Plugin Layer
│   ├── index.ts              # Plugin registration
│   ├── types.ts              # Type definitions
│   └── plugins/              # Web fallbacks (for dev)
│
└── ios/                      # Native Project (Gitignored, regenerated on sync)
    └── App/
        └── Plugins/          # Swift native plugins
            ├── HushhConsentPlugin/
            ├── HushhVaultPlugin/
            ├── HushhKeychainPlugin/
            └── HushhAuthPlugin/
```

---

## 🔐 Consent Protocol Parity

The Swift implementation matches the Python consent-protocol exactly to ensure cross-compatibility.

### Token Format

`HCT:base64(userId|agentId|scope|issuedAt|expiresAt).hmac_sha256_signature`

### Python → Swift Mapping

| Python (consent-protocol)           | Swift (iOS Plugin)                            |
| ----------------------------------- | --------------------------------------------- |
| `hmac.new(SECRET_KEY, raw, sha256)` | `HMAC<SHA256>.authenticationCode(for:using:)` |
| `base64.urlsafe_b64encode()`        | `Data.base64EncodedString()`                  |
| `time.time() * 1000`                | `Date().timeIntervalSince1970 * 1000`         |

---

## 📱 Build Commands

```bash
# 1. Build Web App (Static Export)
npm run cap:build

# 2. Sync to iOS Platform
npm run cap:sync

# 3. Open Xcode
npm run cap:ios
```

---

## 🚀 Future: On-Device LLM (Phase 2)

Architecture supports `HushhLLMPlugin` wrapping **MLX** for local inference (Gemma 2B) on iPhone logic board neural engines.

```swift
// Concept:
let response = try await LLMInference.generate(model: "gemma-2b", prompt: input)
```
