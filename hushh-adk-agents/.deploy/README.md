# Cloud Run Deployment Guide ☁️

This guide deploys the Hushh Kai Demo as a single container running both the ADK Web UI and the MCP Server.

## Prerequisites

- Google Cloud SDK (`gcloud`) installed
- A Google Cloud Project

## 1. Setup Environment

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="hushh-kai-demo"

gcloud config set project $PROJECT_ID
```

## 2. Build & Push Container

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
```

## 3. Deploy to Cloud Run

Replace `YOUR_GOOGLE_API_KEY` with your actual Gemini API key.

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY,GOOGLE_GENAI_USE_VERTEXAI=FALSE"
```

## 4. Verification

Cloud Run will provide a URL (e.g., `https://hushh-kai-demo-xyz.a.run.app`).
Open that URL to access the ADK Web UI.

### Architecture Note

- The container runs **two processes**:
  - **MCP Server**: Port 8081 (Internal)
  - **ADK Web UI**: Port 8080 (Public, mapped to `$PORT`)
- Configuration is handled in `deploy/start.sh`.
