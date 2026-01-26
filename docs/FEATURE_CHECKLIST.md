# New Feature Development Checklist

Use this checklist for EVERY new feature that involves data operations.

## Before You Start

- [ ] Read `docs/PROJECT_CONTEXT_MAP.md` Section "CRITICAL RULES"
- [ ] Understand tri-flow architecture (Web + iOS + Android)

## Backend (Python)

- [ ] Create endpoint in `consent-protocol/api/routes/{domain}.py`
- [ ] Add VAULT_OWNER token validation
- [ ] Test endpoint with curl/Postman
- [ ] Document in `docs/technical/ROUTE_CONTRACTS.md`

## Web Proxy (Next.js)

- [ ] Create proxy route: `hushh-webapp/app/api/{feature}/route.ts`
- [ ] Import `getPythonApiUrl()` helper
- [ ] Forward to Python backend endpoint
- [ ] Handle errors and return proper status codes

## iOS Native Plugin

- [ ] Create/update Swift plugin: `ios/App/App/Plugins/Hushh{Feature}Plugin.swift`
- [ ] Add `@objc` method matching service layer
- [ ] Call Python backend directly (bypass Next.js)
- [ ] Use same endpoint as web proxy calls
- [ ] Handle errors and return proper response format

## Android Native Plugin

- [ ] Create/update Kotlin plugin: `android/.../plugins/Hushh{Feature}/Hushh{Feature}Plugin.kt`
- [ ] Add `@PluginMethod` matching service layer
- [ ] Call Python backend directly (bypass Next.js)
- [ ] Use same endpoint as web proxy calls
- [ ] Handle errors and return proper response format

## TypeScript Interfaces

- [ ] Add method signature to `lib/capacitor/index.ts`
- [ ] Match plugin method names exactly (case-sensitive!)
- [ ] Document parameters and return types

## Service Layer

- [ ] Create/update service: `lib/services/{feature}-service.ts`
- [ ] Import Capacitor: `import { Capacitor } from '@capacitor/core'`
- [ ] Implement platform detection:
  ```typescript
  if (Capacitor.isNativePlatform()) {
    // Call native plugin
    return await HushhPlugin.method();
  }
  // Call Next.js proxy
  return fetch("/api/...");
  ```
- [ ] Handle errors consistently across platforms

## UI Components

- [ ] Import service: `import { FeatureService } from '@/lib/services/feature-service'`
- [ ] Use service methods only (NO direct fetch())
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Show success feedback only after confirmed save

## Testing

- [ ] Test on web (npm run dev)
- [ ] Test on iOS simulator (if available)
- [ ] Test on Android emulator
- [ ] Verify data persists after refresh
- [ ] Check for console errors on all platforms

## Documentation

- [ ] Add route to `hushh-webapp/route-contracts.json`
- [ ] Update `docs/technical/ROUTE_CONTRACTS.md` if needed
- [ ] Add JSDoc comments to service methods

## Common Mistakes to Avoid

❌ **Calling fetch() in components**
```typescript
// WRONG
const response = await fetch("/api/vault/food", { ... });
```

❌ **Service without platform detection**
```typescript
// WRONG: Always calls Next.js
static async getData() {
  return fetch("/api/...");  // Breaks on native
}
```

❌ **Missing native plugins**
- Creating `app/api/feature/route.ts` without corresponding iOS/Android plugins

✅ **Correct implementation**
```typescript
// Component
import { ApiService } from '@/lib/services/api-service';
const response = await ApiService.getData();

// Service
static async getData() {
  if (Capacitor.isNativePlatform()) {
    return await HushhVault.getData();  // Native
  }
  return fetch("/api/...");  // Web
}
```

## Verification

Before marking feature as complete:

- [ ] All 5 layers implemented (Backend, Web Proxy, iOS, Android, Service)
- [ ] Tested on web browser
- [ ] Tested on Android emulator
- [ ] Tested on iOS simulator (if available)
- [ ] No `fetch()` calls in components
- [ ] Documentation updated

## Platform-Specific Features

Not all features require all three platform implementations. Some features are
intentionally platform-specific:

### Web-Only Plugins

| Plugin | Reason | Web Implementation |
|--------|--------|-------------------|
| `HushhDatabase` | Uses IndexedDB for client-side storage | `lib/capacitor/plugins/database-web.ts` |

For web-only plugins:
- Native apps use alternative storage (e.g., `HushhVault` with SQLCipher)
- Document the limitation in the plugin file
- Service layer should gracefully handle missing native implementation

### Native-Only Features

| Plugin | Reason | Native Implementation |
|--------|--------|----------------------|
| `HushhAgent` | On-device ML inference requires native APIs | iOS: `HushhAgentPlugin.swift`, Android: `HushhAgentPlugin.kt` |

For native-only features:
- Web implementation should be a stub that returns appropriate fallback
- Document clearly that feature is not available on web
- Consider showing UI message when feature is unavailable

### Implementation Pattern for Platform-Specific Features

```typescript
// Service for native-only feature
static async runLocalInference(input: string): Promise<Result> {
  if (Capacitor.isNativePlatform()) {
    return await HushhAgent.inference({ input });
  }
  
  // Web fallback - feature not available
  console.warn("Local inference is only available on native platforms");
  return {
    available: false,
    message: "This feature requires the mobile app"
  };
}
```

## BYOK Security Checklist

For features that handle vault data:

- [ ] Encryption keys are NEVER sent to the backend
- [ ] Use `useVault().getVaultKey()` for key access (not localStorage/sessionStorage)
- [ ] Backend stores only ciphertext
- [ ] Decryption happens client-side only
- [ ] Tests use dynamically generated keys (see `TESTING.md`)

## See Also

- [Project Context Map](PROJECT_CONTEXT_MAP.md) - Tri-flow architecture rules
- [Component README](../hushh-webapp/components/README.md) - Component guidelines
- [Route Contracts](technical/ROUTE_CONTRACTS.md) - Endpoint documentation
- [Architecture](technical/architecture.md) - System design
- [Testing Guide](../TESTING.md) - BYOK-compliant testing
- [Security Policy](../SECURITY.md) - Security guidelines
