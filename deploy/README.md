# Hushh PDA Deployment Guide

> **Verified Method (Jan 2026)**
> Use this manual Cloud Build submission to ensure all build contexts and secrets are handled correctly.

## 🚀 Manual Deployment (Recommended)

This method rebuilds both Backend and Frontend, ensuring the Frontend picks up the latest Backend URL and Secrets.

### Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated.
- PowerShell or Terminal at the **Repository Root**.

### Command

Run this one-liner from the **root** of the repository:

```powershell
# 1. Prepare Dockerfile (Cloud Build expects it in valid context)
copy deploy\webapp.Dockerfile hushh-webapp\Dockerfile

# 2. Submit Full Build (Backend + Frontend)
gcloud builds submit --config deploy/cloudbuild.yaml .
```

### Why this works?

- **Root Context (`.`):** Submitting from root allows `cloudbuild.yaml` to access both `consent-protocol/` and `hushh-webapp/` directories correctly.
- **Explicit Config:** Uses `deploy/cloudbuild.yaml` which defines the multi-stage pipeline:
  1. Build & Deploy Backend.
  2. Fetch Backend URL.
  3. Build Frontend (injecting Backend URL).
  4. Deploy Frontend.

## ⚠️ Common Issues

- **Error 125 / Docker Context:** If you see `docker build` errors about missing files, ensure you ran the command from the **Root** and copied the Dockerfile as shown above.
- **404 on API Routes:** If the frontend can't reach the backend (e.g., `/api/kai/preferences`), it likely means the Backend URL wasn't injected correctly during build. This manual method guarantees injection via `deploy/cloudbuild.yaml`.

---

## Service URLs (Production)

- **Frontend:** https://hushh-webapp-1006304528804.us-central1.run.app
- **Backend:** https://consent-protocol-1006304528804.us-central1.run.app
