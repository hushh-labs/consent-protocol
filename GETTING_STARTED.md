# Getting Started

> Quick guide to get Hushh Research running locally.

---

## Prerequisites

| Tool       | Version  | Check               |
| ---------- | -------- | ------------------- |
| Node.js    | ≥20.x    | `node --version`    |
| Python     | ≥3.11    | `python --version`  |
| PostgreSQL | Optional | For persistent data |

---

## 1. Clone and Install

```bash
# Clone the repository
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

## 2. Environment Setup

### Frontend (.env.local)

Create `hushh-webapp/.env.local`:

```env
# Firebase (get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Backend URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Database (optional - uses in-memory if not set)
# DATABASE_URL=postgresql://user:password@localhost:5432/hushh_vault
```

### Backend (optional .env)

Create `consent-protocol/.env` (optional):

```env
SECRET_KEY=your-secret-key-for-tokens
```

---

## 3. Start Development Servers

**Terminal 1 - Frontend (Next.js):**

```bash
cd hushh-webapp
npm run dev
# → http://localhost:3000
```

**Terminal 2 - Backend (FastAPI):**

```bash
cd consent-protocol
uvicorn server:app --reload --port 8000
# → http://localhost:8000
# → http://localhost:8000/docs (Swagger UI)
```

---

## 4. Quick Verification

1. Open http://localhost:3000
2. Click "Continue with Google"
3. Create a passphrase (new user) or enter existing
4. Navigate to Dashboard → Food → "Set up food preferences"
5. Complete the chat flow
6. Confirm save when prompted

---

## Optional: Docker Compose

For containerized development:

```bash
docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## Optional: Cloud SQL (PostgreSQL)

For persistent data storage using Google Cloud SQL.

### 1. Install Cloud SQL Proxy

Download from: https://cloud.google.com/sql/docs/postgres/sql-proxy

Or via PowerShell:

```powershell
Invoke-WebRequest -Uri "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.x64.exe" -OutFile "cloud-sql-proxy.exe"
```

### 2. Start the Proxy

```bash
# Terminal 3 - Cloud SQL Proxy
cloud-sql-proxy hushh-pda:us-central1:hushh-vault-db
# → Listening on 127.0.0.1:5432
```

### 3. Set DATABASE_URL

Add to `hushh-webapp/.env.local`:

```env
DATABASE_URL=postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault
```

### 4. Run Database Migration

```bash
cd hushh-webapp
node scripts/run-migration.mjs
# → Creates: vault_keys, vault_food, vault_professional, consent_audit
```

---

## Project Structure

```
hushh-research/
├── hushh-webapp/           # Next.js 16 frontend
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   └── lib/                # Utilities (vault, db)
│
├── consent-protocol/       # Python FastAPI backend
│   ├── server.py           # API endpoints
│   └── hushh_mcp/          # Agents, consent, vault
│
├── docs/                   # Documentation
│   ├── technical/          # Architecture, schemas, API
│   ├── business/           # Non-technical overview
│   └── ai-context/         # LLM context docs
│
└── docker-compose.yml      # Local dev containers
```

## Next Steps

- [Architecture](docs/technical/architecture.md) - System design
- [Consent Protocol](consent-protocol/docs/manifesto.md) - Core principles
- [Developer API](docs/technical/developer-api.md) - External integration
