# Hushh Platform APIs Reference

> **Last Updated:** 2024-12-12
> **Source:** [GitBook Documentation](https://hushh.gitbook.io/hushh-docs/api-reference)

---

## ⚠️ Important Architecture Notes

> [!IMPORTANT] > **consent-protocol is READ-ONLY**
>
> - It's an upstream repository maintained by the Hushh team
> - We use it as a submodule for consent token functionality only
> - Do NOT modify consent-protocol files

> [!NOTE] > **Operons & Agents live in `hushh-adk-agents/`**
>
> - All custom operons go in `hushh-adk-agents/operons/`
> - All custom agents go in `hushh-adk-agents/`
> - consent_api server is in `hushh-adk-agents/consent_api/`

> [!CAUTION] > **No API credentials available for Fashion API testing**
>
> - Cannot test live endpoints at `hushhdevenv.hushh.ai`
> - Build with mock data or wait for credentials

---

## Overview

Hushh has three core API domains that provide user data pipelines for building personalized experiences:

| API                  | Purpose                        | Status      |
| -------------------- | ------------------------------ | ----------- |
| **PII API**          | Personal identity & attributes | Coming Soon |
| **Fashion API**      | Style preferences & brand data | **Live**    |
| **Transactions API** | Spending patterns & rewards    | Coming Soon |

**Base URL:** `https://hushhdevenv.hushh.ai/dev/v1/api`

---

## 1. PII API (Personal Identifiable Information)

### Capabilities

- User age, net worth, address
- Ethnicity and country of residence
- Personal attributes and preferences

### Use Cases

- First-layer personalization
- User identity verification
- Demographic insights

> ⚠️ **Status:** Coming soon to developers

---

## 2. Fashion API

### Capabilities

- **Style Preferences:** User's unique fashion choices
- **Purchase History:** Brands, frequency, spending habits
- **Browser History:** Online interests and behaviors
- **Digital Closet:** Virtual inventory of owned clothing
- **Outfit Recommendations:** Personalized suggestions

### Live Endpoints

#### `GET /get_brands`

Get all fashion brands working with Hushh (120+ brands).

```bash
GET https://hushhdevenv.hushh.ai/dev/v1/api/get_brands
```

**Response:**

```json
{
  "status": 1,
  "message": "Success",
  "data": [
    {
      "_id": "b103d3fd252c0f65841499309b1f088357b7fa74",
      "brand_name": "Moet & Chandon",
      "logo": "https://firebasestorage.googleapis.com/.../logo.png"
    }
  ]
}
```

---

#### `POST /request_brand_access`

Request developer access to brand-specific data.

```bash
POST https://hushhdevenv.hushh.ai/dev/v1/api/request_brand_access
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Developer email |
| `access_type` | string | ✅ | Type of access |
| `brand` | string | ✅ | Brand ID |

**Response:**

```json
{ "status": 1, "message": "Success", "data": "Access Requested" }
```

---

#### `POST /get_user_brand_list`

Get all brand cards downloaded by a user.

```bash
POST https://hushhdevenv.hushh.ai/dev/v1/api/get_user_brand_list
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | User email |

**Response:**

```json
{
  "status": 1,
  "message": "Success",
  "data": [
    { "_id": "...", "survey_id": "...", "brand_name": "Berluti" },
    { "_id": "...", "survey_id": "...", "brand_name": "Romavi" }
  ]
}
```

---

#### `POST /get_user_brand_card`

Get brand preferences/survey data for a specific user+brand.

```bash
POST https://hushhdevenv.hushh.ai/dev/v1/api/get_user_brand_card
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | User email |
| `brand_id` | string | ✅ | Brand ID |

**Response:**

```json
{
  "status": 1,
  "data": [
    {
      "_id": "...",
      "survey_id": "...",
      "card_data": [
        {
          "question_text": "What style do you prefer?",
          "answer_text": "Classic"
        }
      ]
    }
  ]
}
```

---

## 3. Transactions API

### Capabilities

- Card type and currency
- Spending range and patterns
- Brands shopped at
- High transaction months
- Shipping/billing information

### Use Cases

- Recommend loyalty programs
- Spending analytics
- Budget optimization
- Brand affinity analysis

> ⚠️ **Status:** Coming soon to developers

---

## Consent Integration

All API calls involving user data must be accompanied by a valid **HushhConsentToken** issued through the consent-protocol. See [consent-api documentation](./consent-protocol-api.md).

### Required Scopes

| API              | Scope                                     |
| ---------------- | ----------------------------------------- |
| PII API          | `vault.read.pii`                          |
| Fashion API      | `vault.read.fashion`, `vault.read.brands` |
| Transactions API | `vault.read.transactions`                 |

---

## Building Operons

Operons are the building blocks for interacting with these APIs. Each operon should:

1. **Request consent** before accessing user data
2. **Validate tokens** on every call
3. **Be stateless** and modular
4. **Return structured data** for agents to use

### Planned Operons

| Operon                       | API          | Description                  |
| ---------------------------- | ------------ | ---------------------------- |
| `fetch_brands`               | Fashion      | Get available brands         |
| `get_user_brand_preferences` | Fashion      | Get user's brand survey data |
| `get_user_brand_list`        | Fashion      | Get brands user follows      |
| `analyze_spending`           | Transactions | Analyze spending patterns    |
| `recommend_loyalty`          | Transactions | Suggest loyalty programs     |
| `get_user_profile`           | PII          | Fetch user identity data     |

---

## Next Steps

1. [ ] Implement Fashion API operons (live endpoints)
2. [ ] Add consent token validation to all operons
3. [ ] Create agents that orchestrate operons
4. [ ] Wait for Transactions & PII APIs to go live
