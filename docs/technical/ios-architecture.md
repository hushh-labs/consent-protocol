# Hushh PDA - iOS Architecture (Hybrid)

## Overview

The iOS application uses a **Hybrid Online** architecture, combining the flexibility of the Next.js frontend with the security and performance of Native Swift plugins.

## Core Components

### 1. Frontend (Capacitor)

- **Framework**: Next.js (Static Export)
- **UI**: Morphy UX (Tailwind + Radix UI)
- **Logic**: TypeScript

### 2. Native Plugins (Swift)

The core "Consent Protocol" and security logic are implemented natively:

- **HushhConsentPlugin**: Handles Token Issuance, Validation, and Revocation (HMAC-SHA256).
- **HushhVaultPlugin**: Handles PBKDF2 Key Derivation and AES-256-GCM Encryption.
- **HushhKeychainPlugin**: Securely stores keys/secrets using iOS Keychain (Biometric protected).

### 3. Data Flow (Hybrid)

To maintain online functionality without running a local Python backend on the phone:

- **Data Fetching**: The app relays requests to the Cloud API (e.g. `https://consent-protocol...` or Next.js API Routes).
- **Cryptography**: The app intercepts sensitive operations (Login, Create Vault) via `VaultService`.
  - Instead of sending the passphrase to the server, it is processed locally by `HushhVaultPlugin`.
  - Only the _Results_ (e.g. Encrypted Vault Key) provided by the server are utilized.
  - Decryption happens locally.

## Vault Service (`lib/services/vault-service.ts`)

A unified abstraction layer that switches logic based on platform:

| Operation     | Platform | Implementation                       |
| ------------- | -------- | ------------------------------------ |
| `checkVault`  | Web      | Fetch `/api/vault/check`             |
|               | **iOS**  | Fetch `API_URL/api/vault/check`      |
| `unlockVault` | Web      | Client-side Web Crypto               |
|               | **iOS**  | **Native Swift Plugin** (HushhVault) |

## Build Process

1. **Exclude API Routes**: `app/api` is renamed during build to enable Static Export.
2. **Static Export**: `next build` generates HTML/CSS/JS.
3. **Sync**: Capacitor copies assets to `ios/App/App/public`.
4. **Compile**: Xcode compiles Swift Plugins + WebView.

## Future: Local MCP

Planned integration to run the MCP Server logic directly on iOS (offline-first), removing the dependency on the Cloud Relay for core queries.
