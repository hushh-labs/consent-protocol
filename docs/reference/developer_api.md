# Hushh Developer API Guide

> Access user data with explicit consent through the Hushh Protocol.

---

## 🎯 Overview

The Hushh Developer API allows external applications to access user data **only with valid consent tokens**. This ensures users maintain complete control over their personal information.

### Core Principles

| Principle         | What It Means for Developers                         |
| ----------------- | ---------------------------------------------------- |
| **Consent First** | You MUST request consent before accessing any data   |
| **Scoped Access** | Tokens grant access only to specific data categories |
| **Time-Limited**  | Tokens expire - you must request fresh consent       |
| **Auditable**     | All access is logged for user transparency           |

---

## 🚀 Quick Start

### 1. Register as a Developer

```bash
# Contact Hushh to get your developer token
# Example: dev-partner-001
```

### 2. Request Consent

```bash
curl -X POST http://localhost:8000/api/v1/request-consent \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "firebase_user_id",
    "developer_token": "dev-partner-001",
    "scope": "attr.financial.*",
    "expiry_hours": 24
  }'
```

### 3. Response: Pending (User Must Approve)

```json
{
  "status": "pending",
  "message": "Consent request submitted. User must approve in their dashboard. Request ID: abc12345"
}
```

> **Note:** Consent is NOT auto-granted. User must approve in `/dashboard/consents`.

### 4. Poll for Approval or Webhook (Coming Soon)

Once user approves, the consent token becomes available.

### 5. Receive Consent Token (After User Approval)

```json
{
  "status": "approved",
  "message": "Consent granted to Partner App",
  "consent_token": "HCT:dXNlcl9...",
  "expires_at": 1702656000000
}
```

### 6. Access Data

```bash
curl -X GET http://localhost:8000/api/world-model/attributes/firebase_user_id?domain=financial \
  -H "Content-Type: application/json" \
  -H "X-Consent-Token: HCT:dXNlcl9..."
```

---

## 📡 API Endpoints

### Base URL

```
Production: See deployment documentation for production URL
Development: http://localhost:8000
```

### Endpoints

| Method | Endpoint                       | Description                            |
| ------ | ------------------------------ | -------------------------------------- |
| `POST` | `/api/v1/request-consent`      | Request user consent (returns pending) |
| `GET`  | `/api/consent/pending`         | Get pending consent requests for user  |
| `POST` | `/api/consent/pending/approve` | User approves a pending request        |
| `POST` | `/api/consent/pending/deny`    | User denies a pending request          |
| `GET`  | `/api/v1/list-scopes`          | List all available consent scopes      |
| `POST` | `/api/validate-token`          | Validate a consent token               |

### World Model Endpoints

| Method   | Endpoint                                    | Description                            |
| -------- | ------------------------------------------- | -------------------------------------- |
| `GET`    | `/api/world-model/index/{user_id}`          | Get user's world model index           |
| `POST`   | `/api/world-model/index`                    | Update world model index               |
| `GET`    | `/api/world-model/attributes/{user_id}`     | Get encrypted attributes               |
| `POST`   | `/api/world-model/attributes`               | Store encrypted attribute              |
| `DELETE` | `/api/world-model/attributes/{user_id}/{domain}/{key}` | Delete attribute        |
| `GET`    | `/api/world-model/metadata/{user_id}`       | Get UI-ready metadata                  |
| `GET`    | `/api/world-model/domains`                  | List all registered domains            |
| `GET`    | `/api/world-model/domains/{user_id}`        | Get user's domains                     |
| `GET`    | `/api/world-model/scopes/{user_id}`         | Get available scopes (MCP discovery)   |

---

## 🔐 Consent Scopes

### Static Scopes (Operations)

