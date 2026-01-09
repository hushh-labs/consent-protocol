# Cloud Run Deployment Checklist

> **Quick reference for deploying Hushh to Google Cloud Run**

---

## Pre-Deployment

- [ ] Google Cloud SDK installed and authenticated

  ```bash
  gcloud auth login
  gcloud config set project hushh-pda
  ```

- [ ] Docker installed and running

  ```bash
  docker --version
  ```

- [ ] Required GCP APIs enabled
  - Cloud Run API
  - Cloud Build API
  - Container Registry API
  - Secret Manager API
  - Cloud SQL Admin API

---

## Secrets Management

- [ ] Verify existing secrets

  ```powershell
  cd deploy
  .\verify-secrets.ps1
  ```

- [ ] Clean up obsolete secrets (if any)

  ```powershell
  .\verify-secrets.ps1 -CleanupObsolete
  ```

- [ ] Create missing secrets

  ```powershell
  .\verify-secrets.ps1 -UpdateValues
  ```

- [ ] Verify all 5 required secrets exist:
  - [ ] `SECRET_KEY`
  - [ ] `VAULT_ENCRYPTION_KEY`
  - [ ] `GOOGLE_API_KEY`
  - [ ] `FIREBASE_SERVICE_ACCOUNT_JSON`
  - [ ] `DATABASE_URL`

---

## Backend Deployment

- [ ] Deploy backend

  ```powershell
  cd deploy
  .\deploy-backend.ps1
  ```

- [ ] Verify backend health

  ```bash
  curl https://consent-protocol-1006304528804.us-central1.run.app/health
  ```

- [ ] Test Swagger docs

  ```
  https://consent-protocol-1006304528804.us-central1.run.app/docs
  ```

- [ ] Check Cloud SQL connection in logs
  ```bash
  gcloud run services logs read consent-protocol --region=us-central1 --limit=20
  ```

---

## Frontend Deployment

- [ ] Deploy frontend

  ```powershell
  cd deploy
  .\deploy-frontend.ps1
  ```

- [ ] Note the frontend URL (output from deployment)

  ```
  Frontend URL: https://hushh-webapp-XXXXXXXXXX-uc.a.run.app
  ```

- [ ] Verify frontend health

  ```bash
  curl https://hushh-webapp-XXXXXXXXXX-uc.a.run.app/health
  ```

- [ ] Test frontend in browser
  ```
  https://hushh-webapp-XXXXXXXXXX-uc.a.run.app
  ```

---

## CORS Configuration

- [ ] Update backend CORS with frontend URL

  ```powershell
  cd deploy
  .\update-cors.ps1 -FrontendUrl https://hushh-webapp-XXXXXXXXXX-uc.a.run.app
  ```

- [ ] Wait 30 seconds for deployment to complete

- [ ] Verify CORS in backend logs
  ```bash
  gcloud run services logs read consent-protocol --region=us-central1 --limit=20 | Select-String "CORS"
  ```

---

## Integration Testing

- [ ] **Login Flow**

  - Visit frontend URL
  - Click "Sign in with Google"
  - Verify Firebase authentication works
  - No errors in browser console

- [ ] **Vault Creation**

  - Create vault with passphrase
  - Verify vault key is generated
  - Check backend logs for vault creation

- [ ] **Agent Chat**

  - Chat with Food & Dining agent
  - Provide dietary preferences
  - Verify data is saved (check backend logs)
  - No CORS errors in browser console

- [ ] **Data Persistence**

  - Logout
  - Login again
  - Verify data persists
  - Chat history is preserved

- [ ] **CORS Verification**
  - Open browser DevTools Network tab
  - Perform agent chat request
  - Verify `Access-Control-Allow-Origin` header matches frontend URL
  - No CORS errors in console

---

## Monitoring

- [ ] Set up log monitoring

  ```bash
  # Backend logs
  gcloud run services logs tail consent-protocol --region=us-central1

  # Frontend logs
  gcloud run services logs tail hushh-webapp --region=us-central1
  ```

- [ ] Check Cloud Run metrics

  ```
  https://console.cloud.google.com/run?project=hushh-pda
  ```

- [ ] Verify auto-scaling works
  - Send multiple concurrent requests
  - Check instance count in Cloud Run console

---

## Post-Deployment

- [ ] Update documentation with actual URLs

- [ ] Share URLs with team:

  - Backend: `https://consent-protocol-1006304528804.us-central1.run.app`
  - Frontend: `https://hushh-webapp-XXXXXXXXXX-uc.a.run.app`
  - Swagger: `https://consent-protocol-1006304528804.us-central1.run.app/docs`

- [ ] Set up monitoring alerts (optional)

- [ ] Document any custom configuration changes

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

**Deployment Status**: ⏳ Pending

**Last Updated**: 2026-01-07
