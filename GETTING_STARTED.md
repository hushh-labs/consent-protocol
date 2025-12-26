# Getting Started with Hushh PDA (iOS Hybrid)

This guide covers how to set up the development environment, including the Next.js backend, Cloud SQL Proxy, and the iOS Simulator with Native Plugins.

## Prerequisites

- **Node.js**: v18+
- **Xcode**: 15+ (Mac only)
- **CocoaPods**: `sudo gem install cocoapods`
- **Cloud SQL Proxy**: Required for backend DB connection (if using Cloud SQL)

## 1. Environment Configuration

Ensure `.env.local` in `hushh-webapp/` is configured correctly:

```bash
# hushh-webapp/.env.local

# API Config (Simulator -> Mac Host)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Backend Config (WebApp -> Python Agent)
NEXT_PUBLIC_BACKEND_URL=https://consent-protocol-1006304528804.us-central1.run.app

# Firebase & Database Config...
```

## 2. Start Backend & Database

The iOS app uses a **Hybrid** model where it relays data requests to the Next.js backend (`localhost:3000`), which in turn connects to Cloud SQL.

### Step A: Start Cloud SQL Proxy (if needed)

If utilizing the Cloud SQL database, start the proxy from the project root:

```bash
# Ensure you're authenticated with GCP (one-time setup)
gcloud auth application-default login

# Start Cloud SQL Proxy (uses your GCP user credentials)
# Windows:
./cloud-sql-proxy.exe hushh-pda:us-central1:hushh-vault-db --port 5432

# macOS/Linux:
./cloud_sql_proxy hushh-pda:us-central1:hushh-vault-db --port 5432
```

> **Note:** The `service-account.json` in the repo is for Firebase Admin SDK, not Cloud SQL.
> For CI/CD, create a separate service account with Cloud SQL Client role.

### Step B: Start Next.js Server

```bash
cd hushh-webapp
npm run dev
# Server running at http://localhost:3000
```

## 3. Build & Launch iOS App

The iOS app contains **Native Swift Plugins** logic. You must rebuild if you change any native code or `VaultService` logic.

### Option A: CLI Launch (Fastest)

```bash
cd hushh-webapp
# Builds the frontend, syncs to iOS, installs on Simulator, launches app
npm run cap:ios:run
```

### Option B: Xcode Manual (Debugging)

```bash
cd hushh-webapp
npx cap open ios
# Press Cmd+R in Xcode to build and run
```

## 4. Verification

1.  **Launch App**: Ensure Simulator is running the app.
2.  **Login**: Use the login flow.
    - **Data**: The app will talk to `localhost:3000/api/vault/...`.
    - **Crypto**: Watch the Xcode Console logs. You should see `[HushhVaultPlugin] ...` logs indicating native encryption/decryption is occurring.
3.  **Hybrid Check**: The app should behave like the online webapp but utilize the device's Keychain and crypto accelerators.

## Architecture Documentation

See [docs/technical/ios-architecture.md](docs/technical/ios-architecture.md) for detailed design.
