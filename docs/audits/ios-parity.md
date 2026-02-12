# iOS Proxy Parity Matrix (Next.js vs Capacitor)

> **Goal**: Ensure Capacitor iOS plugins behave like a consistent proxy layer for the Python backend, matching Next.js `/app/api/**` semantics and enforcing consent-first auth.
>
> **Token rule**:
> - **Bootstrap** routes: `Authorization: Bearer <Firebase_ID_token>`
> - **Consent-gated** routes: `Authorization: Bearer <VAULT_OWNER_token>`
>
> **Note**: Some legacy routes accept tokens in the request body (e.g. `consent_token`). Prefer header-based `Authorization` unless the backend contract requires body token.

## Backend endpoint requirements (source-of-truth)

| Endpoint | Token required | Backend validation | Primary clients |
|---|---|---|---|
| `POST /api/consent/vault-owner-token` | **Firebase** | `verify_firebase_bearer(...)` | Next.js route `app/api/consent/vault-owner-token`; iOS `HushhConsentPlugin.issueVaultOwnerToken`; Android `HushhConsentPlugin.issueVaultOwnerToken` |
| `POST /api/consent/issue-token` | **Firebase** | `verify_firebase_bearer(...)` | Next.js route `app/api/consent/session-token` |
| `GET /api/consent/pending?userId=...` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js `app/api/consent/pending`; iOS should use GET; Android should use GET |
| `POST /api/consent/pending/approve` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js + native plugins |
| `POST /api/consent/pending/deny?userId=...&requestId=...` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js + native plugins |
| `POST /api/consent/cancel` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js + native plugins |
| `POST /api/consent/revoke` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js + native plugins |
| `GET /api/consent/history?userId=...` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js + native plugins |
| `GET /api/consent/active?userId=...` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js + native plugins |
| `POST /db/vault/check` | **Firebase** | `Depends(require_firebase_auth)` | Next.js `app/api/vault/check`; iOS/Android `HushhVault.hasVault` |
| `POST /db/vault/get` | **Firebase** | `Depends(require_firebase_auth)` | Next.js `app/api/vault/get`; iOS/Android `HushhVault.getVault` |
| `POST /db/vault/setup` | **Firebase** | `Depends(require_firebase_auth)` | Next.js `app/api/vault/setup`; iOS/Android `HushhVault.setupVault` |
| `POST /db/vault/status` | **Firebase + VAULT_OWNER(body)** | Firebase `Depends(require_firebase_auth)` + manual vaultOwner validation in service | Next.js `app/api/vault/status` (body `consentToken`) |
| `POST /api/kai/consent/grant` | **Firebase** | `Depends(require_firebase_auth)` | Next.js `/api/kai/...`; native `Kai.grantConsent` |
| `POST /api/kai/chat` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `Kai.chat` |
| `GET /api/kai/chat/initial-state/{userId}` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `Kai.getInitialChatState` |
| `POST /api/kai/preferences/store` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `Kai.storePreferences` |
| `GET /api/kai/preferences/{userId}` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `Kai.getPreferences` |
| `DELETE /api/kai/preferences/{userId}` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `Kai.resetPreferences` |
| `POST /api/kai/portfolio/import` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy (multipart); native `Kai.importPortfolio` |
| `GET /api/kai/portfolio/summary/{userId}` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native path (if used) |
| `POST /api/kai/portfolio/analyze-losers` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `Kai.analyzePortfolioLosers` |
| `POST /api/kai/analyze/stream` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Web service `lib/services/kai-service.ts` (SSE) |
| `POST /api/world-model/store-domain` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `WorldModel.storeDomainData` |
| `GET /api/world-model/domain-data/{userId}/{domain}` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `WorldModel.getDomainData` |
| `DELETE /api/world-model/domain-data/{userId}/{domain}` | **VAULT_OWNER** | `Depends(require_vault_owner_token)` | Next.js proxy; native `WorldModel.clearDomain` |
| `GET /api/identity/auto-detect` | **Firebase** | `verify_firebase_bearer(...)` | Next.js proxy; native `HushhIdentity.autoDetect` |
| `POST /api/identity/confirm` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `HushhIdentity.confirmIdentity` |
| `GET /api/identity/status` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `HushhIdentity.getIdentityStatus` |
| `POST /api/identity/profile` | **VAULT_OWNER(body)** | `validate_token(consent_token)` | Next.js route uses body; iOS currently sends header+body |
| `DELETE /api/identity/profile` | **VAULT_OWNER** | `validate_token(...VAULT_OWNER)` | Next.js proxy; native `HushhIdentity.resetIdentity` |

## Known drift points (must be fixed for parity)

1. **Consent list verbs differ on iOS**\n+   - iOS `HushhConsentPlugin` uses **POST** for pending/active/history, while backend expects **GET** (Next.js uses GET).\n+2. **Token fallback (`vaultOwnerToken ?? authToken`) in `WorldModelPlugin`**\n+   - Consent-gated world-model operations must not accept Firebase tokens.\n+3. **Array wrapping on iOS**\n+   - `WorldModelPlugin` wraps arrays as `{ data: [...] }`. TS service layer must normalize both raw arrays (web) and wrapped arrays (native).\n+4. **Web service routes missing Authorization forwarding**\n+   - Several `ApiService` web branches call `/api/kai/*` without `Authorization`, preventing Next.js proxy from forwarding VAULT_OWNER.\n+5. **Next.js proxy gaps**\n+   - `app/api/consent/revoke` doesn’t forward `Authorization`.\n+   - `app/api/identity/profile` doesn’t forward `Authorization` (relies on body token).\n+
