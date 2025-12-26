# Cloud Deployment Context

> Reference for AI agents on how Hushh is deployed to GCP Cloud Run.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                       │
├──────────────────────┬─────────────────────┬───────────────────┤
│    hushh-webapp      │  consent-protocol   │   Cloud SQL       │
│    (Next.js 16)      │  (FastAPI/Python)   │   (PostgreSQL)    │
│    Port: 8080        │  Port: 8000         │   hushh-vault-db  │
├──────────────────────┼─────────────────────┼───────────────────┤
│  Artifact Registry   │  Secret Manager     │   Cloud Build     │
│  Docker images       │  DATABASE_URL       │   (optional)      │
│                      │  SECRET_KEY         │                   │
│                      │  VAULT_ENCRYPTION_  │                   │
│                      │  KEY                │                   │
└──────────────────────┴─────────────────────┴───────────────────┘
```

---

## Service URLs

| Service  | URL                                                          |
| -------- | ------------------------------------------------------------ |
| Frontend | `https://hushh-webapp-1006304528804.us-central1.run.app`     |
| Backend  | `https://consent-protocol-1006304528804.us-central1.run.app` |

---

## Deployment Files

All deployment configuration files are in the `/deploy` directory:

| File                     | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `cloudbuild-webapp.yaml` | Cloud Build config for frontend (Next.js)     |
| `cloudbuild-ci.yaml`     | CI/CD pipeline for automated deployments      |
| `cloudrun-webapp.yaml`   | Cloud Run service definition (Knative format) |

---

## Environment Variables

### Next.js (hushh-webapp)

| Variable                  | Type       | Source               |
| ------------------------- | ---------- | -------------------- |
| `NEXT_PUBLIC_FIREBASE_*`  | Build-time | Docker `--build-arg` |
| `NEXT_PUBLIC_BACKEND_URL` | Build-time | Docker `--build-arg` |
| `DATABASE_URL`            | Runtime    | Secret Manager       |

> **Why build-time?** `NEXT_PUBLIC_*` vars are embedded into the JavaScript bundle at build time. They run in the browser, so they can't be injected at runtime. Firebase keys are designed to be public (security via Firebase Rules).

### Python (consent-protocol)

| Variable               | Type    | Source           |
| ---------------------- | ------- | ---------------- |
| `FRONTEND_URL`         | Runtime | `--set-env-vars` |
| `SECRET_KEY`           | Runtime | Secret Manager   |
| `VAULT_ENCRYPTION_KEY` | Runtime | Secret Manager   |

---

## Deployment Commands

### 1. Deploy Backend (consent-protocol)

**Option A: Using Cloud Build (Recommended - no local Docker needed)**

```powershell
cd consent-protocol

# Build and push via Cloud Build
gcloud builds submit --tag us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/consent-protocol:latest .

# Deploy to Cloud Run
gcloud run deploy consent-protocol `
  --image us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/consent-protocol:latest `
  --region us-central1 --allow-unauthenticated `
  --set-env-vars "FRONTEND_URL=https://hushh-webapp-rpphvsc3tq-uc.a.run.app" `
  --set-secrets "SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest" `
  --port 8000
```

**Option B: Using Local Docker**

```powershell
cd consent-protocol
docker build -t us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/consent-protocol:latest .
docker push us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/consent-protocol:latest
# Then run the gcloud run deploy command from Option A
```

### 2. Deploy Frontend (hushh-webapp)

**Option A: Using Cloud Build (Recommended)**

```powershell
cd hushh-webapp

# Build via Cloud Build config (includes NEXT_PUBLIC build args)
gcloud builds submit --config cloudbuild-webapp.yaml .

# Deploy to Cloud Run
gcloud run deploy hushh-webapp `
  --image us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/hushh-webapp:latest `
  --region us-central1 --allow-unauthenticated `
  --set-secrets DATABASE_URL=DATABASE_URL:latest `
  --port 8080 --add-cloudsql-instances hushh-pda:us-central1:hushh-vault-db
```

**Option B: Using Local Docker**

```powershell
cd hushh-webapp
docker build `
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="GCP_API_KEY_PLACEHOLDER" `
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="hushh-pda.firebaseapp.com" `
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="hushh-pda" `
  --build-arg NEXT_PUBLIC_BACKEND_URL="https://consent-protocol-rpphvsc3tq-uc.a.run.app" `
  -t us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/hushh-webapp:latest .
docker push us-central1-docker.pkg.dev/hushh-pda/cloud-run-source-deploy/hushh-webapp:latest
# Then run the gcloud run deploy command from Option A
```

---

## Secret Manager Secrets

| Secret                 | Description                    | Used By          |
| ---------------------- | ------------------------------ | ---------------- |
| `DATABASE_URL`         | Cloud SQL connection string    | hushh-webapp     |
| `SECRET_KEY`           | HMAC signing key (64-char hex) | consent-protocol |
| `VAULT_ENCRYPTION_KEY` | AES-256 key (64-char hex)      | consent-protocol |
| `BACKEND_URL`          | consent-protocol URL           | Available        |

### Creating/Updating Secrets

```powershell
# Create secret (no newline)
Write-Output "value" | Out-File -NoNewline -Encoding ASCII secret.txt
gcloud secrets create SECRET_NAME --data-file=secret.txt
Remove-Item secret.txt

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding SECRET_NAME `
  --member="serviceAccount:1006304528804-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

---

## Database (Cloud SQL)

- **Instance**: `hushh-pda:us-central1:hushh-vault-db`
- **Database**: `hushh_vault`
- **User**: `hushh_app`

### Connection String Format

```
postgresql://hushh_app:PASSWORD@/hushh_vault?host=/cloudsql/hushh-pda:us-central1:hushh-vault-db
```

### Local Development (via Cloud SQL Proxy)

```powershell
cloud-sql-proxy hushh-pda:us-central1:hushh-vault-db
# Then use: postgresql://hushh_app:PASSWORD@localhost:5432/hushh_vault
```

### Run Migrations

```powershell
cd hushh-webapp
node scripts/run-migration.mjs
```

---

## Troubleshooting

### View Cloud Run Logs

```powershell
gcloud run services logs read SERVICE_NAME --region us-central1 --limit 30
```

### Common Errors

| Error                              | Cause                                         | Fix                            |
| ---------------------------------- | --------------------------------------------- | ------------------------------ |
| `MODULE_NOT_FOUND` for `@next/*`   | `outputFileTracingExcludes` in next.config.ts | Remove the `@next` exclusion   |
| `No module named 'asyncpg'`        | Missing dependency in requirements.txt        | Add `asyncpg>=0.29.0`          |
| `No module named 'firebase_admin'` | Missing dependency in requirements.txt        | Add `firebase-admin>=6.2.0`    |
| `SECRET_KEY must be 32+ chars`     | Missing secret                                | Add via Secret Manager         |
| `SSL connection` errors            | SSL enabled for Unix socket                   | Set `ssl: false` for Cloud SQL |
| Empty JSON response                | Unhandled error in API route                  | Add try/catch error handling   |
| `VAULT_READ_REJECTED` (401)        | Missing session token in production           | Ensure X-Session-Token header  |

### Session Token Auth

In production (`isDevelopment() === false`), the vault API routes (`/api/vault/*`) require a session token.
This token is issued by the backend after login and must be:

1. Stored in `sessionStorage` (key: `session_token`)
2. Sent in `X-Session-Token` header OR `sessionToken` query param
3. Validated by the backend proxy
