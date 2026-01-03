# Mobile Development (iOS & Android)

> Native mobile deployment with Capacitor 8, **on-device AI**, and local-first architecture.
> Verified December 2025.

---

## Overview

The Hushh mobile app uses **Next.js static export** in a native WebView, with **on-device AI** for privacy-first processing and **7 native plugins** handling security-critical operations. Both iOS and Android achieve feature parity through aligned plugin implementations.

```
┌────────────────────────────────────────────────────────────────┐
│              CAPACITOR MOBILE APP (iOS/Android)                │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 ON-DEVICE AI LAYER                        │  │
│  │  iOS: MLX Framework (Apple Silicon optimized)            │  │
│  │  Android: MediaPipe + Gemma (LLM Inference API)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Local Processing                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Native WebView (Next.js Static Export)         │  │
│  │  • React 19 + TailwindCSS UI                             │  │
│  │  • Morphy-UX components                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Capacitor.call()                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Native Plugins (7 per platform)                    │  │
│  │  HushhAuth · HushhVault · HushhConsent · HushhMCP        │  │
│  │  HushhSync · HushhSettings · HushhKeychain               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Local SQLite                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          LOCAL ENCRYPTED VAULT (Default)                  │  │
│  │  iOS: CoreData + Keychain | Android: Room + Keystore     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Opt-In Only                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Cloud Backend (If User Enables)               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🧠 On-Device AI

### Implementation Options

| Option                   | Platform    | Pros                                 | Cons                       |
| ------------------------ | ----------- | ------------------------------------ | -------------------------- |
| **Apple Intelligence**   | iOS 18+     | Native, no model download, optimized | Limited to iOS 18+ devices |
| **MLX Swift (Custom)**   | iOS         | Full control, custom models          | Requires model packaging   |
| **MediaPipe + Gemma**    | Android     | Google-supported, well-documented    | Large model downloads      |
| **Gemini Nano (AICore)** | Android 14+ | Native, optimized                    | Limited availability       |
| **@capgo/capacitor-llm** | Both        | Ready-made plugin, cross-platform    | Less customization         |

### Option 1: Community Plugin (Easiest)

The `@capgo/capacitor-llm` plugin provides ready-made on-device LLM for Capacitor:

```bash
npm install @capgo/capacitor-llm
npx cap sync
```

```typescript
import { LLM } from "@capgo/capacitor-llm";

