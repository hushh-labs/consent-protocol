# Mobile Architecture & Native Integration

## Overview

The Hushh mobile app is built using **Capacitor** with a **Next.js Static Export** (`output: 'export'`). This architecture allows us to reuse the web codebase while leveraging native platform features.

## Core Challenges & Solutions

### 1. API Routing (The "No Server" Problem)

Since Capacitor apps run as static files on the device, there is no Next.js Node.js server to handle `/api/*` routes.

**Solution: "Native-Aware Service Layer"**
We implemented a unified `ApiService` (`lib/services/api-service.ts`) that detects the platform:

- **Web**: Requests go to relative paths `/api/*` (handled by Next.js server).
- **Native (iOS/Android)**: Requests are routed directly to the production **Cloud Run Backend** (`https://consent-protocol-*.run.app/api/*`).

> **Note**: This requires all API endpoints used by the mobile app to be available on the Python/Cloud Run backend. Next.js-only API routes (like custom agents implemented in TypeScript) will not work on mobile unless ported.

### 2. Session Persistence

`sessionStorage` is unreliable in mobile WebViews (often cleared by OS or on app restart).

**Solution: Platform-Aware Storage Utility**
We created `lib/utils/session-storage.ts`:

- **Web**: Uses standard `sessionStorage`.
- **Native**: Uses **Capacitor Preferences** (persistent key-value store).
  - Keys are prefixed with `_session_` to mimic session behavior.
  - `clearSessionStorage()` manually removes these keys on logout.

### 3. Secure Vault Storage

Sensitive data (encryption keys) must be stored securely.

**Solution: Hybrid Vault Service**
`lib/services/vault-service.ts` abstracts the storage mechanism:

- **Web**: Uses `localStorage` (encrypted) + standard Crypto API.
- **Native**: Uses custom **HushhVaultPlugin** (Swift/Kotlin) to store keys in **Secure Enclave** (iOS) or **Keystore** (Android).

## Component Compatibility

| Feature          | Web Support | Native Support | Implementation Note                                                |
| :--------------- | :---------: | :------------: | :----------------------------------------------------------------- |
| **Auth**         |     ✅      |       ✅       | Uses `ApiService` / Firebase Auth (Native uses `HushhAuth` plugin) |
| **Vault**        |     ✅      |       ✅       | Critical ops use Native Plugin for security                        |
| **Consent Flow** |     ✅      |       ✅       | `ApiService` routes to Cloud Run                                   |
| **Food Agent**   |     ✅      |       ⚠️       | Chat logic routed to backend; requires Python implementation       |
| **SSE Events**   |     ✅      |       ✅       | `sse-context` connects directly to Cloud Run on Native             |

## Developer Workflow

To ensure compatibility:

1. Always use `ApiService` for backend calls. Never use `fetch` directly for API.
2. Always use `getSessionItem` / `setSessionItem` for session data.
3. Test changes on **Android Emulator** or **iOS Simulator** to verify API routing.
