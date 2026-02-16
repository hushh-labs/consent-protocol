# Environment Variables

> Backend environment variables and secrets reference. See `.env.example` for the template.

---

## Parity Rule

What is in `.env` / GCP Secret Manager must match exactly what the code reads -- no extra keys, no missing keys.

- **Local:** `.env` must contain exactly the keys the application code reads. Use `.env.example` as the template.
- **Production:** GCP Secret Manager must hold exactly the secrets the code expects. Cloud Run config injects only these.

---

## Variables

| Variable | Where Read | Required | Notes |
|----------|------------|----------|-------|
| `SECRET_KEY` | `hushh_mcp/config.py` | Yes | Min 32 chars (64-char hex recommended). HMAC signing. |
| `VAULT_ENCRYPTION_KEY` | `hushh_mcp/config.py` | Yes | Exactly 64-char hex. |
| `DB_USER` | `db/connection.py`, `db/db_client.py` | Yes | Supabase pooler username. |
| `DB_PASSWORD` | same | Yes | Database password. |
| `DB_HOST` | same | Yes | Supabase session pooler host. |
| `DB_PORT` | same | No | Default: 5432. |
| `DB_NAME` | same | No | Default: postgres. |
| `FRONTEND_URL` | `server.py` | Yes (prod) | CORS origin. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `api/utils/firebase_admin.py` | Yes | Service account JSON string. Firebase Console > Project Settings > Service accounts > Generate new private key. Store in GCP Secret Manager for production. |
| `GOOGLE_API_KEY` | `hushh_mcp/config.py`, services | Yes | Gemini / Vertex AI API key. |
| `DEFAULT_CONSENT_TOKEN_EXPIRY_MS` | `hushh_mcp/config.py` | No | Token TTL (default: 24h). |
| `DEFAULT_TRUST_LINK_EXPIRY_MS` | `hushh_mcp/config.py` | No | TrustLink TTL. |
| `ENVIRONMENT` | `hushh_mcp/config.py` | No | `production` or `development` (default). |
| `AGENT_ID` | `hushh_mcp/config.py` | No | Default: `agent_hushh_default`. |
| `HUSHH_HACKATHON` | `hushh_mcp/config.py` | No | Feature flag (default: disabled). |
| `CONSENT_TIMEOUT_SECONDS` | `api/routes/sse.py`, `developer.py` | No | Consent wait timeout. |
| `APP_REVIEW_MODE` / `HUSHH_APP_REVIEW_MODE` | `api/routes/health.py` | No | App review mode toggle. |
| `REVIEWER_UID` | `api/routes/health.py` | If app review | Firebase UID used for custom token minting. |
| `CONSENT_SSE_ENABLED` | `api/routes/sse.py` | No | Defaults off in production. |
| `SYNC_REMOTE_ENABLED` | `api/routes/sync.py` | No | Defaults false; sync endpoints return 501 when disabled. |
| `MCP_DEVELOPER_TOKEN` | `api/routes/session.py` | Recommended | Service auth token for `/api/user/lookup`. |
| `ROOT_PATH` | `server.py` | No | FastAPI root path for reverse proxy. |
| `GOOGLE_GENAI_USE_VERTEXAI` | Cloud Run env | No | Set `True` for Vertex AI in production. |

---

## MCP Server Variables

These are read by `mcp_server.py` (separate from the main FastAPI server):

| Variable | Default | Description |
|----------|---------|-------------|
| `CONSENT_API_URL` | `http://localhost:8000` | FastAPI backend URL. |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL for user-facing links. |
| `PRODUCTION_MODE` | `true` | Require real user approval via Hushh app. |
| `MCP_DEVELOPER_TOKEN` | `mcp_dev_claude_desktop` | Developer token registered in FastAPI. |
| `CONSENT_TIMEOUT_SECONDS` | `120` | Max wait for user consent approval. |

---

## Migrations and Scripts

Migration scripts use `DB_*` variables only (same as runtime). `db/migrate.py` uses `db.connection.get_database_url()` and `get_database_ssl()`. There is no `DATABASE_URL` variable.

---

## Secrets in Production

| Variable | Secret | Where Set |
|----------|--------|-----------|
| `SECRET_KEY` | Yes | GCP Secret Manager |
| `VAULT_ENCRYPTION_KEY` | Yes | GCP Secret Manager |
| `DB_USER` | Yes | GCP Secret Manager |
| `DB_PASSWORD` | Yes | GCP Secret Manager |
| `FRONTEND_URL` | Yes | GCP Secret Manager |
| `GOOGLE_API_KEY` | Yes | GCP Secret Manager |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | GCP Secret Manager |
| `DB_HOST` | No | Cloud Run env var |
| `DB_PORT` | No | Cloud Run env var |
| `DB_NAME` | No | Cloud Run env var |
| `ENVIRONMENT` | No | Cloud Run env var |
| `GOOGLE_GENAI_USE_VERTEXAI` | No | Cloud Run env var |

---

## See Also

- [FCM Notifications](./fcm-notifications.md) -- Firebase push notification setup
- [Consent Protocol](./consent-protocol.md) -- Token lifecycle
- [.env.example](../../.env.example) -- Template file
