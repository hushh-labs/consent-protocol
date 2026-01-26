# Cloud Deployment Context

> Reference for AI agents on how Hushh is deployed to GCP Cloud Run.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                       │
├──────────────────────┬─────────────────────┬───────────────────┤
│    hushh-webapp      │  consent-protocol   │   Cloud SQL       │
│    (Next.js 15)      │  (FastAPI/Python)   │   (PostgreSQL)    │
│    Port: 8080        │  Port: 8080         │   hushh-vault-db  │
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

## Deployment Commands

### Automated Deployment (GitHub Actions)

**Recommended:** Push to the `deploy` branch to trigger automated deployment via GitHub Actions.

```bash
git push origin main:deploy
```

The workflow in `.github/workflows/deploy-production.yml` handles:
1. Building Docker images via Cloud Build
2. Deploying to Cloud Run
3. Managing secrets

### Manual Deployment (Reference)

#### 1. Deploy Backend (consent-protocol)

```bash
cd consent-protocol

# Build using Cloud Build config
gcloud builds submit --config ../deploy/backend.cloudbuild.yaml .

# Or manually:
gcloud builds submit --tag gcr.io/PROJECT_ID/consent-protocol:latest .

gcloud run deploy consent-protocol \
  --image gcr.io/PROJECT_ID/consent-protocol:latest \
  --region us-central1 --allow-unauthenticated \
  --set-secrets "SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest" \
  --port 8080
```

#### 2. Deploy Frontend (hushh-webapp)

```bash
cd hushh-webapp

# Build using Cloud Build config
gcloud builds submit --config ../deploy/frontend.cloudbuild.yaml .

# Or manually:
gcloud builds submit --tag gcr.io/PROJECT_ID/hushh-webapp:latest .

gcloud run deploy hushh-webapp \
  --image gcr.io/PROJECT_ID/hushh-webapp:latest \
  --region us-central1 --allow-unauthenticated \
  --port 8080
```

### Deploy Directory Contents

```
deploy/
├── backend.cloudbuild.yaml    # Backend Cloud Build config
├── frontend.cloudbuild.yaml   # Frontend Cloud Build config
├── .env.backend.example       # Backend env template
├── .env.frontend.example      # Frontend env template
└── README.md                  # Deployment instructions
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
