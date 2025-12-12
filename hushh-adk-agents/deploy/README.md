# Deploying Hushh Kai Demo

## 1. Prerequisites

- **Google Cloud SDK** installed.
- **Project Created** on Google Cloud.
- **Billing Enabled**.
- **APIs Enabled**: Cloud Run API, Cloud Build API.

## 2. One-Time Setup (Login)

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## 3. Build Container

This uploads the code (including the massive `kushal_profile_data`) and builds the Docker image.

```powershell
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/hushh-kai-demo
```

### ⚠️ Troubleshooting Build Failures

If the build fails:

1.  Check the **Cloud Build logs link** printed in the terminal.
2.  Ensure **Cloud Build API** is enabled.
3.  Ensure **Quota** is available (e.g., usually 10 concurrent builds).

## 4. Deploy Service

This launches the A2A Mesh on Cloud Run.

```powershell
gcloud run deploy hushh-kai-demo `
  --image gcr.io/YOUR_PROJECT_ID/hushh-kai-demo `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars="GOOGLE_API_KEY=YOUR_GEMINI_KEY"
```

## 5. Verify

Open the URL provided by the deployment command (e.g., `https://hushh-kai-demo-xyz.a.run.app`).
Select **tech_fusion_agent** and try the demo!
