# Hushh PDA Deployment Script
# This script uses your local gcloud credentials to deploy to Cloud Run.
# It uses Cloud Build to build the images, then deploys them using 'gcloud run deploy'.
#
# USAGE: Run from the repository root directory:
#   .\deploy\deploy.ps1

# Configuration
$PROJECT_ID = "hushh-pda"
$REGION = "us-central1"
$BACKEND_SERVICE = "consent-protocol"
$WEBAPP_SERVICE = "hushh-webapp"

# Determine the repository root (script is in deploy/ subdirectory)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT = Split-Path -Parent $SCRIPT_DIR

# Change to repository root
Push-Location $REPO_ROOT

Write-Host "--- Starting Deployment for project: $PROJECT_ID ---" -ForegroundColor Cyan
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray

# Ensure we are in the right project
gcloud config set project $PROJECT_ID

# ==============================================================================
# 1. Build and Push Backend
# ==============================================================================
Write-Host "`n[1/6] Building Backend Image..." -ForegroundColor Yellow
# Copy Dockerfile to source directory (gcloud builds submit --tag expects it there)
Copy-Item "deploy/backend.Dockerfile" "consent-protocol/Dockerfile" -Force
try {
    gcloud builds submit --tag "gcr.io/$PROJECT_ID/${BACKEND_SERVICE}:latest" "consent-protocol"
    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed"
    }
} finally {
    Remove-Item "consent-protocol/Dockerfile" -Force -ErrorAction SilentlyContinue
}

# ==============================================================================
# 2. Deploy Backend to Cloud Run
# ==============================================================================
Write-Host "`n[2/6] Deploying Backend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $BACKEND_SERVICE `
    --image "gcr.io/$PROJECT_ID/${BACKEND_SERVICE}:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --add-cloudsql-instances "${PROJECT_ID}:us-central1:hushh-vault-db" `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest,FRONTEND_URL=FRONTEND_URL:latest" `
    --port 8000

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend deployment failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ==============================================================================
# 3. Get Backend URL for Webapp Build
# ==============================================================================
Write-Host "`n[3/6] Retrieving Backend URL..." -ForegroundColor Yellow
$BACKEND_URL = (gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)').Trim()
Write-Host "Backend URL: $BACKEND_URL" -ForegroundColor Green

# ==============================================================================
# 4. Fetch Build-time Secrets for Webapp
# ==============================================================================
Write-Host "`n[4/6] Fetching Firebase build-time secrets..." -ForegroundColor Yellow
$FIREBASE_API_KEY = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_API_KEY").Trim() -replace '\s',''
$FIREBASE_AUTH_DOMAIN = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN").Trim() -replace '\s',''
$FIREBASE_PROJECT_ID = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_PROJECT_ID").Trim() -replace '\s',''

Write-Host "  Firebase API Key: ****$(($FIREBASE_API_KEY).Substring([Math]::Max(0, $FIREBASE_API_KEY.Length - 4)))" -ForegroundColor Gray
Write-Host "  Firebase Auth Domain: $FIREBASE_AUTH_DOMAIN" -ForegroundColor Gray
Write-Host "  Firebase Project ID: $FIREBASE_PROJECT_ID" -ForegroundColor Gray

# ==============================================================================
# 5. Build and Push Webapp
# ==============================================================================
Write-Host "`n[5/6] Building Webapp Image..." -ForegroundColor Yellow

# Copy Dockerfile to webapp directory
Copy-Item "deploy/webapp.Dockerfile" "hushh-webapp/Dockerfile" -Force

# Create a temporary cloudbuild config for webapp
# NOTE: gcloud builds submit --tag uses Buildpacks which don't support --build-arg
# We must use --config with a cloudbuild.yaml that runs docker build directly
$webappCloudbuild = @"
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile'
      - '-t'
      - 'gcr.io/$PROJECT_ID/$WEBAPP_SERVICE:latest'
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
      - '.'
images:
  - 'gcr.io/$PROJECT_ID/$WEBAPP_SERVICE:latest'
"@
$webappCloudbuild | Out-File -FilePath "webapp-cloudbuild-temp.yaml" -Encoding utf8

try {
    # Run build in hushh-webapp directory
    gcloud builds submit --config "webapp-cloudbuild-temp.yaml" "hushh-webapp"
    if ($LASTEXITCODE -ne 0) {
        throw "Webapp build failed"
    }
} finally {
    Remove-Item "webapp-cloudbuild-temp.yaml" -Force -ErrorAction SilentlyContinue
    Remove-Item "hushh-webapp/Dockerfile" -Force -ErrorAction SilentlyContinue
}

# ==============================================================================
# 6. Deploy Webapp to Cloud Run
# ==============================================================================
Write-Host "`n[6/6] Deploying Webapp to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $WEBAPP_SERVICE `
    --image "gcr.io/$PROJECT_ID/${WEBAPP_SERVICE}:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest" `
    --port 3000 `
    --add-cloudsql-instances "${PROJECT_ID}:us-central1:hushh-vault-db"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Webapp deployment failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ==============================================================================
# Complete
# ==============================================================================
Write-Host "`n--- Deployment Complete! ---" -ForegroundColor Cyan
$FINAL_BACKEND_URL = gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)'
$FINAL_WEBAPP_URL = gcloud run services describe $WEBAPP_SERVICE --platform managed --region $REGION --format 'value(status.url)'
Write-Host "Backend URL:  $FINAL_BACKEND_URL" -ForegroundColor Green
Write-Host "Frontend URL: $FINAL_WEBAPP_URL" -ForegroundColor Green

Pop-Location
