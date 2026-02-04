# Cloud Run Deployment Checklist

> **Quick reference for deploying Hushh to Google Cloud Run**

---

## Pre-Deployment

- [x] Google Cloud SDK installed and authenticated

  ```bash
  gcloud auth login
  gcloud config set project hushh-pda
  ```

- [x] Docker installed and running

  ```bash
  docker --version
  ```

- [x] Required GCP APIs enabled
  - Cloud Run API
  - Cloud Build API
  - Container Registry API
  - Secret Manager API
  - Cloud SQL Admin API

---

## Secrets Management

- [x] Verify existing secrets

  ```powershell
  cd deploy
  .\verify-secrets.ps1
  ```

- [x] Clean up obsolete secrets (if any)

  ```powershell
  .\verify-secrets.ps1 -CleanupObsolete
  ```

- [x] Create missing secrets

  ```powershell
  .\verify-secrets.ps1 -UpdateValues
  ```

- [x] Verify all 7 required backend secrets exist:
  - [x] `SECRET_KEY`
  - [x] `VAULT_ENCRYPTION_KEY`
  - [x] `GOOGLE_API_KEY`
  - [x] `FIREBASE_SERVICE_ACCOUNT_JSON`
  - [x] `FRONTEND_URL`
  - [x] `DB_USER`
  - [x] `DB_PASSWORD`
  
  **Note:** `DB_HOST`, `DB_PORT`, `DB_NAME` are set as Cloud Run env vars (not secrets). `DATABASE_URL` may exist for migration scripts but is not used by runtime.

---

## Backend Deployment

- [x] Deploy backend

  ```powershell
  cd deploy
  .\deploy-backend.ps1
  ```

- [x] Verify backend health

  ```bash
  curl https://consent-protocol-1006304528804.us-central1.run.app/health
  ```

- [x] Test Swagger docs

  ```
  https://consent-protocol-1006304528804.us-central1.run.app/docs
  ```

- [x] Check Cloud SQL connection in logs
  ```bash
  gcloud run services logs read consent-protocol --region=us-central1 --limit=20
  ```

- [x] Backend env: Cloud Run sets `ENVIRONMENT=production` and `GOOGLE_GENAI_USE_VERTEXAI=True` (Vertex AI for Gemini)

---

## Frontend Deployment

- [x] Deploy frontend

  ```powershell
  cd deploy
  .\deploy-frontend.ps1
  ```

- [x] Note the frontend URL (output from deployment)

  ```
  Frontend URL: https://hushh-webapp-rpphvsc3tq-uc.a.run.app
  ```

- [x] Verify frontend health

  ```bash
  curl https://hushh-webapp-rpphvsc3tq-uc.a.run.app/health
  ```

- [x] Test frontend in browser
  ```
  https://hushh-webapp-rpphvsc3tq-uc.a.run.app
  ```

---

## CORS Configuration

- [x] Update backend CORS with frontend URL

  ```powershell
  cd deploy
  .\update-cors.ps1 -FrontendUrl https://hushh-webapp-rpphvsc3tq-uc.a.run.app
  ```

- [x] Wait 30 seconds for deployment to complete

- [x] Verify CORS in backend logs
  ```bash
  gcloud run services logs read consent-protocol --region=us-central1 --limit=20 | Select-String "CORS"
  ```

---

## Integration Testing

- [x] **Login Flow**

  - Visit frontend URL
  - Click "Sign in with Google"
  - Verify Firebase authentication works
  - No errors in browser console

- [x] **Vault Creation**

  - Create vault with passphrase
  - Verify vault key is generated
  - Check backend logs for vault creation

- [x] **Agent Chat**

  - Chat with Food & Dining agent
  - Provide dietary preferences
  - Verify data is saved (check backend logs)
  - No CORS errors in browser console

- [x] **Data Persistence**

  - Logout
  - Login again
  - Verify data persists
  - Chat history is preserved

- [x] **CORS Verification**
  - Open browser DevTools Network tab
  - Perform agent chat request
  - Verify `Access-Control-Allow-Origin` header matches frontend URL
  - No CORS errors in console

---

## Monitoring

- [x] Set up log monitoring

  ```bash
  # Backend logs
  gcloud run services logs tail consent-protocol --region=us-central1

  # Frontend logs
  gcloud run services logs tail hushh-webapp --region=us-central1
  ```

- [x] Check Cloud Run metrics

  ```
  https://console.cloud.google.com/run?project=hushh-pda
  ```

- [x] Verify auto-scaling works
  - Send multiple concurrent requests
  - Check instance count in Cloud Run console

---

## Post-Deployment

- [x] Update documentation with actual URLs

- [x] Share URLs with team:

  - Backend: `https://consent-protocol-1006304528804.us-central1.run.app`
  - Frontend: `https://hushh-webapp-rpphvsc3tq-uc.a.run.app`
  - Swagger: `https://consent-protocol-1006304528804.us-central1.run.app/docs`

- [x] Set up monitoring alerts (optional)

- [x] Document any custom configuration changes

---

## Rollback Plan (If Needed)

- [ ] List revisions

  ```bash
  gcloud run revisions list --service=consent-protocol --region=us-central1
  ```

- [ ] Rollback backend

  ```bash
  gcloud run services update-traffic consent-protocol \
    --region=us-central1 \
    --to-revisions=PREVIOUS_REVISION=100
  ```

- [ ] Rollback frontend
  ```bash
  gcloud run services update-traffic hushh-webapp \
    --region=us-central1 \
    --to-revisions=PREVIOUS_REVISION=100
  ```

---

## Troubleshooting

If issues occur, check:

1. **Logs**: `gcloud run services logs read SERVICE_NAME --region=us-central1 --limit=50`
2. **Secrets**: `.\verify-secrets.ps1`
3. **CORS**: Browser DevTools Console
4. **Cloud SQL**: Backend logs for connection errors
5. **README.md**: Troubleshooting section

---

**Deployment Status**: ✅ Verified Healthy (2026-01-09)

**Last Updated**: 2026-01-09
