# Cloud Deployment Context

> Reference for AI agents on how Hushh is deployed to GCP Cloud Run.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                       │
├──────────────────────┬─────────────────────┬───────────────────┤
│    hushh-webapp      │  consent-protocol   │   Supabase        │
│    (Next.js 15)      │  (FastAPI/Python)   │   (PostgreSQL)    │
│    Port: 8080        │  Port: 8080         │   Session Pooler  │
├──────────────────────┼─────────────────────┼───────────────────┤
│  Artifact Registry   │  Secret Manager     │   Cloud Build     │
│  Docker images       │  DB_USER            │   (optional)      │
│                      │  DB_PASSWORD        │                   │
│                      │  DB_HOST            │                   │
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
  --set-secrets "SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_KEY=SUPABASE_KEY:latest,SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest" \
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
| `DB_USER`              | Database user (session pooler) | consent-protocol |
| `DB_PASSWORD`          | Database password              | consent-protocol |
| `DB_HOST`              | Database host                  | consent-protocol |
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

## Database (Supabase)

Hushh uses **SQLAlchemy with Supabase's Session Pooler** for direct PostgreSQL connections through a service layer architecture.

- **Service**: Supabase PostgreSQL (managed)
- **Connection**: Direct PostgreSQL via Session Pooler
- **Access**: Via SQLAlchemy with psycopg2

### Connection Configuration

Set these environment variables:

```bash
# Database Connection (Session Pooler)
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-password
DB_HOST=aws-1-us-east-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres

# Optional: Supabase REST API (for backward compatibility)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

### Local Development

1. Create a Supabase project at https://supabase.com
2. Go to Project Settings → Database → Connection Pooling
3. Copy the Session Pooler credentials
4. Set environment variables in `consent-protocol/.env`
5. Run migrations using the db_client

### Run Migrations

```bash
cd consent-protocol
python -c "
from db.db_client import get_db_connection
from sqlalchemy import text

with get_db_connection() as conn:
    with open('db/migrations/COMBINED_MIGRATION.sql', 'r') as f:
        conn.execute(text(f.read()))
    conn.commit()
    print('Migration complete!')
"
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
| `SSL connection` errors            | Supabase connection issue                      | Verify SUPABASE_URL and SUPABASE_KEY |
| Empty JSON response                | Unhandled error in API route                  | Add try/catch error handling   |
| `VAULT_READ_REJECTED` (401)        | Missing session token in production           | Ensure X-Session-Token header  |

### Session Token Auth

In production (`isDevelopment() === false`), the vault API routes (`/api/vault/*`) require a session token.
This token is issued by the backend after login and must be:

1. Stored in `sessionStorage` (key: `session_token`)
2. Sent in `X-Session-Token` header OR `sessionToken` query param
3. Validated by the backend proxy