| Scope                      | Description                 | Data Fields               |
| -------------------------- | --------------------------- | ------------------------- |
| `vault.owner`              | Full vault access (BYOK)    | All user data             |
| `portfolio.import`         | Import portfolio data       | Holdings, transactions    |
| `portfolio.analyze`        | Analyze portfolio           | Analysis results          |
| `portfolio.read`           | Read portfolio data         | Holdings, performance     |
| `chat.history.read`        | Read chat history           | Conversations, messages   |
| `chat.history.write`       | Write chat history          | New messages              |
| `world_model.read`         | Read world model data       | Attributes, index         |
| `world_model.write`        | Write world model data      | Store attributes          |
| `world_model.metadata`     | Read world model metadata   | Domain summaries          |
| `agent.kai.analyze`        | Perform investment analysis | N/A (Functional scope)    |
| `agent.kai.chat`           | Chat with Kai agent         | N/A (Functional scope)    |

### Dynamic Scopes (Attributes)

Dynamic scopes follow the pattern `attr.{domain}.{attribute}`:

| Pattern                    | Description                 | Examples                  |
| -------------------------- | --------------------------- | ------------------------- |
| `attr.{domain}.{key}`      | Specific attribute access   | `attr.financial.holdings` |
| `attr.{domain}.*`          | All attributes in domain    | `attr.subscriptions.*`    |

**Common Domains:**
- `financial` - Investment data, risk profile
- `subscriptions` - Streaming services, memberships
- `health` - Fitness, wellness data
- `travel` - Travel preferences, loyalty programs
- `food` - Dietary preferences, cuisines
- `professional` - Career, skills, experience

### Legacy Scopes (Deprecated)

| Scope                      | Description                 | Migration Target          |
| -------------------------- | --------------------------- | ------------------------- |
| `vault_read_food`          | Read food preferences       | `attr.food.*`             |
| `vault_read_professional`  | Read professional profile   | `attr.professional.*`     |
| `vault_write_food`         | Write food preferences      | `attr.food.*`             |
| `vault_write_professional` | Write professional profile  | `attr.professional.*`     |
| `vault_read_finance`       | Read financial data         | `attr.financial.*`        |
| `vault.read.risk_profile`  | Read investment risk        | `attr.financial.risk_profile` |

---

## 📝 Request/Response Schemas

### Request Consent

**Request:**

```json
{
  "user_id": "string",
  "developer_token": "string",
  "scope": "vault_read_food | vault_read_professional | ...",
  "expiry_hours": 24
}
```

**Response (Pending - User Must Approve):**

```json
{
  "status": "pending",
  "message": "Consent request submitted. User must approve in their dashboard. Request ID: abc12345"
}
```

**Response (Already Pending):**

```json
{
  "status": "pending",
  "message": "Consent request already pending. Waiting for user approval."
}
```

**Response (Already Granted):**

```json
{
  "status": "already_granted",
  "message": "User has already granted consent for this scope.",
  "consent_token": "HCT:..."
}
```

### Access Data

**Request:**

```json
{
  "user_id": "string",
  "consent_token": "HCT:..."
}
```

**Response (Success - World Model Attributes):**

```json
{
  "status_code": 200,
  "data": {
    "attributes": [
      {
        "domain": "financial",
        "attribute_key": "holdings_count",
        "ciphertext": "encrypted...",
        "iv": "...",
        "tag": "...",
        "source": "imported"
      },
      {
        "domain": "financial",
        "attribute_key": "risk_bucket",
        "ciphertext": "encrypted...",
        "iv": "...",
        "tag": "...",
        "source": "computed"
      }
    ]
  }
}
```

**Response (Error):**

```json
{
  "status_code": 403,
  "error": "Forbidden: Token expired"
}
```

---

## 🔒 Token Format

```
HCT:base64(user_id|agent_id|scope|issued_at|expires_at).hmac_sha256_signature
```

### Token Fields

| Field        | Description                                |
| ------------ | ------------------------------------------ |
| `HCT`        | Hushh Consent Token prefix                 |
| `user_id`    | Firebase user ID                           |
| `agent_id`   | `developer:dev-token` for API access       |
| `scope`      | Authorized scope (e.g., `vault.read.food`) |
| `issued_at`  | Unix timestamp (ms)                        |
| `expires_at` | Unix timestamp (ms)                        |
| `signature`  | HMAC-SHA256 of payload                     |

