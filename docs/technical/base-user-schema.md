# Hushh User Data Schema - Base Architecture

> **Last Updated:** 2024-12-12
> **Purpose:** Define the foundational schema that all domain-specific data extends from

---

## Architecture Overview

Hushh uses a **Card-based data model** where:

- Each user has multiple **Cards** representing different data domains
- Cards contain **Survey Q&A data** (question/answer pairs)
- Access requires **User Consent** per card
- User identifier is **phone_number**

```
┌─────────────────────────────────────────────────────────────┐
│                     BASE USER PROFILE                       │
│  (Core identity that all cards reference)                   │
├─────────────────────────────────────────────────────────────┤
│   phone_number (primary identifier)                         │
│   hushh_id                                                  │
│   name, email, demographics                                 │
└─────────────────────────────────────────────────────────────┘
         │
         ├──► [Hushh ID Card]        (id: 132)
         ├──► [Personal Info Card]   (id: 131) - Demographics
         ├──► [Cuisine Card]         (id: 60)  - Food
         ├──► [Fashion Card]         (id: 61)  - Style
         ├──► [Travel Card]          (id: 64)  - Travel
         ├──► [Health Card]          (id: xxx) - Wellness
         ├──► [Insurance Card]       (id: 237) - Policies
         └──► [Brand Cards]          (brand-specific)
```

---

## 1. Base User Profile

The core identity that links all cards together.

### `UserProfile`

| Field          | Type      | Required | Description                       |
| -------------- | --------- | -------- | --------------------------------- |
| `phone_number` | string    | ✅       | Primary identifier (E.164 format) |
| `hushh_id`     | string    | ✅       | Unique Hushh platform ID          |
| `email`        | string    | ❌       | User email (optional)             |
| `display_name` | string    | ❌       | Preferred display name            |
| `first_name`   | string    | ❌       | First name                        |
| `last_name`    | string    | ❌       | Last name                         |
| `avatar_url`   | string    | ❌       | Profile picture URL               |
| `created_at`   | timestamp | ✅       | Account creation date             |
| `updated_at`   | timestamp | ✅       | Last profile update               |

### Example

```json
{
  "phone_number": "+14155551234",
  "hushh_id": "hsh_user_abc123def456",
  "email": "user@example.com",
  "display_name": "Alex",
  "first_name": "Alex",
  "last_name": "Smith",
  "avatar_url": "https://...",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-12-12T11:00:00Z"
}
```

---

## 2. Card Model

All domain data is stored as "Cards" with standardized structure.

### `Card`

| Field            | Type      | Required | Description                   |
| ---------------- | --------- | -------- | ----------------------------- |
| `card_id`        | number    | ✅       | Unique card type ID           |
| `brand_name`     | string    | ✅       | Card/brand name               |
| `category`       | string    | ✅       | Domain category               |
| `user_phone`     | string    | ✅       | User's phone number           |
| `installed_at`   | timestamp | ✅       | When user installed this card |
| `consented`      | boolean   | ✅       | Whether consent is granted    |
| `consent_expiry` | timestamp | ❌       | When consent expires          |
| `data`           | CardData  | ✅       | Card-specific data            |

### Known Card Types

| ID  | Name                 | Category                 | Domain    |
| --- | -------------------- | ------------------------ | --------- |
| 131 | Personal Information | Demographic Card         | Core      |
| 132 | Hushh ID Card        | Hushh ID Card            | Core      |
| 60  | Cuisine Card         | Food - Personal          | Food      |
| 61  | Fashion Card         | Fashion, Dress, Personal | Fashion   |
| 64  | Travel Card          | Travel Preferences       | Travel    |
| 237 | Insurance Card       | Insurance                | Insurance |

---

## 3. Survey Q&A Format

Hushh stores most card data as question/answer surveys.

### `CardData` (Survey Format)

| Field     | Type     | Description        |
| --------- | -------- | ------------------ |
| `answers` | Answer[] | Array of Q&A pairs |

### `Answer`

| Field          | Type     | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `question`     | string   | The question text                                  |
| `questionType` | enum     | `multiSelectQuestion`, `singleSelect`, `textInput` |
| `answers`      | string[] | Array of selected answers (JSON strings)           |
| `metadata`     | object   | Optional metadata                                  |
| `audio_url`    | string   | Optional voice response URL                        |

### Answer Value Format

```json
{
  "text": "Vegetarian",
  "image": null
}
```

### Example: Health Card Data

```json
{
  "answers": [
    {
      "question": "What are your top health and wellness goals?",
      "questionType": "multiSelectQuestion",
      "answers": [
        "{\"text\":\"Mental & Emotional Well-being\",\"image\":null}",
        "{\"text\":\"Physical Health\",\"image\":null}"
      ]
    },
    {
      "question": "Do you have any dietary restrictions?",
      "questionType": "multiSelectQuestion",
      "answers": ["{\"text\":\"Vegetarian\",\"image\":null}"]
    }
  ]
}
```

---

## 4. Consent Model

All data access requires explicit user consent.

### `ConsentRequest`

| Field          | Type   | Required | Description                       |
| -------------- | ------ | -------- | --------------------------------- |
| `phone_number` | string | ✅       | Target user                       |
| `access_token` | string | ✅       | Developer's token                 |
| `card_name`    | string | ✅       | Card requesting access to         |
| `expiry`       | string | ✅       | Consent duration (e.g., "3 days") |

### Consent Flow

```
Developer                    Hushh API                     User
    │                            │                           │
    ├──► POST /request-consent ──►│                           │
    │                            ├──► Push notification ─────►│
    │                            │                           │
    │    (wait up to 3 min)      │    ◄── Accept/Reject ─────┤
    │                            │                           │
    ◄── "Consent granted" ──────┤                           │
    │                            │                           │
    ├──► GET /food-data ─────────►│                           │
    │                            │                           │
    ◄── { data: [...] } ────────┤                           │
```

---

## 5. Domain Extensions

Each domain extends the base card structure with specific fields.

### Food Domain (see: food-dining-schema.md)

- Dietary preferences
- Favorite cuisines
- Allergies & restrictions
- Restaurant preferences

### Fashion Domain

- Style preferences
- Brand preferences
- Size information
- Color preferences

### Travel Domain

- Destination preferences
- Travel style
- Budget range
- Accommodation preferences

### Health Domain

- Wellness goals
- Exercise preferences
- Dietary restrictions
- Health apps used

---

## Consent Scopes by Domain

| Scope               | Domain    | Access                  |
| ------------------- | --------- | ----------------------- |
| `core.read.profile` | Core      | Basic user profile      |
| `core.read.cards`   | Core      | List of installed cards |
| `food.read.*`       | Food      | Dietary & dining data   |
| `fashion.read.*`    | Fashion   | Style preferences       |
| `travel.read.*`     | Travel    | Travel preferences      |
| `health.read.*`     | Health    | Wellness data           |
| `insurance.read.*`  | Insurance | Policy data             |

---

## API Authentication

All endpoints require:

1. **Session Token** via `/sessiontoken` endpoint
2. **User's phone_number** as query parameter
3. **Consent** for the specific card/data type

### Base URL

```
https://hushhdevenv.hushh.ai/dev/v1/api
```

### Headers

```
Authorization: Bearer <session_token>
Content-Type: application/json
```
