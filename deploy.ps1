# Hushh PDA Deployment Script
# This script uses your local gcloud credentials to deploy to Cloud Run.
# It uses Cloud Build to build the images, then deploys them using 'gcloud run deploy'.

# Configuration
$PROJECT_ID = "hushh-pda"
$REGION = "us-central1"
$BACKEND_SERVICE = "consent-protocol"
$WEBAPP_SERVICE = "hushh-webapp"

Write-Host "--- Starting Deployment for project: $PROJECT_ID ---" -ForegroundColor Cyan

# Ensure we are in the right project
gcloud config set project $PROJECT_ID

# 1. Build and Push Backend
Write-Host "Building Backend Image..." -ForegroundColor Yellow
# We copy the Dockerfile to the source root because gcloud builds submit --tag expects it there.
Copy-Item "deploy/backend.Dockerfile" "consent-protocol/Dockerfile" -Force
try {
    gcloud builds submit --tag "gcr.io/$PROJECT_ID/$BACKEND_SERVICE:latest" "consent-protocol"
    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed"
    }
} finally {
    Remove-Item "consent-protocol/Dockerfile" -Force -ErrorAction SilentlyContinue
}

# 2. Deploy Backend
Write-Host "Deploying Backend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $BACKEND_SERVICE `
    --image "gcr.io/$PROJECT_ID/$BACKEND_SERVICE:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --add-cloudsql-instances "${PROJECT_ID}:us-central1:hushh-vault-db" `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,VAULT_ENCRYPTION_KEY=VAULT_ENCRYPTION_KEY:latest,FRONTEND_URL=FRONTEND_URL:latest" `
    --port 8000

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend deployment failed!" -ForegroundColor Red
    exit 1
}

# 3. Get Backend URL for Webapp Build
$BACKEND_URL = (gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)').Trim()
Write-Host "Backend URL: $BACKEND_URL" -ForegroundColor Green

# 4. Fetch Build-time Secrets for Webapp
Write-Host "Fetching Firebase build-time secrets..." -ForegroundColor Yellow
$FIREBASE_API_KEY = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_API_KEY").Trim() -replace '\s',''
$FIREBASE_AUTH_DOMAIN = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN").Trim() -replace '\s',''
$FIREBASE_PROJECT_ID = (gcloud secrets versions access latest --secret="NEXT_PUBLIC_FIREBASE_PROJECT_ID").Trim() -replace '\s',''

# 5. Build and Push Webapp
Write-Host "Building Webapp Image..." -ForegroundColor Yellow
# Verified: Building from the hushh-webapp directory ensures correct context.
# Verified: We use --build-arg with a separator for gcloud builds submit
Copy-Item "deploy/webapp.Dockerfile" "hushh-webapp/Dockerfile" -Force
try {
    gcloud builds submit --tag "gcr.io/$PROJECT_ID/$WEBAPP_SERVICE:latest" "hushh-webapp" -- `
      --build-arg "NEXT_PUBLIC_API_URL=$BACKEND_URL" `
      --build-arg "NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL" `
      --build-arg "NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY" `
      --build-arg "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN" `
      --build-arg "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Webapp build failed"
    }
} finally {
    Remove-Item "hushh-webapp/Dockerfile" -Force -ErrorAction SilentlyContinue
}

# 6. Deploy Webapp
Write-Host "Deploying Webapp to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $WEBAPP_SERVICE `
    --image "gcr.io/$PROJECT_ID/$WEBAPP_SERVICE:latest" `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest" `
    --port 8080 `
    --add-cloudsql-instances "${PROJECT_ID}:us-central1:hushh-vault-db"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Webapp deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "--- Deployment Complete! ---" -ForegroundColor Cyan
$FINAL_URL = gcloud run services describe $WEBAPP_SERVICE --platform managed --region $REGION --format 'value(status.url)'
Write-Host "Frontend URL: $FINAL_URL" -ForegroundColor Green