---

## ⚠️ Error Handling

| Status Code | Error                                 | Solution                        |
| ----------- | ------------------------------------- | ------------------------------- |
| `401`       | Unauthorized: Invalid developer token | Check your developer token      |
| `403`       | Forbidden: Token expired              | Request fresh consent           |
| `403`       | Forbidden: Scope mismatch             | Request correct scope           |
| `403`       | Forbidden: Token user mismatch        | Token for different user        |
| `404`       | No data found                         | User hasn't saved this data yet |

---

## 🔄 Token Lifecycle

```
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│   Request    │────►│   User        │────►│   Token       │
│   Consent    │     │   Approves    │     │   Issued      │
└──────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│   Token      │◄────│   Access      │◄────│   Validate    │
│   Expired    │     │   Granted     │     │   Token       │
└──────────────┘     └───────────────┘     └───────────────┘
```

---

## 💻 Code Examples

### Python

```python
import requests

HUSHH_API = "http://localhost:8000"
DEV_TOKEN = "dev-partner-001"

# Step 1: Request consent for financial data
consent_resp = requests.post(f"{HUSHH_API}/api/v1/request-consent", json={
    "user_id": "user_firebase_id",
    "developer_token": DEV_TOKEN,
    "scope": "attr.financial.*",
    "expiry_hours": 24
})
consent_token = consent_resp.json()["consent_token"]

# Step 2: Access world model attributes
data_resp = requests.get(
    f"{HUSHH_API}/api/world-model/attributes/user_firebase_id",
    params={"domain": "financial"},
    headers={"X-Consent-Token": consent_token}
)
attributes = data_resp.json()["data"]["attributes"]
print(attributes)

# Step 3: Get user's world model metadata
metadata_resp = requests.get(
    f"{HUSHH_API}/api/world-model/metadata/user_firebase_id",
    headers={"X-Consent-Token": consent_token}
)
metadata = metadata_resp.json()
print(f"User has {metadata['total_attributes']} attributes across {metadata['available_domains']}")
```

### JavaScript

```javascript
const HUSHH_API = "http://localhost:8000";
const DEV_TOKEN = "dev-partner-001";

// Step 1: Request consent for financial data
const consentResp = await fetch(`${HUSHH_API}/api/v1/request-consent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_id: "user_firebase_id",
    developer_token: DEV_TOKEN,
    scope: "attr.financial.*",
    expiry_hours: 24,
  }),
});
const { consent_token } = await consentResp.json();

// Step 2: Access world model attributes
const dataResp = await fetch(
  `${HUSHH_API}/api/world-model/attributes/user_firebase_id?domain=financial`,
  {
    headers: { "X-Consent-Token": consent_token },
  }
);
const { data } = await dataResp.json();
console.log(data.attributes);

// Step 3: Get user's world model metadata
const metadataResp = await fetch(
  `${HUSHH_API}/api/world-model/metadata/user_firebase_id`,
  {
    headers: { "X-Consent-Token": consent_token },
  }
);
const metadata = await metadataResp.json();
console.log(`User has ${metadata.total_attributes} attributes`);
```

---

## 🧪 Testing

### Validate Token Endpoint

```bash
curl -X POST http://localhost:8000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token": "HCT:..."}'
```

**Response:**

```json
{
  "valid": true,
  "user_id": "user_firebase_id",
  "agent_id": "developer:dev-partner-001",
  "scope": "vault.read.food"
}
```

---

## 🔗 Swagger Documentation

When the server is running:

```
http://localhost:8000/docs
```

---

## 📧 Support

For developer registration and support:

- Email: eng@hush1one.com
- Documentation: See `docs/reference/developer_api.md` for API documentation

---

_Version: 2.0 | Last Updated: January 31, 2026 | World Model API_
