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
curl -X POST https://api.hushh.ai/api/v1/request-consent \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "firebase_user_id",
    "developer_token": "dev-partner-001",
    "scope": "vault_read_food",
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
curl -X POST https://api.hushh.ai/api/v1/food-data \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "firebase_user_id",
    "consent_token": "HCT:dXNlcl9..."
  }'
```

---

## 📡 API Endpoints

### Base URL

```
Production: https://api.hushh.ai
Development: http://localhost:8000
```

### Endpoints

| Method | Endpoint                       | Description                            |
| ------ | ------------------------------ | -------------------------------------- |
| `POST` | `/api/v1/request-consent`      | Request user consent (returns pending) |
| `GET`  | `/api/consent/pending`         | Get pending consent requests for user  |
| `POST` | `/api/consent/pending/approve` | User approves a pending request        |
| `POST` | `/api/consent/pending/deny`    | User denies a pending request          |
| `POST` | `/api/v1/food-data`            | Get user's food preferences            |
| `POST` | `/api/v1/professional-data`    | Get user's professional profile        |
| `GET`  | `/api/v1/list-scopes`          | List all available consent scopes      |
| `POST` | `/api/validate-token`          | Validate a consent token               |

---

## 🔐 Consent Scopes

| Scope                      | Description                 | Data Fields               |
| -------------------------- | --------------------------- | ------------------------- |
| `vault_read_food`          | Read food preferences       | dietary, cuisines, budget |
| `vault_read_professional`  | Read professional profile   | title, skills, experience |
| `vault_write_food`         | Write food preferences      | dietary, cuisines, budget |
| `vault_write_professional` | Write professional profile  | title, skills, experience |
| `vault_read_finance`       | Read financial data         | budget, transactions      |
| `vault.read.risk_profile`  | Read investment risk        | risk_profile, mode        |
| `vault.write.decision`     | Write investment decision   | decision_card (encrypted) |
| `agent.kai.analyze`        | Perform investment analysis | N/A (Functional scope)    |

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

**Response (Success):**

```json
{
  "status_code": 200,
  "data": {
    "dietary_preferences": ["Vegetarian", "Gluten-Free"],
    "favorite_cuisines": ["Italian", "Mexican", "Thai"],
    "monthly_budget": 500
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

# Step 1: Request consent
consent_resp = requests.post(f"{HUSHH_API}/api/v1/request-consent", json={
    "user_id": "user_firebase_id",
    "developer_token": DEV_TOKEN,
    "scope": "vault_read_food",
    "expiry_hours": 24
})
consent_token = consent_resp.json()["consent_token"]

# Step 2: Access data
data_resp = requests.post(f"{HUSHH_API}/api/v1/food-data", json={
    "user_id": "user_firebase_id",
    "consent_token": consent_token
})
food_preferences = data_resp.json()["data"]
print(food_preferences)
```

### JavaScript

```javascript
const HUSHH_API = "http://localhost:8000";
const DEV_TOKEN = "dev-partner-001";

// Step 1: Request consent
const consentResp = await fetch(`${HUSHH_API}/api/v1/request-consent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_id: "user_firebase_id",
    developer_token: DEV_TOKEN,
    scope: "vault_read_food",
    expiry_hours: 24,
  }),
});
const { consent_token } = await consentResp.json();

// Step 2: Access data
const dataResp = await fetch(`${HUSHH_API}/api/v1/food-data`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_id: "user_firebase_id",
    consent_token,
  }),
});
const { data } = await dataResp.json();
console.log(data);
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

- Email: developers@hushh.ai
- Documentation: https://docs.hushh.ai

---

_Version: 1.0 | Last Updated: 2024-12-14_