// Uses Apple Intelligence on iOS 18+, MediaPipe on Android
const response = await LLM.generateText({
  prompt: "Analyze this stock for investment potential...",
  maxTokens: 256,
});
```

> [!NOTE]
> This plugin uses Apple Intelligence on iOS 18+ (no additional setup) and MediaPipe on Android (requires model download).

---

### Option 2: iOS - Apple Intelligence / MLX

#### Apple Intelligence (iOS 18+)

For devices running iOS 18+, Apple Intelligence provides native LLM capabilities without custom models:

| Feature               | Details                                          |
| --------------------- | ------------------------------------------------ |
| **Availability**      | iOS 18+, no additional setup                     |
| **No Model Download** | Uses system AI                                   |
| **Privacy**           | All processing on-device                         |
| **Integration**       | Via Foundation models or custom Capacitor plugin |

#### MLX Framework (Custom Models)

For custom model requirements or broader iOS compatibility:

| Feature               | Details                                          |
| --------------------- | ------------------------------------------------ |
| **Framework**         | Apple MLX (open-source, Apple Silicon optimized) |
| **Memory**            | Unified Memory Model - CPU/GPU share pools       |
| **Models**            | Hugging Face Hub via `MLXLMCommon` package       |
| **Quantization**      | 4-bit quantization reduces model size by 75%     |
| **Swift Integration** | MLX Swift for native apps                        |
| **Offline**           | Full functionality without internet              |
| **Privacy**           | Data never leaves device                         |

```swift
// hushh-webapp/ios/App/App/Plugins/HushhAIPlugin.swift
import Capacitor
import MLX
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

    override public func load() {
        // Load model on plugin initialization
        Task {
            do {
                model = try await LLMModel.load(name: "gemma-2b-it-q4")
            } catch {
                print("Failed to load model: \(error)")
            }
        }
    }

    @objc func generateResponse(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("Missing prompt parameter")
            return
        }

        Task {
            do {
                let response = try await model?.generate(prompt: prompt, maxTokens: 256)
                call.resolve(["response": response ?? ""])
            } catch {
                call.reject("Generation failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": model != nil])
    }
}
```

---

### Option 3: Android - MediaPipe + Gemma

| Feature          | Details                                           |
| ---------------- | ------------------------------------------------- |
| **Framework**    | MediaPipe LLM Inference API                       |
| **Runtime**      | LiteRT (formerly TensorFlow Lite)                 |
| **Models**       | Gemma 2B, Gemma 3n, Gemma 3 1B                    |
| **Acceleration** | GPU/NPU hardware optimization                     |
| **Distribution** | Model downloaded post-install (too large for APK) |
| **Production**   | Gemini Nano via Android AICore (Android 14+)      |

#### Gradle Dependencies

```kotlin
// hushh-webapp/android/app/build.gradle.kts
dependencies {
    implementation("com.google.mediapipe:tasks-genai:0.10.14")
}
```

#### Plugin Implementation

```kotlin
// hushh-webapp/android/app/src/main/java/com/hushh/pda/plugins/HushhAI/HushhAIPlugin.kt
package com.hushh.pda.plugins.HushhAI

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mediapipe.tasks.genai.llminference.*
import java.io.File

@CapacitorPlugin(name = "HushhAI")
class HushhAIPlugin : Plugin() {
    private var llmInference: LlmInference? = null

    override fun load() {
        super.load()
        initializeModel()
    }

