# Environment Variables and Secrets Reference

> Single source of truth for env vars and **strict parity** with code and GCP Secret Manager.  
> **Rule:** What is in `.env` / Secret Manager must match exactly what the code reads — no extra keys, no missing keys.

See also: [deploy/README.md](../../deploy/README.md), [consent-protocol/.env.example](../../consent-protocol/.env.example), [hushh-webapp/.env.example](../../hushh-webapp/.env.example), [deploy/.env.backend.example](../../deploy/.env.backend.example), [deploy/.env.frontend.example](../../deploy/.env.frontend.example). For FCM push notifications, see [fcm-notifications.md](../../consent-protocol/docs/reference/fcm-notifications.md).

---

## Parity rule: code ↔ .env ↔ Secret Manager

- **Local:** `.env` (backend) and `.env.local` (frontend) must contain exactly the keys the application code reads. Use the repo `.env.example` files as the template; they are audited to match the code.
- **Production:** GCP Secret Manager must hold **exactly** the secrets the code expects — no more, no less. The Cloud Build config (`deploy/*.cloudbuild.yaml`) injects only these; do not add secrets that are not read by the code, and do not remove any that are.

---

## Audit: env vars read by code

### Backend (consent-protocol)

| Variable | Where read | Required | Notes |
|----------|------------|----------|--------|
| `SECRET_KEY` | `hushh_mcp/config.py` | Yes | Min 32 chars (64-char hex recommended) |
| `VAULT_ENCRYPTION_KEY` | `hushh_mcp/config.py` | Yes | Exactly 64-char hex |
| `DB_USER` | `db/connection.py`, `db/db_client.py` | Yes | |
| `DB_PASSWORD` | same | Yes | |
| `DB_HOST` | same | Yes | |
| `DB_PORT` | same | No (default 5432) | |
| `DB_NAME` | same | No (default postgres) | |
| `FRONTEND_URL` | `server.py` | Yes (prod CORS) | |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `api/utils/firebase_admin.py` | Yes (auth) | |
| `GOOGLE_API_KEY` | `hushh_mcp/config.py`, services | Yes (Gemini/Vertex) | |
| `DEFAULT_CONSENT_TOKEN_EXPIRY_MS` | `hushh_mcp/config.py` | No | |
| `DEFAULT_TRUST_LINK_EXPIRY_MS` | same | No | |
| `ENVIRONMENT` | `hushh_mcp/config.py`, `api/routes/debug_firebase.py` | No | |
| `AGENT_ID` | `hushh_mcp/config.py` | No | |
| `HUSHH_HACKATHON` | `hushh_mcp/config.py` | No | |
| `CONSENT_TIMEOUT_SECONDS` | `api/routes/sse.py`, `developer.py` | No | |
| `ROOT_PATH` | `server.py` | No | |
| `GOOGLE_GENAI_USE_VERTEXAI` | Cloud Run env (Gemini SDK) | No | Set in deploy, not in .env |

**Migrations/scripts:** Use **DB_*** only (same as runtime). `db/migrate.py` uses `db.connection.get_database_url()` and `get_database_ssl()`. No `DATABASE_URL` anywhere.

### Frontend (hushh-webapp)

| Variable | Where read | Required | Notes |
|----------|------------|----------|--------|
| `NEXT_PUBLIC_BACKEND_URL` | `lib/api/consent.ts`, `lib/config.ts`, api routes, etc. | Yes | Prod build: from Secret Manager `BACKEND_URL` |
| `NEXT_PUBLIC_FIREBASE_*` (6 keys) | `lib/firebase/config.ts` | Yes | API key, auth domain, project ID, storage bucket, messaging sender ID, app ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | `lib/notifications/fcm-service.ts` | No (for push) | Web FCM token registration; from Firebase Console. See [fcm-notifications.md](../../consent-protocol/docs/reference/fcm-notifications.md). |
| `NEXT_PUBLIC_APP_REVIEW_MODE` | `lib/config.ts` | No | |
| `NEXT_PUBLIC_REVIEWER_EMAIL` | `lib/config.ts` | If app review | |
| `NEXT_PUBLIC_REVIEWER_PASSWORD` | `lib/config.ts` | If app review | |
| `NEXT_PUBLIC_CONSENT_TIMEOUT_SECONDS` | `lib/constants.ts` | No | |
| `NEXT_PUBLIC_FRONTEND_URL` | `lib/config.ts` | No | |
| `CAPACITOR_BUILD` | `next.config.ts` | Build script | |
| `BACKEND_URL` | Server-side api routes | No | Fallback for NEXT_PUBLIC_BACKEND_URL |
| `SESSION_SECRET` | `lib/auth/session.ts` | If session API | Server-only |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `lib/firebase/admin.ts` | Server-side Firebase | Server-only |

---

