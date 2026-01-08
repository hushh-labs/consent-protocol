# Hushh PDA Deployment Guide

This directory contains all files required to deploy the **Hushh PDA** ecosystem to **Google Cloud Run** using your local gcloud credentials (no service account required).

## Directory Contents

| File                 | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `deploy.ps1`         | PowerShell deployment script (Windows)                       |
| `cloudbuild.yaml`    | Cloud Build configuration for CI/CD pipelines                |
| `backend.Dockerfile` | Multi-stage Dockerfile for consent-protocol (Python/FastAPI) |
| `webapp.Dockerfile`  | Multi-stage Dockerfile for hushh-webapp (Next.js)            |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Google Cloud Platform                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────┐             │
│   │   hushh-webapp   │   API   │ consent-protocol │             │
│   │   (Cloud Run)    │ ──────► │   (Cloud Run)    │             │
│   │   Port: 3000     │         │   Port: 8000     │             │
│   └──────────────────┘         └────────┬─────────┘             │
│                                         │                        │
│                                         ▼                        │
│                              ┌──────────────────┐               │
│                              │  Cloud SQL       │               │
│                              │  (PostgreSQL)    │               │
│                              └──────────────────┘               │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                   Secret Manager                          │  │
│   │  DATABASE_URL, SECRET_KEY, VAULT_ENCRYPTION_KEY,         │  │
│   │  FRONTEND_URL, NEXT_PUBLIC_FIREBASE_*                    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Google Cloud CLI Setup

```powershell
# Install gcloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Authenticate with your Google account
gcloud auth login

# Set your project
gcloud config set project hushh-pda

# Verify authentication
gcloud auth list
```

### 2. Required Google Cloud APIs

Ensure these APIs are enabled in your project:

```powershell
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Required Secrets in Secret Manager

The following secrets must exist in Google Secret Manager:

| Secret Name                        | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                     | PostgreSQL connection string with Cloud SQL socket |
| `SECRET_KEY`                       | FastAPI secret key for JWT signing                 |
| `VAULT_ENCRYPTION_KEY`             | Encryption key for vault data                      |
| `FRONTEND_URL`                     | URL of the deployed frontend                       |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Firebase Web API Key                               |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain                               |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Firebase Project ID                                |

To create a secret:

```powershell
echo "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
```

### 4. Cloud SQL Instance

A Cloud SQL PostgreSQL instance must exist:

- **Instance name**: `hushh-vault-db`
- **Region**: `us-central1`
- **Connection name**: `hushh-pda:us-central1:hushh-vault-db`

---

## Deployment Methods

### Method 1: PowerShell Script (Recommended for Windows)

This is the simplest way to deploy both services with your local credentials.

```powershell
# Navigate to the repository root
cd "C:\OneDrive - NS\Repository\hushh-research"

# Run the deployment script
.\deploy\deploy.ps1
```

**What the script does:**

1. Sets the GCP project to `hushh-pda`
2. Builds and pushes the backend image using Cloud Build
3. Deploys backend to Cloud Run with secrets and Cloud SQL connection
4. Retrieves the backend URL
5. Fetches Firebase secrets from Secret Manager
6. Builds webapp with environment variables baked in (NEXT*PUBLIC*\* vars)
7. Deploys webapp to Cloud Run

### Method 2: Cloud Build (CI/CD)

Use this for automated deployments or CI/CD pipelines:

```powershell
# From repository root
cd "C:\OneDrive - NS\Repository\hushh-research"
gcloud builds submit --config deploy/cloudbuild.yaml
```

### Method 3: Manual Step-by-Step Deployment

If you need more control, deploy each service manually:

#### Step 1: Build and Deploy Backend

```powershell
# Set variables
$PROJECT_ID = "hushh-pda"
$REGION = "us-central1"

# Copy Dockerfile to context directory
Copy-Item "deploy/backend.Dockerfile" "consent-protocol/Dockerfile" -Force

# Build using Cloud Build
gcloud builds submit --tag "gcr.io/$PROJECT_ID/consent-protocol:latest" "consent-protocol"

# Clean up
Remove-Item "consent-protocol/Dockerfile" -Force

# Deploy to Cloud Run
gcloud run deploy consent-protocol `
    --image "gcr.io/$PROJECT_ID/consent-protocol:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --add-cloudsql-instances "hushh-pda:us-central1:hushh-vault-db" `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest,FRONTEND_URL=FRONTEND_URL:latest" `
    --port 8000