    private fun initializeModel() {
        // Model stored in app's files directory (downloaded on first run)
        val modelPath = context.filesDir.resolve("gemma-2b-it-q4.bin").absolutePath

        if (File(modelPath).exists()) {
            try {
                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelPath)
                    .setMaxTokens(256)
                    .setResultListener { partialResult, done ->
                        // Handle streaming response if needed
                    }
                    .build()
                llmInference = LlmInference.createFromOptions(context, options)
            } catch (e: Exception) {
                android.util.Log.e("HushhAI", "Failed to load model: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun generateResponse(call: PluginCall) {
        val prompt = call.getString("prompt") ?: run {
            call.reject("Missing prompt parameter")
            return
        }

        if (llmInference == null) {
            call.reject("Model not loaded. Download required.")
            return
        }

        try {
            val response = llmInference?.generateResponse(prompt) ?: ""
            val ret = JSObject()
            ret.put("response", response)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Generation failed: ${e.message}")
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", llmInference != null)
        call.resolve(ret)
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        // Implement model download from cloud storage
        // Models are ~1.5GB, should be downloaded with progress UI
        call.resolve(JSObject().put("status", "download_started"))
    }
}
```

#### TypeScript Interface

```typescript
// hushh-webapp/lib/capacitor/index.ts
import { registerPlugin } from "@capacitor/core";

export interface HushhAIPlugin {
  generateResponse(options: { prompt: string }): Promise<{ response: string }>;
  isAvailable(): Promise<{ available: boolean }>;
  downloadModel?(): Promise<{ status: string }>;
}

export const HushhAI = registerPlugin<HushhAIPlugin>("HushhAI");
```

---

## 💾 Local-First Storage Architecture

### Storage Modes

| Mode           | Description                              | Availability |
| -------------- | ---------------------------------------- | ------------ |
| **Local-Only** | Data encrypted and stored on-device only | ✅ Default   |
| **Cloud Sync** | E2E encrypted sync to cloud (opt-in)     | ✅ Optional  |

### Local SQLite Vault

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL ENCRYPTED VAULT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌───────────────────────┐    ┌───────────────────────┐            │
│   │       iOS             │    │       Android         │            │
│   ├───────────────────────┤    ├───────────────────────┤            │
│   │ • CoreData / SQLite   │    │ • Room / SQLite       │            │
│   │ • Keychain (keys)     │    │ • EncryptedShared-    │            │
│   │ • SecureEnclave       │    │   Preferences         │            │
│   │   (biometric)         │    │ • Keystore (keys)     │            │
│   └───────────────────────┘    └───────────────────────┘            │
│                                                                      │
│   Encryption: AES-256-GCM                                           │
│   Key Derivation: PBKDF2 (100,000 iterations, SHA-256)              │
│   Key Storage: Hardware-backed (SecureEnclave/Keystore)             │
│                                                                      │
│   ⚠️ Data NEVER syncs unless user explicitly enables cloud          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Schema (Same as Cloud)

```sql
-- Local SQLite tables (encrypted values)
CREATE TABLE vault_keys (
    user_id TEXT PRIMARY KEY,
    encrypted_vault_key TEXT NOT NULL,
    recovery_encrypted_vault_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vault_food (
    user_id TEXT PRIMARY KEY,
    dietary_restrictions TEXT,  -- encrypted
    cuisine_preferences TEXT,   -- encrypted
    monthly_budget TEXT,        -- encrypted
    favorite_locations TEXT,    -- encrypted (NEW)
    updated_at TIMESTAMP
);

CREATE TABLE vault_kai_decisions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    ticker TEXT,
    decision TEXT,              -- encrypted
    debate_history TEXT,        -- encrypted
    created_at TIMESTAMP
);
```

---

## 🔌 Local MCP Server (HushhMCP Plugin)

The new `HushhMCP` plugin enables Apple Intelligence and Gemini to interact with local Hushh data:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL MCP INTEGRATION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐              ┌─────────────────┐              │
│   │ Apple           │              │ Google          │              │
│   │ Intelligence    │              │ Gemini          │              │
│   │ (Siri, etc.)    │              │ (Assistant)     │              │
│   └────────┬────────┘              └────────┬────────┘              │
│            │                                │                        │
│            ▼                                ▼                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                   HushhMCP Plugin                            │   │
│   │                                                              │   │
│   │  Tools exposed to system AI:                                 │   │
│   │  • hushh_request_consent    (prompt user for permission)     │   │
│   │  • hushh_get_food_prefs     (read dietary data)              │   │
│   │  • hushh_get_kai_analysis   (read investment history)        │   │
│   │  • hushh_get_locations      (read favorite locations)        │   │
│   │                                                              │   │
│   │  Protocol: JSON-RPC 2.0 (same as cloud MCP)                  │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Example: Siri + Hushh

```
User: "Hey Siri, what should I have for dinner based on my preferences?"

┌──────────────────────────────────────────────────────────────────────┐
│ 1. Siri → Apple Intelligence → Detects Hushh integration            │
│ 2. Apple Intelligence → HushhMCP.request_consent("vault.read.food") │
│ 3. HushhMCP → Prompt user with FaceID consent                        │
│ 4. User approves → Consent token issued                              │
│ 5. HushhMCP.get_food_preferences(token) → Local SQLite               │
│ 6. Returns: {vegetarian: true, budget: $30, location: "Home"}       │
│ 7. Apple Intelligence → Uses context for response                    │
│ 8. Siri: "Based on your preferences, here are vegetarian options..." │
│                                                                       │
│ ⚠️ NO DATA EVER LEFT THE DEVICE                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Platform Comparison

| Feature           | Web         | iOS Native            | Android Native |
| ----------------- | ----------- | --------------------- | -------------- |
| **On-Device LLM** | ❌          | ✅ MLX                | ✅ Gemma       |
| **Local SQLite**  | ❌          | ✅ CoreData           | ✅ Room        |
| **Local MCP**     | ❌          | ✅                    | ✅             |
| **Cloud Vault**   | ✅          | ✅ (opt-in)           | ✅ (opt-in)    |
| **Offline Mode**  | ❌          | ✅ Full               | ✅ Full        |
| **Sign-In**       | Firebase JS | HushhAuth.swift       | HushhAuth.kt   |
| **HTTP Client**   | fetch()     | URLSession            | OkHttpClient   |
| **Vault Storage** | Web Crypto  | Keychain              | Keystore       |
| **Biometric**     | ❌          | ✅ FaceID/TouchID     | ✅ Fingerprint |
| **System AI**     | N/A         | ✅ Apple Intelligence | ✅ Gemini      |

---

## Native Plugins (Verified)

All 7 plugins exist on both platforms with matching methods:

| Plugin            | jsName          | Purpose                  |
| ----------------- | --------------- | ------------------------ |
| **HushhAuth**     | `HushhAuth`     | Google Sign-In, Firebase |
| **HushhVault**    | `HushhVault`    | Encryption, local DB     |
| **HushhConsent**  | `HushhConsent`  | Token management         |
| **HushhMCP**      | `HushhMCP`      | Local MCP server (NEW)   |
| **HushhSync**     | `HushhSync`     | Cloud synchronization    |
| **HushhSettings** | `HushhSettings` | App preferences          |
| **HushhKeychain** | `HushhKeychain` | Secure key storage       |

### Key Methods by Plugin

**HushhAuth:**

- `signIn()` - Native Google Sign-In → Firebase credential
- `signOut()` - Clear all auth state
- `getIdToken()` - Get cached/fresh Firebase token
- `getCurrentUser()` - Get user profile
- `isSignedIn()` - Check auth state

**HushhVault:**

- `deriveKey()` - PBKDF2 key derivation
- `encryptData()` / `decryptData()` - AES-256-GCM
- `hasLocalVault()`, `getLocalVault()`, `setupLocalVault()` - Local vault
- `syncToCloud()`, `syncFromCloud()` - Cloud sync (opt-in)
- `getFoodPreferences()`, `getKaiDecisions()` - Domain data

**HushhMCP:**

- `startServer()` - Start local MCP server
- `stopServer()` - Stop local MCP server
- `registerWithSystemAI()` - Register with Apple Intelligence/Gemini
- `handleToolCall()` - Process incoming MCP tool calls

**HushhConsent:**

- `issueToken()`, `validateToken()`, `revokeToken()` - Token CRUD
- `createTrustLink()`, `verifyTrustLink()` - Agent delegation
- `promptBiometric()` - FaceID/TouchID/Fingerprint consent

---

## File Structure

### iOS

```
ios/App/App/
├── AppDelegate.swift          # Firebase.configure()
├── MyViewController.swift     # Plugin registration
├── LocalDatabase/             # CoreData models (NEW)
│   ├── HushhDataModel.xcdatamodeld
│   └── LocalVaultManager.swift
├── AI/                        # MLX integration (NEW)
│   └── HushhMLXEngine.swift
└── Plugins/
    ├── HushhAuthPlugin.swift
    ├── HushhVaultPlugin.swift
    ├── HushhConsentPlugin.swift
    ├── HushhMCPPlugin.swift   # NEW
    ├── HushhSyncPlugin.swift
    ├── HushhSettingsPlugin.swift
    └── HushhKeystorePlugin.swift
```

### Android

```
android/app/src/main/java/com/hushh/pda/
├── MainActivity.kt            # Plugin registration
├── database/                  # Room database (NEW)
│   ├── LocalVaultDatabase.kt
│   ├── VaultDao.kt
│   └── entities/
├── ai/                        # MediaPipe integration (NEW)
│   └── GemmaInferenceEngine.kt
└── plugins/
    ├── HushhAuth/HushhAuthPlugin.kt
    ├── HushhVault/HushhVaultPlugin.kt
    ├── HushhConsent/HushhConsentPlugin.kt
    ├── HushhMCP/HushhMCPPlugin.kt     # NEW
    ├── HushhSync/HushhSyncPlugin.kt
    ├── HushhSettings/HushhSettingsPlugin.kt
    └── HushhKeystore/HushhKeystorePlugin.kt
```

### TypeScript Layer

```
lib/
├── capacitor/
│   ├── index.ts          # Plugin registration & interfaces
│   ├── types.ts          # Type definitions
│   └── plugins/          # Web fallbacks
├── services/
│   ├── api-service.ts    # Platform-aware API routing
│   ├── auth-service.ts   # Native auth abstraction
│   ├── vault-service.ts  # Vault operations (local/cloud)
│   └── mcp-service.ts    # Local MCP client (NEW)
└── database/
    └── local-vault.ts    # TypeScript interface to local SQLite
```

---

## Plugin Registration

### iOS (Capacitor 8)

```swift
// ios/App/App/MyViewController.swift
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhMCPPlugin())     // NEW
        bridge?.registerPluginInstance(HushhSyncPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhKeystorePlugin())
    }
}
```

### Android

```kotlin
// android/app/src/main/java/com/hushh/pda/MainActivity.kt
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HushhAuthPlugin::class.java)
        registerPlugin(HushhVaultPlugin::class.java)
        registerPlugin(HushhConsentPlugin::class.java)
        registerPlugin(HushhMCPPlugin::class.java)       // NEW
        registerPlugin(HushhSyncPlugin::class.java)
        registerPlugin(HushhSettingsPlugin::class.java)
        registerPlugin(HushhKeystorePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

---

## Service Abstraction Pattern

TypeScript services automatically route to local or cloud based on settings:

```typescript
// lib/services/vault-service.ts
import { Capacitor } from "@capacitor/core";
import { HushhVault } from "@/lib/capacitor";

export class VaultService {
  static async getFoodPreferences(userId: string): Promise<FoodPreferences> {
    if (Capacitor.isNativePlatform()) {
      // Native path → Local SQLite (default) or Cloud (if enabled)
      const settings = await HushhSettings.getCloudSyncEnabled();
      if (settings.enabled) {
        return HushhVault.getFoodPreferencesFromCloud({ userId });
      }
      return HushhVault.getFoodPreferencesLocal({ userId });
    }
    // Web path → Cloud only
    return apiFetch(`/api/vault/food?userId=${userId}`);
  }
}
```

---

## ⚖️ Privacy & Compliance

### Local-First Benefits

| Benefit                | Description                                 |
| ---------------------- | ------------------------------------------- |
| **CCPA Compliant**     | No data transmission = no "sale" under CCPA |
| **Zero Server Access** | Hushh cannot access user data if local-only |
| **Offline Capable**    | Full functionality without internet         |
| **User Control**       | All data deletable via device settings      |

### Data Flow Transparency

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW BY STORAGE MODE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   LOCAL-ONLY (Default):                                              │
│   User → Device (encrypted) → STAYS ON DEVICE                       │
│   ✓ Private by default                                              │
│   ✓ No network required                                             │
│   ✓ User can delete via iOS/Android settings                        │
│                                                                      │
│   CLOUD SYNC (Opt-In):                                               │
│   User → Device (encrypted) → Cloud (encrypted) → Other Devices     │
│   ✓ E2E encrypted (server cannot read)                              │
│   ✓ User can disable at any time                                    │
│   ✓ User can request full deletion                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Build Commands

> [!CAUTION] > **ALWAYS perform a fresh build when modifying native code (Swift/Kotlin plugins).**
> Stale DerivedData will cause native changes to be ignored.

### iOS (Fresh Build - REQUIRED)

```bash
# 1. Clear Xcode cache (MANDATORY for native changes)
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*

# 2. Build web assets and sync
npm run cap:build
npx cap sync ios

# 3. Clean build
xcodebuild -project ios/App/App.xcodeproj -scheme App clean build \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/App-hushh

# 4. Install and launch
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/App-hushh/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.hushh.pda
```

### Android (Fresh Build)

```bash
# 1. Clean Gradle cache
cd android && ./gradlew clean && cd ..

# 2. Build web assets and sync
npm run cap:build
npx cap sync android

# 3. Build and install
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Download AI Models (First Run)

```bash
# iOS: MLX models download via mlx-lm
# (Handled automatically by HushhAIPlugin on first use)

# Android: Gemma model download
adb push gemma-2b-it-q4.bin /data/local/tmp/
```

---

## Edge Cases & Considerations

### Model Download

| Platform | Model Size | Download Strategy                           |
| -------- | ---------- | ------------------------------------------- |
| iOS      | ~1.5GB     | Background download, show progress          |
| Android  | ~1.5GB     | Downloaded post-install, stored in app data |

### Device Compatibility

| Requirement         | iOS       | Android                 |
| ------------------- | --------- | ----------------------- |
| **Minimum OS**      | iOS 16+   | Android 11+ (API 30)    |
| **For AI**          | A14+ chip | 4GB+ RAM                |
| **For Gemini Nano** | N/A       | Android 14+ with AICore |

### Fallback Strategy

```typescript
// If on-device AI unavailable, gracefully degrade
async function analyzeWithKai(prompt: string): Promise<KaiResponse> {
  if (await HushhAI.isAvailable()) {
    // On-device inference
    return HushhAI.generateResponse({ prompt });
  } else {
    // Fallback: Prompt user to enable cloud mode
    return showCloudModePrompt();
  }
}
```

---

## Testing Checklist

Before releasing mobile updates:

- [ ] Android matched with iOS (uses `uid` instead of `id`)
- [ ] Kotlin version 2.0.21 for Firebase compatibility
- [ ] Local SQLite vault creates and encrypts correctly
- [ ] Cloud sync opt-in prompt appears correctly
- [ ] MLX/Gemma inference works offline
- [ ] HushhMCP registers with Apple Intelligence/Gemini
- [ ] Biometric consent prompts appear correctly
- [ ] Data deletion removes both local and cloud data

---

## Web/Native Symmetric API Reference

Native (iOS/Android) and Web use **symmetric patterns** for reliability. Native plugins call Python backend directly; Web routes go through Next.js.

### Endpoint Mapping

| Operation        | Native (Swift/Kotlin)       | Web (Next.js)                 | Backend            |
| ---------------- | --------------------------- | ----------------------------- | ------------------ |
| Vault Check      | `POST /db/vault/check`      | `GET /api/vault/check`        | Python → Cloud SQL |
| Vault Get        | `POST /db/vault/get`        | `GET /api/vault/get`          | Python → Cloud SQL |
| Vault Setup      | `POST /db/vault/setup`      | `POST /api/vault/setup`       | Python → Cloud SQL |
| Food Get         | `POST /db/food/get`         | `GET /api/vault/food`         | Python → Cloud SQL |
| Professional Get | `POST /db/professional/get` | `GET /api/vault/professional` | Python → Cloud SQL |
| Consent Pending  | `GET /api/consent/pending`  | `GET /api/consent/pending`    | Python             |

### Backend URLs

| Mode       | URL                                                          |
| ---------- | ------------------------------------------------------------ |
| Production | `https://consent-protocol-1006304528804.us-central1.run.app` |
| Local Dev  | `http://localhost:8000`                                      |

Native plugins have `defaultBackendUrl` hardcoded to production. For local testing, pass `backendUrl` parameter.

### Build Configuration (next.config.ts)

```typescript
// Web/Cloud Run: undefined (server mode with API routes)
// Capacitor/Mobile: "export" (static HTML, no API routes)
output: isCapacitorBuild ? "export" : undefined;
```

> **Note:** Changes to next.config.ts require restarting `npm run dev`.

---

_Last verified: January 2, 2026 | Capacitor 8 | On-Device AI Edition_
