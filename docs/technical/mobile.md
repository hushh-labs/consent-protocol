# Mobile Development (iOS & Android)

> Native mobile deployment with Capacitor 8, verified December 2025.

---

## Overview

The Hushh mobile app uses **Next.js static export** in a native WebView, with **6 native plugins** handling security-critical operations. Both iOS and Android achieve feature parity through aligned plugin implementations.

```
┌────────────────────────────────────────────────────────────────┐
│              CAPACITOR MOBILE APP (iOS/Android)                │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Native WebView (Next.js Static Export)         │  │
│  │  • React 19 + TailwindCSS UI                             │  │
│  │  • Morphy-UX components                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Capacitor.call()                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Native Plugins (6 per platform)                    │  │
│  │  HushhAuth · HushhVault · HushhConsent                   │  │
│  │  HushhSync · HushhSettings · HushhKeychain               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ HTTP Client                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Python Backend (Cloud Run)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Platform Comparison

| **Sign-In** | Firebase JS SDK | HushhAuthPlugin.kt (@capacitor-firebase) | HushhAuthPlugin.swift |
| **HTTP Client** | fetch() | OkHttpClient | URLSession |
| **Vault Storage** | Web Crypto | EncryptedSharedPreferences | Keychain |
| **Plugin Pattern** | N/A | `@CapacitorPlugin` annotation | `CAPBridgedPlugin` protocol |
| **Registration** | N/A | `MainActivity.registerPlugin()` | `MyViewController.capacitorDidLoad()` |
| **Kotlin Version**| N/A | 2.0.21 | N/A |
| **Auth Key** | uid/id | uid (aligned) | uid |

---

## Native Plugins (Verified)

All 6 plugins exist on both platforms with matching methods:

| Plugin            | jsName          | Android Methods | iOS Methods | Purpose                    |
| ----------------- | --------------- | --------------- | ----------- | -------------------------- |
| **HushhAuth**     | `HushhAuth`     | 5               | 5           | Google Sign-In, Firebase   |
| **HushhVault**    | `HushhVault`    | 15              | 15          | Encryption, cloud DB proxy |
| **HushhConsent**  | `HushhConsent`  | 12              | 12          | Token management           |
| **HushhSync**     | `HushhSync`     | 5               | 5           | Cloud synchronization      |
| **HushhSettings** | `HushhSettings` | 5               | 5           | App preferences            |
| **HushhKeychain** | `HushhKeychain` | 6               | 6           | Secure key storage         |

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
- `hasVault()`, `getVault()`, `setupVault()` - Vault lifecycle
- `getFoodPreferences()`, `getProfessionalData()` - Domain data
- `getPendingConsents()`, `getActiveConsents()`, `getConsentHistory()` - Consent data

**HushhConsent:**

- `issueToken()`, `validateToken()`, `revokeToken()` - Token CRUD
- `createTrustLink()`, `verifyTrustLink()` - Agent delegation
- `getPending()`, `getActive()`, `getHistory()` - Consent queries
- `approve()`, `deny()`, `cancel()` - Consent actions

---

## File Structure

### iOS

```
ios/App/App/
├── AppDelegate.swift          # Firebase.configure()
├── MyViewController.swift     # Plugin registration
└── Plugins/
    ├── HushhAuthPlugin.swift
    ├── HushhVaultPlugin.swift
    ├── HushhConsentPlugin.swift
    ├── HushhSyncPlugin.swift
    ├── HushhSettingsPlugin.swift
    └── HushhKeystorePlugin.swift