## Backend (consent-protocol) — reference

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
| `PORT` | No | No | Optional (uvicorn/runner) | |
| `ROOT_PATH` | No | No | Optional (Swagger) | |

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
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | No (for push) | No | Same | **Web push (FCM)**: VAPID key from Firebase Console -> Cloud Messaging -> Web configuration -> Key pair. Required for consent push on web. See [fcm-notifications.md](../../consent-protocol/docs/reference/fcm-notifications.md). |
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

## Secret Manager (GCP) — strict parity with code

Secret Manager must hold **exactly** the keys the code uses. No extra secrets; no missing secrets. Cloud Build injects only these.

### Backend (7 secrets) — all injected by `deploy/backend.cloudbuild.yaml`

| Secret name | Env var / usage in code |
|-------------|-------------------------|
| `SECRET_KEY` | `SECRET_KEY` (hushh_mcp/config.py) |
| `VAULT_ENCRYPTION_KEY` | `VAULT_ENCRYPTION_KEY` (hushh_mcp/config.py) |
| `GOOGLE_API_KEY` | `GOOGLE_API_KEY` (config + Gemini/Vertex services) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `FIREBASE_SERVICE_ACCOUNT_JSON` (api/utils/firebase_admin.py) |
| `FRONTEND_URL` | `FRONTEND_URL` (server.py CORS) |
| `DB_USER` | `DB_USER` (db/connection.py, db/db_client.py) |
| `DB_PASSWORD` | `DB_PASSWORD` (same) |

**Not in Secret Manager (set as Cloud Run env vars in cloudbuild):** `DB_HOST`, `DB_PORT`, `DB_NAME`, `ENVIRONMENT`, `GOOGLE_GENAI_USE_VERTEXAI`.

**Strict parity:** `DATABASE_URL` is not used anywhere. Migrations (`db/migrate.py`) use **DB_*** only, via `db.connection.get_database_url()`. Do **not** create or keep `DATABASE_URL` in Secret Manager; delete it if present.

### Frontend (4 secrets, build-time only) — all used by `deploy/frontend.cloudbuild.yaml`

| Secret name | Build-arg / usage in code |
|-------------|---------------------------|
| `BACKEND_URL` | `NEXT_PUBLIC_BACKEND_URL` (baked into client) |
| `APP_REVIEW_MODE` | `NEXT_PUBLIC_APP_REVIEW_MODE` (lib/config.ts) |
| `REVIEWER_EMAIL` | `NEXT_PUBLIC_REVIEWER_EMAIL` (lib/config.ts) |
| `REVIEWER_PASSWORD` | `NEXT_PUBLIC_REVIEWER_PASSWORD` (lib/config.ts) |

### gcloud CLI: list and create only these secrets

```bash
# List existing secrets (ensure only the 11 above exist for this project)
gcloud secrets list --project=YOUR_PROJECT_ID

# Create a missing backend secret (repeat for each of the 7 names)
gcloud secrets create SECRET_KEY --replication-policy=automatic --project=YOUR_PROJECT_ID
echo -n "your-value" | gcloud secrets versions add SECRET_KEY --data-file=- --project=YOUR_PROJECT_ID

# Create a missing frontend secret (repeat for each of the 4 names)
gcloud secrets create BACKEND_URL --replication-policy=automatic --project=YOUR_PROJECT_ID
echo -n "https://your-backend.run.app" | gcloud secrets versions add BACKEND_URL --data-file=- --project=YOUR_PROJECT_ID
```

**Required backend 7:** `SECRET_KEY`, `VAULT_ENCRYPTION_KEY`, `GOOGLE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FRONTEND_URL`, `DB_USER`, `DB_PASSWORD`.  
**Required frontend 4:** `BACKEND_URL`, `APP_REVIEW_MODE`, `REVIEWER_EMAIL`, `REVIEWER_PASSWORD`.  

**Note:** Consent push on web uses FCM and requires `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (from Firebase Console, not Secret Manager). See [fcm-notifications.md](../../consent-protocol/docs/reference/fcm-notifications.md).

**Delete if present (strict parity):** `DATABASE_URL` is not used anywhere. To remove:
```bash
gcloud secrets delete DATABASE_URL --project=YOUR_PROJECT_ID
```

Verify with `deploy/verify-secrets.ps1` (or equivalent); see [deploy/README.md](../../deploy/README.md).

---

## Where variables are set

| Context | Backend | Frontend |
|---------|---------|----------|
| Local dev | `consent-protocol/.env` (from `.env.example`) | `hushh-webapp/.env.local` |
| CI | Env in workflow (dummy keys, TESTING=true) | Env in workflow (dummy Firebase, BACKEND_URL) |
| Production | Secret Manager + Cloud Run env (GOOGLE_GENAI_USE_VERTEXAI, ENVIRONMENT) | Secret Manager → build-args in Dockerfile |
