# Getting Started with Hushh Research

> **Quick start guide for developers** - Updated January 2026 with VAULT_OWNER token architecture

---

## 🎯 What You're Building

Hushh is a **consent-first personal data agent system** with:

- **Zero-knowledge vault** encrypted on-device
- **VAULT_OWNER tokens** for secure vault access (stateless, self-contained)
- **Modular agents** (Food, Professional, Kai) with uniform consent validation
- **Multi-platform** support: Web, iOS, Android

---

## Prerequisites

### Required

- **Node.js**: v20+ (for Next.js 15)
- **Python**: 3.11+ (for FastAPI backend)
- **PostgreSQL**: Cloud SQL or local instance
- **Firebase Project**: For authentication

### Platform-Specific

- **iOS**: Xcode 15+, CocoaPods
- **Android**: Android Studio, SDK 34+
- **macOS**: Required for iOS development

---

## 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/hushh-labs/hushh-research.git
cd hushh-research

# Install frontend dependencies
cd hushh-webapp
npm install

# Install backend dependencies
cd ../consent-protocol
pip install -r requirements.txt
```

---

## 2. Environment Configuration

### Backend (consent-protocol/.env)

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://user:password@localhost:5432/hushh_vault

# Secret Key (for HMAC token signing)
SECRET_KEY=your-secret-key-here

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Port (default: 8000)
PORT=8000
```

### Frontend (hushh-webapp/.env.local)

```bash
# Backend URL (used by web + native routing)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Next.js API proxy target (server-side)
# If not set, proxies default to http://localhost:8000 in development.
PYTHON_API_URL=http://localhost:8000

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Database Proxy (for /api routes)
DATABASE_URL=postgresql://user:password@localhost:5432/hushh_vault
```

---

## 3. Database Setup

### Option A: Cloud SQL (Production-like)

```bash
# Install Cloud SQL Proxy
# Windows: Download cloud-sql-proxy.exe
# macOS: brew install cloud-sql-proxy

# Authenticate with GCP
gcloud auth application-default login

# Start proxy (replace with your instance)
# Windows:
./cloud-sql-proxy.exe hushh-pda:us-central1:hushh-vault-db --port 5432

# macOS/Linux:
./cloud-sql-proxy hushh-pda:us-central1:hushh-vault-db --port 5432
```

### Option B: Local PostgreSQL

```bash
# Create database
createdb hushh_vault

# Run migrations (if available)
cd consent-protocol
python db/migrate.py --full
```

---

## 4. Start Development Servers

### Terminal 1: Backend (FastAPI)

```bash
cd consent-protocol
python -m uvicorn server:app --reload --port 8000

# Expected output:
# ✅ PostgreSQL connection pool created
# 🔑 Food Agent loaded
# 💼 Professional Profile Agent ready
# 🚀 Hushh Consent Protocol server initialized - KAI V2 ENABLED
# INFO: Uvicorn running on http://127.0.0.1:8000
```

### Terminal 2: Frontend (Next.js)

```bash
cd hushh-webapp
npm run dev

# Expected output:
# ▲ Next.js 15.1.3
# - Local: http://localhost:3000
# ✓ Compiled in 2.3s
```

---

## 5. Verify Setup

### Web Application

1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Create vault with passphrase
4. Check browser console for:
   ```
   ✅ VAULT_OWNER token issued
   ✅ Vault unlocked
   ```

### Backend Health Check

```bash
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": 1735968000
}
```

---

## 6. iOS Development (Optional)

### First-Time Setup

```bash
cd hushh-webapp
npm run build:ios  # Builds Next.js + syncs to iOS

cd ios/App
pod install        # Installs iOS dependencies
```

### Launch iOS Simulator

```bash
# Quick launch (recommended)
cd hushh-webapp
npm run cap:ios:run

# OR open in Xcode
npx cap open ios
# Press Cmd+R to build and run
```

### Verify Native Plugins

Check Xcode console for:

```
🔑 [HushhConsent] VAULT_OWNER token issued
🔐 [HushhVault] Native encryption using Keychain
```

---

## 7. Android Development (Optional)

### First-Time Setup

```bash
cd hushh-webapp
npm run build:android  # Builds Next.js + syncs to Android

# Open in Android Studio
npx cap open android
```

### Launch Android Emulator

```bash
# In Android Studio:
# 1. Select emulator
# 2. Click Run button (Ctrl+R / Cmd+R)
```

---

## 8. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   HUSHH STACK                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Frontend (Next.js 15 + Capacitor)                  │
│  ├─ Web: http://localhost:3000                      │
│  ├─ iOS: Native Swift plugins                       │
│  └─ Android: Native Kotlin plugins                  │
│                                                      │
│  Backend (FastAPI + Python)                         │
│  ├─ Consent Protocol (VAULT_OWNER tokens)           │
│  ├─ Modular Agents (Food, Professional, Kai)        │
│  └─ MCP Server (AI agent integration)               │
│                                                      │
│  Storage (PostgreSQL + Cloud SQL)                   │
│  └─ E2E Encrypted Vault                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 9. Key Features to Test

### VAULT_OWNER Token Flow ✨ NEW!

1. **Unlock vault** → Backend issues VAULT_OWNER token
2. **Token stored** in React Context (memory-only)
3. **Access data** → Food/Professional pages validate token
4. **Logout** → Token cleared from memory

### Test Endpoints

```bash
# Issue VAULT_OWNER token (requires Firebase ID token)
curl -X POST http://localhost:8000/api/consent/vault-owner-token \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -d '{"userId": "user123"}'

# Get food preferences (requires VAULT_OWNER token)
curl -X POST http://localhost:8000/api/food/preferences \
  -d '{"userId": "user123", "consentToken": "HCT:..."}'

# Get professional data (requires VAULT_OWNER token)
curl -X POST http://localhost:8000/api/professional/preferences \
  -d '{"userId": "user123", "consentToken": "HCT:..."}'
```

---

## 10. Common Issues

### Backend won't start

```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -l

# Check Python dependencies
pip install -r requirements.txt
```

### Frontend won't compile

```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### iOS build fails

```bash
# Clean build
cd ios/App
pod deintegrate
pod install

# Re-sync Capacitor
cd ../../
npx cap sync ios
```

### Database connection errors

```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

---

## 11. Next Steps

- **Architecture**: Read `docs/technical/architecture.md`
- **Consent Protocol**: Read `docs/technical/consent-implementation.md`
- **Mobile**: Read `docs/technical/mobile.md`
- **API Reference**: Read `docs/technical/developer-api.md`

---

## 12. VS Code Setup (Recommended)

Install extensions:

- **Python** - Microsoft
- **Pylance** - Microsoft
- **ESLint** - Microsoft
- **Prettier** - Prettier
- **Swift** - Apple (for iOS)

### Debug Configuration

See `.vscode/launch.json` for:

- **Next.js Debugger** (Chrome)
- **FastAPI Debugger** (Python)
- Combined concurrent debugging

---

## 🆘 Get Help

- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Architecture Questions**: Check `docs/technical/`

---

_Last Updated: January 2026 | Version: 5.0 | VAULT_OWNER Token Release_
