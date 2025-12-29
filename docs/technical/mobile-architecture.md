# Mobile Architecture (iOS & Android via Capacitor)

> Native mobile deployment with on-device consent protocol vs Cloud fallback.

---

## 🎯 Overview

The Hushh mobile architecture enables **offline-first, on-device data** while maintaining UI parity with the web application. The Next.js UI runs in a native WebView (WKWebView on iOS, Android WebView on Android), while critical security and consent operations are handled by native plugins.

### Design Goals

```
"Same UI, native security, offline-first data, future on-device AI"
```

| Goal                | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| **UI Parity**       | Next.js static export in native WebView            |
| **Native Security** | **Google Sign-In** & **Keychain/Keystore** storage |
| **Offline-First**   | SQLCipher local vault (planned)                    |
| **Future MLX**      | Plugin architecture for on-device LLM              |

> **Current State (Dec 2025):**  
> Both iOS and Android use **Cloud Mode** by default, routing database requests to Cloud Run via native HTTP clients while local SQLite/SQLCipher storage is finalized.

---

## 🏗️ Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│              CAPACITOR MOBILE APP (iOS/Android)                │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Native WebView (Next.js Static Export)         │  │
│  │  • React 19 + TailwindCSS UI (unchanged)                 │  │
│  │  • Morphy-UX components                                  │  │
│  │  • useAuth Hook (Native Session Management)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Capacitor.call()                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Native Plugins (Consent Protocol)                  │  │
│  │  iOS (Swift)                │ Android (Kotlin)            │  │
│  │  • HushhAuthPlugin         │ • HushhAuthPlugin.kt        │  │
│  │  • HushhConsentPlugin      │ • HushhConsentPlugin.kt     │  │
│  │  • HushhVaultPlugin        │ • HushhVaultPlugin.kt       │  │
│  │  • HushhKeychainPlugin     │ • HushhSettingsPlugin.kt    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ HTTP (OkHttp/URLSession)             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Python Backend (Cloud Run)                    │  │
│  │  • /db/vault/* - Vault key operations                    │  │
│  │  • /db/food/get - Food preferences                       │  │
│  │  • /db/professional/get - Professional profile           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             PostgreSQL (Cloud SQL)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 📱 Platform-Specific Implementations

### Android

| Component           | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| **WebView**         | Android WebView (Chromium-based)                   |
| **HTTP Client**     | OkHttpClient with 30s timeout                      |
| **Plugin Location** | `android/app/src/main/java/com/hushh/pda/plugins/` |
| **Key Storage**     | Android Keystore (planned)                         |

### iOS

| Component           | Implementation            |
| ------------------- | ------------------------- |
| **WebView**         | WKWebView                 |
| **HTTP Client**     | URLSession                |
| **Plugin Location** | `ios/App/App/Plugins/`    |
| **Key Storage**     | Secure Enclave + Keychain |

---

## 🔐 Native Authentication Flow

Mobile WebViews restrict third-party cookies, breaking standard Firebase JavaScript SDK flows (`signInWithPopup`, `signInWithRedirect`). We use a **Native-First Authentication** strategy:

1. **Google Sign-In**: Performed natively via platform SDK
2. **Credential Exchange**: Native plugin exchanges Google ID Token for Firebase Credential
3. **Session Restoration**: `useAuth` hook manually claims the session from native plugin
4. **Security**: `vault_key` stored in Keychain/Keystore only

---

## 🛠️ Troubleshooting & Common Issues

| Issue                        | Symptom                             | Root Cause                                         | Fix                                              |
| :--------------------------- | :---------------------------------- | :------------------------------------------------- | :----------------------------------------------- |
| **Login Hang**               | Stuck on "Verifying identity..."    | Firebase JS SDK tries iframe (blocked in WebView)  | `AuthService` detects native and uses plugin     |
| **Vault Spinner**            | Infinite "Checking vault status..." | `VaultLockGuard` waiting for auth that never fires | Added 20s safety timeout + useRef mount tracking |
| **404 on Food/Professional** | Shows "Set Up" when data exists     | Plugin calling wrong endpoint                      | Use `/db/food/get` and `/db/professional/get`    |
| **Sign Out**                 | Navbar doesn't update               | JS SDK logout listener doesn't fire                | `useAuth().signOut()` clears state explicitly    |

---

## 📂 File Structure

### Android

```
hushh-webapp/android/app/src/main/java/com/hushh/pda/
├── MainActivity.java
└── plugins/
    ├── HushhAuth/HushhAuthPlugin.kt
    ├── HushhConsent/HushhConsentPlugin.kt
    ├── HushhVault/HushhVaultPlugin.kt
    └── HushhSettings/HushhSettingsPlugin.kt
```

### iOS (TBD)

```
hushh-webapp/ios/App/App/
├── AppDelegate.swift
├── MyViewController.swift
└── Plugins/
    ├── HushhAuthPlugin/
    ├── HushhConsentPlugin/
    ├── HushhVaultPlugin/
    └── HushhKeychainPlugin/
```

### Shared TypeScript Layer

```
hushh-webapp/lib/
├── capacitor/
│   ├── index.ts          # Plugin registration & interfaces
│   ├── types.ts          # Type definitions
│   └── plugins/          # Web fallbacks
├── services/
│   ├── api-service.ts    # Platform-aware API routing
│   ├── auth-service.ts   # Native auth abstraction
│   └── vault-service.ts  # Vault operations
└── utils/
    └── session-storage.ts # Platform-aware storage
```

---

## 🔒 Backend Endpoints (Python)

Native plugins call these endpoints on Cloud Run:

| Endpoint               | Method | Purpose                  |
| ---------------------- | ------ | ------------------------ |
| `/db/vault/check`      | POST   | Check if vault exists    |
| `/db/vault/get`        | POST   | Get encrypted vault key  |
| `/db/vault/setup`      | POST   | Store vault key          |
| `/db/food/get`         | POST   | Get food preferences     |
| `/db/professional/get` | POST   | Get professional profile |

See [`consent-protocol/api/routes/db_proxy.py`](../../consent-protocol/api/routes/db_proxy.py) for implementation.

---

## 📱 Build Commands

### Android

```bash
# Build static export + sync to Android
npm run cap:build
npx cap sync android

# Open Android Studio
npx cap open android

# Or install directly via ADB
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS

```bash
# Build static export + sync to iOS
npm run cap:build
npm run cap:sync

# Open Xcode
npm run cap:ios
```

---

## 🚀 Future: On-Device LLM (Phase 2)

Architecture supports `HushhLLMPlugin` wrapping **MLX** for local inference on Apple Neural Engine or Android NPU.

```swift
// iOS Concept:
let response = try await LLMInference.generate(model: "gemma-2b", prompt: input)
```

```kotlin
// Android Concept (TensorFlow Lite or ONNX):
val response = LLMInference.generate(model = "gemma-2b", prompt = input)
```