```

### Android

```
android/app/src/main/java/com/hushh/pda/
├── MainActivity.kt            # Plugin registration
└── plugins/
    ├── HushhAuth/HushhAuthPlugin.kt
    ├── HushhVault/HushhVaultPlugin.kt
    ├── HushhConsent/HushhConsentPlugin.kt
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
└── services/
    ├── api-service.ts    # Platform-aware API routing
    ├── auth-service.ts   # Native auth abstraction
    └── vault-service.ts  # Vault operations
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
        bridge?.registerPluginInstance(HushhSyncPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhKeystorePlugin())
    }
}
```

Each iOS plugin uses `CAPBridgedPlugin` protocol:

```swift
@objc(PluginName)
public class PluginName: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PluginName"
    public let jsName = "PluginJSName"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "methodName", returnType: CAPPluginReturnPromise)
    ]

    @objc func methodName(_ call: CAPPluginCall) {
        call.resolve([...])
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
        registerPlugin(HushhSyncPlugin::class.java)
        registerPlugin(HushhSettingsPlugin::class.java)
        registerPlugin(HushhKeystorePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

Each Android plugin uses `@CapacitorPlugin` annotation:

```kotlin
@CapacitorPlugin(name = "PluginJSName")
class PluginName : Plugin() {
    @PluginMethod
    fun methodName(call: PluginCall) {
        call.resolve(JSObject().put("key", value))
    }
}
```

---

## Service Abstraction Pattern

TypeScript services automatically route to native plugins on mobile:

```typescript
// lib/services/api-service.ts
import { Capacitor } from "@capacitor/core";
import { HushhVault } from "@/lib/capacitor";

export class ApiService {
  static async getPendingConsents(userId: string): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      // Native path → Swift/Kotlin plugin
      const { pending } = await HushhVault.getPendingConsents({
        userId,
        authToken,
      });
      return new Response(JSON.stringify({ pending }), { status: 200 });
    }
    // Web path → Next.js API route
    return apiFetch(`/api/consent/pending?userId=${userId}`);
  }
}
```

Services using this pattern: `ApiService`, `AuthService`, `VaultService`, `ChatService`

---

## API Endpoints (Native → Backend)

| Endpoint               | Method | Purpose                  |
| ---------------------- | ------ | ------------------------ |
| `/api/consent/pending` | GET    | Pending consent requests |
| `/api/consent/active`  | GET    | Active consents          |
| `/api/consent/history` | GET    | Consent audit log        |
| `/db/vault/check`      | POST   | Check vault exists       |
| `/db/vault/get`        | POST   | Get encrypted vault key  |
| `/db/vault/setup`      | POST   | Store vault key          |
| `/db/food/get`         | POST   | Get food preferences     |
| `/db/professional/get` | POST   | Get professional profile |

---

## Performance Optimizations (Capacitor Native)

To achieve native refresh rates (120Hz+) while maintaining the glass aesthetic:

1. **GPU Promotion**: Applied `transform: translate3d(0,0,0)` and `will-change: transform` to all glass/blur elements.
2. **Lighter Blur**: Reduced `backdrop-blur` from `24px` (xl) to `6px` in performance-critical dashboard routes.
3. **Conditional Logging**: All debug `console.log` calls are wrapped in `if (process.env.NODE_ENV === "development")` to prevent blocking the main JS thread in production.
4. **SSE Optimization**: Removed short polling for user ID changes; SSE now relies on server heartbeats and automatic reconnection only.

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

### App Icon Sync

Ensure iOS and Android use the same app icon:

- **Android source**: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
- **iOS target**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024x1024)

```bash
# Sync icon from Android to iOS (scale to 1024x1024)
sips -Z 1024 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png \
  -o ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

---

## Adding New Features

When adding features that differ between web and mobile:

### 1. New API Routes

Add to `ApiService` with native check:

```typescript
static async myNewEndpoint(data): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
        return HushhPlugin.myNewMethod(data);
    }
    return apiFetch("/api/my-endpoint", { method: "POST", body: JSON.stringify(data) });
}
```

### 2. Session/User Data

Use platform-aware utilities:

```typescript
// ✅ Correct
import { setSessionItem } from "@/lib/utils/session-storage";
setSessionItem("key", value);

// ❌ Avoid raw sessionStorage on iOS
sessionStorage.setItem("key", value);
```

### 3. New Native Plugin Method

1. Add method to Android `.kt` with `@PluginMethod`
2. Add method to iOS `.swift` in `pluginMethods` array
3. Add TypeScript interface in `lib/capacitor/index.ts`
4. Test on both platforms

---

## Web APIs & iOS Compatibility

| API                   | iOS WebView   | Notes                          |
| --------------------- | ------------- | ------------------------------ |
| `sessionStorage`      | ⚠️ Unreliable | Use session-storage.ts utility |
| `localStorage`        | ✅ Works      | Persists across sessions       |
| `crypto.subtle`       | ✅ Works      | WebCrypto fully supported      |
| `navigator.clipboard` | ✅ Works      | iOS 14+                        |
| `signInWithPopup`     | ❌ Blocked    | Use HushhAuth plugin           |
| File download         | ⚠️ May fail   | Use native Filesystem          |

---

## Troubleshooting

| Issue                   | Symptom                       | Fix                                               |
| ----------------------- | ----------------------------- | ------------------------------------------------- |
| **Login Hang**          | "Verifying identity..." stuck | `AuthService` detects native and uses plugin      |
| **Vault Spinner**       | Infinite "Checking vault..."  | Added 20s safety timeout in VaultLockGuard        |
| **Empty Consent Table** | No history shown              | Use GET `/api/consent/*` not POST `/db/consent/*` |
| **Sign Out**            | Navbar doesn't update         | `useAuth().signOut()` clears state explicitly     |

---

## Testing Checklist

Before releasing mobile updates:

- [x] Android matched with iOS (uses `uid` instead of `id`)
- [x] Kotlin version 2.0.21 for Firebase compatibility
- [x] Performance optimizations for 120Hz refresh rates

_Last verified: December 30, 2025 | Capacitor 8_
