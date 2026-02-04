# Environment Variables and Secrets Reference

> Single source of truth for env vars and Secret Manager parity.  
> See also: [deploy/README.md](../../deploy/README.md), [deploy/.env.backend.example](../../deploy/.env.backend.example), [deploy/.env.frontend.example](../../deploy/.env.frontend.example).

---

## Backend (consent-protocol)

| Variable | Required | Secret | Where set | Notes |
|----------|----------|--------|-----------|--------|
| `SECRET_KEY` | Yes | Yes | Local: `.env`; Prod: Secret Manager | 32+ chars; HMAC signing |
| `VAULT_ENCRYPTION_KEY` | Yes | Yes | Local: `.env`; Prod: Secret Manager | 64-char hex |
| `DB_USER` | Yes | Yes (prod) | Local: `.env`; Prod: Secret Manager | Supabase pooler username |
| `DB_PASSWORD` | Yes | Yes (prod) | Local: `.env`; Prod: Secret Manager | DB password |
| `DB_HOST` | Yes | No | Local: `.env`; Prod: Cloud Run env | Pooler host |
| `DB_PORT` | No | No | Local: `.env`; Prod: Cloud Run env (default 5432) | |
| `DB_NAME` | No | No | Local: `.env`; Prod: Cloud Run env (default postgres) | |
| `FRONTEND_URL` | Yes | Yes (prod) | Local: `.env`; Prod: Secret Manager | CORS |
| `GOOGLE_API_KEY` | Yes (for Gemini) | Yes | Local: `.env`; Prod: Secret Manager | Or GEMINI_API_KEY |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes (auth) | Yes | Local: `.env`; Prod: Secret Manager | JSON string |
| `ENVIRONMENT` | No | No | Default development; Prod: Cloud Run | production / development |
| `GOOGLE_GENAI_USE_VERTEXAI` | No | No | Local: `.env`; Prod: Cloud Run env | True for Vertex AI |
| `AGENT_ID` | No | No | `.env` (default agent_hushh_default) | |
| `HUSHH_HACKATHON` | No | No | `.env` (default disabled) | |
| `DEFAULT_CONSENT_TOKEN_EXPIRY_MS` | No | No | `.env` | |
| `DEFAULT_TRUST_LINK_EXPIRY_MS` | No | No | `.env` | |
| `CONSENT_TIMEOUT_SECONDS` | No | No | `.env` / MCP config | |
| `PORT` | No | No | `.env` (default 3000) | |
| `ROOT_PATH` | No | No | Optional | |

**CI (GitHub Actions):** Backend tests use `TESTING=true`, dummy `SECRET_KEY`, and dummy `VAULT_ENCRYPTION_KEY`; no `.env` file required.

### MCP-only vars (not required for backend API runtime)

These are used by MCP modules (`mcp_modules/`) for MCP server functionality, not by the FastAPI backend:

- `CONSENT_API_URL` - MCP server FastAPI URL (defaults to `http://localhost:8000`)
- `PRODUCTION_MODE` - MCP server production mode flag
- `MCP_DEVELOPER_TOKEN` - MCP developer token for debugging
- `CONSENT_POLL_INTERVAL_SECONDS` - MCP consent polling interval

**Note:** These are not required for Cloud Run backend deployment; only needed when running the MCP server locally.

---

## Frontend (hushh-webapp)

| Variable | Required | Secret | Where set | Notes |
|----------|----------|--------|-----------|--------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | No | Local: `.env.local`; Prod build: Secret Manager (BACKEND_URL) | Baked at build time |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | No | Local: `.env.local`; CI: dummy; Prod: build-arg | Public |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | No | Same as above | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | No | Same as above | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No (recommended) | No | `.env.local` / CI / Prod build-arg | Optional but recommended for full Firebase features |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No (recommended) | No | Same | Optional but recommended for full Firebase features |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No (recommended) | No | Same | Optional but recommended for full Firebase features |
| `NEXT_PUBLIC_APP_REVIEW_MODE` | No | No | Prod build: Secret Manager | true/false |
| `NEXT_PUBLIC_REVIEWER_EMAIL` | If app review | Yes (prod) | Prod build: Secret Manager | |
| `NEXT_PUBLIC_REVIEWER_PASSWORD` | If app review | Yes (prod) | Prod build: Secret Manager | |
| `CAPACITOR_BUILD` | For native build | No | Set by npm script | true for cap:build |
| `ENVIRONMENT_MODE` | No | No | development / production | |
| `NODE_ENV` | No | No | Set by Next.js / CI | |
| `BACKEND_URL` | Server-side | No | Same as NEXT_PUBLIC_BACKEND_URL where used | |
| `SESSION_SECRET` | If using session API | Yes | Server env only | Not in client |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server-side Firebase | Yes | Server env only | |
| `NEXT_PUBLIC_CONSENT_TIMEOUT_SECONDS` | No | No | Optional; sync with backend | |
| `NEXT_PUBLIC_FRONTEND_URL` | No | No | Optional | |

**CI:** Frontend build uses dummy Firebase vars and `NEXT_PUBLIC_BACKEND_URL=https://api.example.com`; no `.env.local` required.

**Prod build (Cloud Build):** Secrets `BACKEND_URL`, `APP_REVIEW_MODE`, `REVIEWER_EMAIL`, `REVIEWER_PASSWORD` are passed as build-args from Secret Manager.

### Legacy/Deprecated vars

- ~~`NEXT_PUBLIC_CONSENT_API_URL`~~ - **Removed**: Use `NEXT_PUBLIC_BACKEND_URL` instead. Updated in `lib/api/consent.ts` to use `NEXT_PUBLIC_BACKEND_URL`.

---

## Secret Manager (GCP)

### Backend (7 secrets)

- `SECRET_KEY`
- `VAULT_ENCRYPTION_KEY`
- `GOOGLE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FRONTEND_URL`
- `DB_USER`
- `DB_PASSWORD`

**Note:** `DB_HOST`, `DB_PORT`, `DB_NAME` are set as Cloud Run env vars (not secrets). `DATABASE_URL` may exist in Secret Manager for migration scripts (`db/migrate.py`) but is not used by runtime code.

### Frontend (4 secrets, build-time only)

- `BACKEND_URL`
- `APP_REVIEW_MODE`
- `REVIEWER_EMAIL`
- `REVIEWER_PASSWORD`

Verify with `deploy/verify-secrets.ps1` (or equivalent); see [deploy/README.md](../../deploy/README.md).

---

## Where variables are set

| Context | Backend | Frontend |
|---------|---------|----------|
| Local dev | `consent-protocol/.env` (from `.env.example`) | `hushh-webapp/.env.local` |
| CI | Env in workflow (dummy keys, TESTING=true) | Env in workflow (dummy Firebase, BACKEND_URL) |
| Production | Secret Manager + Cloud Run env (GOOGLE_GENAI_USE_VERTEXAI, ENVIRONMENT) | Secret Manager → build-args in Dockerfile |