```

#### Step 2: Get Backend URL

```powershell
$BACKEND_URL = (gcloud run services describe consent-protocol --platform managed --region us-central1 --format 'value(status.url)').Trim()
Write-Host "Backend URL: $BACKEND_URL"
```

#### Step 3: Build Webapp with Secrets

```powershell
# Fetch Firebase secrets
$FIREBASE_API_KEY = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_API_KEY").Trim()
$FIREBASE_AUTH_DOMAIN = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN").Trim()
$FIREBASE_PROJECT_ID = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_PROJECT_ID").Trim()

# Create temporary cloudbuild config (gcloud builds submit --tag doesn't support --build-arg)
@"
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'deploy/webapp.Dockerfile'
      - '-t'
      - 'gcr.io/hushh-pda/hushh-webapp:latest'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=$BACKEND_URL'
      - '--build-arg'
      - 'NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID'
      - 'hushh-webapp'
images:
  - 'gcr.io/hushh-pda/hushh-webapp:latest'
"@ | Out-File -FilePath "webapp-cloudbuild-temp.yaml" -Encoding utf8

# Build
gcloud builds submit --config "webapp-cloudbuild-temp.yaml" .

# Clean up
Remove-Item "webapp-cloudbuild-temp.yaml" -Force
```

#### Step 4: Deploy Webapp

```powershell
gcloud run deploy hushh-webapp `
    --image "gcr.io/hushh-pda/hushh-webapp:latest" `
    --region us-central1 `
    --platform managed `
    --allow-unauthenticated `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest" `
    --port 3000 `
    --add-cloudsql-instances "hushh-pda:us-central1:hushh-vault-db"
```

---

## Deployed Service URLs

After successful deployment:

| Service      | URL Pattern                                      |
| ------------ | ------------------------------------------------ |
| **Backend**  | `https://consent-protocol-*.us-central1.run.app` |
| **Frontend** | `https://hushh-webapp-*.us-central1.run.app`     |

To get the exact URLs:

```powershell
gcloud run services describe consent-protocol --region us-central1 --format 'value(status.url)'
gcloud run services describe hushh-webapp --region us-central1 --format 'value(status.url)'
```

---

## Troubleshooting

### Error: "invalid argument for -t, --tag flag: invalid ref"

**Cause**: Variable not interpolated properly in the image tag.

**Solution**: Ensure PowerShell variables are correctly set before running build commands. Test with:

```powershell
Write-Host "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
```

### Error: Build-args not being passed

**Cause**: `gcloud builds submit --tag` uses Buildpacks which don't support `--build-arg`.

**Solution**: Use `--config` with a cloudbuild.yaml that calls `docker build` directly. This is what the `deploy.ps1` script does automatically.

### Error: Cloud SQL connection failed

**Cause**: Missing Cloud SQL instance connection.

**Solution**: Ensure `--add-cloudsql-instances` flag is present with the correct instance connection name:

```
hushh-pda:us-central1:hushh-vault-db
```

### View Cloud Build Logs

```powershell
# List recent builds
gcloud builds list --limit=5

# View specific build logs
gcloud builds log [BUILD_ID]
```

### View Cloud Run Logs

```powershell
gcloud run services logs read consent-protocol --region us-central1 --limit=50
gcloud run services logs read hushh-webapp --region us-central1 --limit=50
```

---

## Configuration Reference

### Backend Cloud Run Settings

- **Image**: `gcr.io/hushh-pda/consent-protocol:latest`
- **Port**: 8000
- **Platform**: managed
- **Region**: us-central1
- **Cloud SQL**: hushh-pda:us-central1:hushh-vault-db
- **Secrets**: DATABASE_URL, SECRET_KEY, VAULT_ENCRYPTION_KEY, FRONTEND_URL

### Webapp Cloud Run Settings

- **Image**: `gcr.io/hushh-pda/hushh-webapp:latest`
- **Port**: 3000
- **Platform**: managed
- **Region**: us-central1
- **Cloud SQL**: hushh-pda:us-central1:hushh-vault-db
- **Secrets**: DATABASE_URL
- **Build-time Args**: NEXT*PUBLIC_API_URL, NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_FIREBASE*\*

---

## Last Successful Deployment

**Date**: 2026-01-07  
**Backend URL**: https://consent-protocol-rpphvsc3tq-uc.a.run.app  
**Frontend URL**: https://hushh-webapp-1006304528804.us-central1.run.app
