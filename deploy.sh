#!/bin/bash
# ==============================================================================
# Hushh WebApp - Cloud Run Deployment Script
# ==============================================================================
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Example: ./deploy.sh my-gcp-project us-central1
# ==============================================================================

set -e

# Configuration
PROJECT_ID="${1:-YOUR_PROJECT_ID}"
REGION="${2:-us-central1}"
SERVICE_NAME="hushh-webapp"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=========================================="
echo "🚀 Hushh WebApp Cloud Run Deployment"
echo "=========================================="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "=========================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📦 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com

# Build the Docker image
echo "🏗️ Building Docker image..."
cd hushh-webapp

docker build \
    --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
    --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
    --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
    --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
    --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
    --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
    --build-arg NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL}" \
    --build-arg DATABASE_URL="${DATABASE_URL}" \
    -t ${IMAGE_NAME}:latest \
    .

# Push to Container Registry
echo "📤 Pushing image to Container Registry..."
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:latest \
    --platform managed \
    --region ${REGION} \
    --min-instances 1 \
    --max-instances 10 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 80 \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest"

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo "🌐 Service URL: ${SERVICE_URL}"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "1. Add your domain: gcloud run domain-mappings create --service ${SERVICE_NAME} --domain your-domain.com --region ${REGION}"
echo "2. View logs: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo "3. View metrics: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics"
