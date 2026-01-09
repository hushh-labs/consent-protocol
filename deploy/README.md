# Hushh Research - Cloud Build Deployment

> **CI/CD deployment using Google Cloud Build**

---

## 🚀 Quick Deploy

### Backend Deployment

```bash
gcloud builds submit --config=deploy/backend.cloudbuild.yaml
```

### Frontend Deployment

```bash
gcloud builds submit --config=deploy/frontend.cloudbuild.yaml \
  --substitutions=_BACKEND_URL=https://consent-protocol-1006304528804.us-central1.run.app
```

---

## 📋 Prerequisites

1. **Google Cloud SDK** installed and authenticated

   ```bash
   gcloud auth login
   gcloud config set project hushh-pda
   ```

2. **Enable Required APIs**

   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Configure Secrets** (one-time setup)

   ```powershell
   cd deploy
   .\verify-secrets.ps1
   ```

   Required secrets:

   - `SECRET_KEY`
   - `VAULT_ENCRYPTION_KEY`
   - `GOOGLE_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `DATABASE_URL`

---

## 🔧 Cloud Build Configuration

### Backend (`backend.cloudbuild.yaml`)

Deploys Python FastAPI backend to Cloud Run:

- Builds Docker image from `consent-protocol/Dockerfile`
- Pushes to Google Container Registry
- Deploys to `consent-protocol` service
- Connects to Cloud SQL via Unix socket
- Injects secrets from Secret Manager

### Frontend (`frontend.cloudbuild.yaml`)

Deploys Next.js frontend to Cloud Run:

- Builds Docker image from `hushh-webapp/Dockerfile`
- Bakes environment variables into static build
- Pushes to Google Container Registry
- Deploys to `hushh-webapp` service
- Serves via nginx

---

## 🔄 CI/CD Setup (GitHub/GitLab)

### Option 1: Cloud Build Triggers (Recommended)

1. **Create Backend Trigger**

   ```bash
   gcloud builds triggers create github \
     --name=deploy-backend \
     --repo-name=hushh-research \
     --repo-owner=YOUR_ORG \
     --branch-pattern=^main$ \
     --build-config=deploy/backend.cloudbuild.yaml
   ```

2. **Create Frontend Trigger**
   ```bash
   gcloud builds triggers create github \
     --name=deploy-frontend \
     --repo-name=hushh-research \
     --repo-owner=YOUR_ORG \
     --branch-pattern=^main$ \
     --build-config=deploy/frontend.cloudbuild.yaml \
     --substitutions=_BACKEND_URL=https://consent-protocol-1006304528804.us-central1.run.app
   ```

### Option 2: Manual Deployment

```bash
# Deploy backend
gcloud builds submit --config=deploy/backend.cloudbuild.yaml

# Deploy frontend (update backend URL if needed)
gcloud builds submit --config=deploy/frontend.cloudbuild.yaml \
  --substitutions=_BACKEND_URL=https://consent-protocol-1006304528804.us-central1.run.app
```

---

## 🔐 Secrets Management

### Verify Secrets

```powershell
cd deploy
.\verify-secrets.ps1
```

### Create Secret

```bash
echo "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
```

### Update Secret

```bash
echo "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-
```

### View Secret

```bash
gcloud secrets versions access latest --secret=SECRET_NAME
```

---

## 🌐 Update CORS

After deploying frontend, update backend's CORS:

```bash
# Get frontend URL
FRONTEND_URL=$(gcloud run services describe hushh-webapp --region=us-central1 --format="value(status.url)")

# Update backend
gcloud run services update consent-protocol \
  --region=us-central1 \
  --update-env-vars=FRONTEND_URL=$FRONTEND_URL
```

---

## 🧪 Verification

### Backend

```bash
# Health check
curl https://consent-protocol-1006304528804.us-central1.run.app/health

# Swagger docs
open https://consent-protocol-1006304528804.us-central1.run.app/docs
```

### Frontend

```bash
# Get URL
gcloud run services describe hushh-webapp --region=us-central1 --format="value(status.url)"

# Health check
curl $(gcloud run services describe hushh-webapp --region=us-central1 --format="value(status.url)")/health
```

---

## 📊 Monitoring

### View Logs

```bash
# Backend
gcloud run services logs read consent-protocol --region=us-central1 --limit=50

# Frontend
gcloud run services logs read hushh-webapp --region=us-central1 --limit=50
```

### View Services

```bash
gcloud run services list --region=us-central1
```

---

## 🔄 Rollback

```bash
# List revisions
gcloud run revisions list --service=consent-protocol --region=us-central1

# Rollback
gcloud run services update-traffic consent-protocol \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

---

## 📁 File Structure

```
deploy/
├── backend.cloudbuild.yaml      # Backend Cloud Build config
├── frontend.cloudbuild.yaml     # Frontend Cloud Build config
├── verify-secrets.ps1           # Secrets management utility
├── .env.backend.example         # Backend env vars template
├── .env.frontend.example        # Frontend env vars template
└── README.md                    # This file
```

---

## 🔧 Troubleshooting

### Build Fails

```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

### Service Not Accessible

```bash
# Check service status
gcloud run services describe SERVICE_NAME --region=us-central1

# Check logs
gcloud run services logs read SERVICE_NAME --region=us-central1 --limit=20
```

### CORS Errors

```bash
# Verify FRONTEND_URL is set
gcloud run services describe consent-protocol --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
```

---

**Last Updated**: 2026-01-07  
**Version**: 2.0 (Cloud Build YAML only)
