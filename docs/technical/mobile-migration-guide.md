# Mobile Migration Checklist (iOS & Android)

> **Living Document**: Update this when adding new Next.js features that need mobile consideration.

## Quick Reference

When adding new features to the Next.js app, check if they need mobile handling:

### 1. New API Routes (`/api/*`)

**Required**: Add to `ApiService`

```typescript
// lib/services/api-service.ts
static async myNewEndpoint(data: { ... }): Promise<Response> {
  return apiFetch("/api/my-new-endpoint", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

### 2. Session/User Data Storage

**Required**: Use session-storage utility

```typescript
// ❌ Don't use raw sessionStorage
sessionStorage.setItem("key", value);

// ✅ Use platform-aware utility
import { setSessionItem } from "@/lib/utils/session-storage";
setSessionItem("key", value);
```

### 3. OAuth/Authentication

**Required**: Use AuthService

```typescript
// ❌ Don't use signInWithPopup directly
const result = await signInWithPopup(auth, provider);

// ✅ Use AuthService
const result = await AuthService.signInWithGoogle();
```

### 4. File Downloads

**Consideration**: May not work in WebView

```typescript
// Web-only - may fail on iOS
a.download = "file.txt";
a.click();

// For iOS: Use Capacitor Filesystem plugin
if (Capacitor.isNativePlatform()) {
  await Filesystem.writeFile({ ... });
}
```

---

## Web APIs & iOS Compatibility

| API                   | iOS WebView   | Notes                          |
| --------------------- | ------------- | ------------------------------ |
| `sessionStorage`      | ⚠️ Unreliable | Use session-storage.ts utility |
| `localStorage`        | ✅ Works      | Persists across sessions       |
| `crypto.subtle`       | ✅ Works      | WebCrypto fully supported      |
| `navigator.clipboard` | ✅ Works      | iOS 14+                        |
| `signInWithPopup`     | ❌ Blocked    | Use HushhAuth plugin           |
| `window.open`         | ❌ Blocked    | Use ASWebAuthenticationSession |
| File download         | ⚠️ May fail   | Use native Filesystem          |

---

## Capacitor Plugin Registry

| Plugin          | Purpose               | File                     |
| --------------- | --------------------- | ------------------------ |
| `HushhAuth`     | Native Google Sign-In | `ios/.../HushhAuth/`     |
| `HushhVault`    | Encrypted storage     | `ios/.../HushhVault/`    |
| `HushhConsent`  | Token management      | `ios/.../HushhConsent/`  |
| `HushhKeychain` | Secure key storage    | `ios/.../HushhKeychain/` |
| `HushhSettings` | App settings          | `ios/.../HushhSettings/` |
| `HushhDatabase` | Local SQLCipher       | `ios/.../HushhDatabase/` |
| `HushhAgent`    | Local AI agents       | `ios/.../HushhAgent/`    |
| `HushhSync`     | Cloud sync            | `ios/.../HushhSync/`     |

---

## Service Abstraction Pattern

For any new feature needing platform differences:

```typescript
// lib/services/my-service.ts
import { Capacitor } from "@capacitor/core";
import { MyNativePlugin } from "@/lib/capacitor";

export class MyService {
  static async doSomething() {
    if (Capacitor.isNativePlatform()) {
      // Native path
      return MyNativePlugin.doSomething();
    } else {
      // Web path
      return fetch("/api/something");
    }
  }
}
```

---

## Plugin Registration (Critical!)

Local Capacitor plugins must be manually registered. Capacitor doesn't auto-discover Swift plugins in the App folder.

### Step 1: Create MyViewController.swift

```swift
// ios/App/App/MyViewController.swift
import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Register all local native plugins
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhKeychainPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhSyncPlugin())
    }
}
```

### Step 2: Update Main.storyboard

In Xcode, set the Bridge View Controller's custom class to `MyViewController`:

- Open `Main.storyboard`
- Select the View Controller
- In Identity Inspector, set Custom Class to `MyViewController`, Module to `App`

### Step 3: Add Files to Xcode Project

All plugin Swift files must be in `project.pbxproj`:

1. File references in `PBXFileReference` section
2. Build files in `PBXBuildFile` section
3. Source entries in `PBXSourcesBuildPhase`
4. Group entries in `PBXGroup`

### HushhMCP Dependencies

Plugins depend on shared files in `HushhMCP/`:

| Folder      | Purpose       | Files                                                                         |
| ----------- | ------------- | ----------------------------------------------------------------------------- |
| `Cloud/`    | Cloud Run API | `VaultStorageProtocol.swift`, `LocalVaultStorage.swift`, `CloudDBProxy.swift` |
| `Database/` | SQLCipher     | `SQLCipherDatabase.swift`                                                     |
| `Sync/`     | Cloud sync    | `SyncService.swift`                                                           |
| Root        | Settings      | `Settings.swift`                                                              |

---

## Testing Checklist

Before releasing iOS updates:

### Authentication

- [ ] Test Google Sign-In native flow
- [ ] Verify Firebase credential sync
- [ ] Check onAuthStateChanged triggers

### Vault

- [ ] Verify vault unlock/lock cycle
- [ ] Test passphrase-based encryption
- [ ] Recovery key flow works

### API & Data

- [ ] API calls work against Cloud Run
- [ ] sessionStorage fallback works
- [ ] Preferences persist across launches

### Native Plugins

- [ ] All 6 plugins registered (check console for `✅ [MyViewController]`)
- [ ] Test offline behavior

### Build

- [ ] Build succeeds with all plugins
- [ ] No duplicate symbol errors
- [ ] Test on physical device (not just simulator)
