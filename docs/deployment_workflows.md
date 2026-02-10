# GitHub Actions Deployment Workflows

## Overview

This repository uses GitHub Actions for automated deployment to Google Cloud Run:

- **Production** (`deploy` branch) → `consent-protocol` and `hushh-webapp`

## Branch Structure

```
main             → Development work, no auto-deploy
└── deploy       → Production environment (auto-deploy)
```

## Workflow

### Production Deployment

**File**: `.github/workflows/deploy-production.yml`

**Trigger**: Push to `deploy` branch or manual workflow dispatch

**Services**:
- Backend: `consent-protocol`
- Frontend: `hushh-webapp`

**Configuration**:
- Region: `us-central1`
- Min instances: 1 (always warm)
- Max instances: 10
- Memory: Backend 1Gi, Frontend 512Mi
- Timeout: Backend 300s, Frontend 60s

## GitHub Secrets Required

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### Required Secrets

- `GCP_PROJECT_ID`: `YOUR_GCP_PROJECT_ID` (replace with your project ID)
- `GCP_SA_KEY`: Service account JSON key with the following permissions:
  - Cloud Build Editor
  - Cloud Run Admin
  - Service Account User
  - Secret Manager Secret Accessor
  - Storage Admin

## Google Cloud Secrets

The workflows automatically fetch these secrets from Google Cloud Secret Manager:

**Backend Secrets** (injected at runtime):
- `SECRET_KEY`
- `VAULT_ENCRYPTION_KEY`
- `GOOGLE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `DB_USER`, `DB_PASSWORD` (DB_HOST, DB_PORT, DB_NAME as env vars)
- `FRONTEND_URL`

**Frontend Build Args** (baked into image):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_BACKEND_URL`
- (Removed) `NEXT_PUBLIC_API_URL` — web clients call same-origin `/api/*` to avoid CORS across Cloud Run hostnames

## Deployment Flow

### Standard Development Flow

1. Feature work happens on feature branches
2. Merge feature branches into `main` (no deployment)
3. Test and validate on `main`

### Production Deployment

```bash
# Merge main into deploy
git checkout deploy
git merge main
git push origin deploy
```

This triggers the production workflow automatically.

## Manual Deployment

You can also trigger deployments manually via GitHub Actions UI:

1. Go to **Actions** tab in GitHub
2. Select the workflow (Deploy to Production)
3. Click **Run workflow**
4. Select the branch
5. Click **Run workflow**

## Creating Service Account

If you need to create a new service account for GitHub Actions:

```bash
# Set project (replace YOUR_GCP_PROJECT_ID with your actual project ID)
gcloud config set project YOUR_GCP_PROJECT_ID

# Create service account
gcloud iam service-accounts create github-actions-deploy \
  --display-name="GitHub Actions Deployment"

# Grant necessary roles (replace YOUR_GCP_PROJECT_ID and YOUR_SERVICE_ACCOUNT_EMAIL)
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"

# Generate key (replace YOUR_SERVICE_ACCOUNT_EMAIL)
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=YOUR_SERVICE_ACCOUNT_EMAIL

# Copy the contents of github-actions-key.json and add it as GCP_SA_KEY secret in GitHub
```

## Creating Deployment Branch

```bash
# Create deploy branch from main
git checkout main
git checkout -b deploy
git push -u origin deploy
```

## Monitoring Deployments

### Via GitHub Actions UI

1. Go to **Actions** tab
2. Click on the workflow run
3. View logs for each job (deploy-backend, deploy-frontend)

### Via Google Cloud Console

1. Visit [Cloud Run Console](https://console.cloud.google.com/run?project=YOUR_GCP_PROJECT_ID)
2. Check service status, logs, and metrics

### Via gcloud CLI

```bash
# View backend logs
gcloud run services logs read consent-protocol --region=us-central1 --limit=50

# View frontend logs
gcloud run services logs read hushh-webapp --region=us-central1 --limit=50
```

## Rollback

If a deployment causes issues:

```bash
# List revisions
gcloud run revisions list --service=consent-protocol --region=us-central1

# Rollback to a specific revision
gcloud run services update-traffic consent-protocol \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100

# Or rollback via GitHub Actions by re-running a previous successful workflow
```

## Troubleshooting

### Workflow Fails at Authentication

- Verify `GCP_SA_KEY` secret is properly configured
- Check service account has required permissions
- Ensure service account key is valid (not expired)

### Docker Build Fails

- Check Dockerfile syntax
- Verify build context paths are correct
- Review build logs in GitHub Actions

### Deployment Fails

- Check Cloud Run service quotas
- Verify Secret Manager secrets exist
- Review Cloud Run logs for runtime errors
- Ensure Docker image was pushed successfully to GCR

### Frontend Can't Reach Backend

- Verify CORS configuration on backend
- Check `FRONTEND_URL` secret is correct
- Ensure backend service is deployed and accessible

## Best Practices

1. **Test thoroughly on main** before deploying to production
2. **Monitor logs** after deployment for any errors
3. **Keep secrets up to date** in Secret Manager
4. **Tag releases** for easier rollback reference
5. **Document any manual changes** made outside of CI/CD

## URLs

### Production
- **Backend**: Check Cloud Run console for current URL (e.g., `https://consent-protocol-*.us-central1.run.app`)
- **Frontend**: Check Cloud Run console for current URL (e.g., `https://hushh-webapp-*.a.run.app`)

> **Note**: URLs are automatically managed by Cloud Run. Check the [Cloud Run Console](https://console.cloud.google.com/run) for the latest URLs.

---

**Last Updated**: 2026-02-09
