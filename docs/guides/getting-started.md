# Getting Started

> Prerequisites, environment setup, running locally, CI, and deployment.

---

## Prerequisites

| Tool    | Version   | Install                                |
| ------- | --------- | -------------------------------------- |
| Node.js | 20+       | [nodejs.org](https://nodejs.org/)      |
| Python  | 3.13+     | [python.org](https://python.org/)      |
| pnpm    | 9+        | `npm install -g pnpm` (or use npm)     |
| Git     | latest    | [git-scm.com](https://git-scm.com/)   |

Optional for mobile builds:

| Tool     | Version | Purpose             |
| -------- | ------- | ------------------- |
| Xcode    | 16+     | iOS builds          |
| CocoaPods| latest  | iOS dependencies    |
| Android Studio | latest | Android builds |

---

## Clone and Setup

```bash
git clone https://github.com/hushh-labs/hushh-research.git
cd hushh-research
```

### Backend Environment

```bash
cd consent-protocol
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

Create `.env` from the example:

```bash
cp .env.example .env
```

Required variables in `.env`:

| Variable               | Purpose                          | Example                          |
| ---------------------- | -------------------------------- | -------------------------------- |
| `DB_USER`              | Supabase pooler user             | `postgres.xxxxx`                 |
| `DB_PASSWORD`          | Supabase pooler password         | `your-password`                  |
| `DB_HOST`              | Supabase pooler host             | `aws-1-us-east-1.pooler.supabase.com` |
| `DB_PORT`              | Supabase pooler port             | `5432`                           |
| `DB_NAME`              | Database name                    | `postgres`                       |
| `GOOGLE_API_KEY`       | Gemini API key                   | `AIza...`                        |
| `CONSENT_TOKEN_SECRET` | HMAC signing secret              | `your-secret`                    |
| `FIREBASE_*`           | Firebase Admin SDK config        | (see `.env.example`)             |

### Frontend Environment

```bash
cd hushh-webapp
npm install
```

Create `.env.local`:

```bash
cp .env.example .env.local   # if exists, otherwise create manually
```

Required variables in `.env.local`:

| Variable                            | Purpose                  |
| ----------------------------------- | ------------------------ |
| `NEXT_PUBLIC_BACKEND_URL`           | Backend URL              |
| `NEXT_PUBLIC_FIREBASE_API_KEY`      | Firebase web config      |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`  | Firebase auth domain     |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`   | Firebase project ID      |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY`    | FCM VAPID key            |

---

## Running Locally

### Backend (Terminal 1)

```bash
cd consent-protocol
source .venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Health check: `curl http://localhost:8000/health`

### Frontend (Terminal 2)

```bash
cd hushh-webapp
npm run dev
```

Open: `http://localhost:3000`

### Both Together

| Server   | URL                      | Health Check                        |
| -------- | ------------------------ | ----------------------------------- |
| Backend  | `http://localhost:8000`  | `curl http://localhost:8000/health` |
| Frontend | `http://localhost:3000`  | Open in browser                     |

---

## Running CI Locally

### Frontend

```bash
cd hushh-webapp
npx eslint .                    # Linting
npx tsc --noEmit                # Type checking
npx vitest run                  # Tests
```

### Backend

```bash
cd consent-protocol
source .venv/bin/activate
ruff check .                    # Linting
mypy .                          # Type checking (if configured)
pytest                          # Tests
```

---

## Deployment

### Cloud Run (Backend)

The backend deploys to Google Cloud Run via GitHub Actions.

**Workflow**: `.github/workflows/ci.yml`

| Branch              | Action                                      |
| ------------------- | ------------------------------------------- |
| `main`              | Auto-deploy to production                   |
| `feat/*`            | CI checks only (no deploy)                  |
| Manual trigger       | Actions > Tri-Flow CI > scope: `backend`   |

**Manual deploy**:

```bash
cd consent-protocol
gcloud run deploy consent-protocol \
  --source . \
  --region us-east1 \
  --port 8000 \
  --allow-unauthenticated
```

### GCP Secret Manager

Backend secrets are stored in GCP Secret Manager and injected at runtime:

| Secret                         | Description              |
| ------------------------------ | ------------------------ |
| `GOOGLE_API_KEY`               | Gemini API key           |
| `DB_USER`                      | Database user            |
| `DB_PASSWORD`                  | Database password        |
| `DB_HOST`                      | Database host            |
| `CONSENT_TOKEN_SECRET`         | Token signing secret     |
| `FIREBASE_PROJECT_ID`          | Firebase project         |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase admin SDK       |

### Frontend (Vercel / Static)

The frontend deploys as a static Next.js build:

```bash
cd hushh-webapp
npm run build
```

For Capacitor mobile builds, see [Mobile Development](./mobile.md).

---

## Database Migrations

SQL migrations live in `consent-protocol/db/migrations/`. Apply them in order:

```bash
# Example: apply migration 013
psql $DATABASE_URL < db/migrations/013_jsonb_merge_rpc.sql
```

Or apply directly in the Supabase SQL Editor.

---

## Troubleshooting

| Problem                                          | Solution                                                    |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `ModuleNotFoundError: google.genai`              | `pip install google-genai` (not `google-generativeai`)      |
| Backend returns 401 on all requests              | Vault not unlocked -- unlock vault first to get VAULT_OWNER token |
| Frontend shows blank page                        | Check `.env.local` has correct `NEXT_PUBLIC_BACKEND_URL`    |
| `Illegal header value` in Cloud Run              | API key has trailing newline -- check `config.py` strips it |
| iOS build fails with hex digit error             | Plugin IDs in `project.pbxproj` must be 24-char hex (0-9, A-F) |
| `fetch is not defined` on native                 | Use `ApiService` instead of direct `fetch()` calls          |
| ESLint reports `no direct fetch`                 | Add to fetch override list in `eslint.config.mjs` if SSE    |
| Database connection timeout                       | Check `DB_HOST` uses Supabase Session Pooler, not direct    |
| Portfolio data not rendering after import         | `normalizeStoredPortfolio()` may need updating for new fields|

---

## See Also

- [Architecture](../reference/architecture.md) -- System overview
- [Agent Development](../../consent-protocol/docs/reference/agent-development.md) -- Building new agents
- [Mobile Development](./mobile.md) -- Capacitor iOS/Android
- [New Feature Checklist](./new-feature.md) -- Adding a feature end-to-end
