# Agent Kai — Onboarding Flow

> User journey from first open to ready-to-analyze

---

## Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KAI ONBOARDING (60 seconds)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: WELCOME + LEGAL (7s)                                        │
│  ├── Display: "I'm Kai. Your personal investment committee."        │
│  ├── Checkboxes: [ ] Not advice [ ] Consult pro [ ] May lose money  │
│  └── Action: User acknowledges                                       │
│                                                                      │
│  Step 2: PROCESSING MODE (15s)                                       │
│  ├── Option A: On-Device Only (Maximum Privacy)                      │
│  ├── Option B: Hybrid Mode (Best Accuracy)                           │
│  └── Action: User selects mode                                       │
│                                                                      │
│  Step 3: RISK PROFILE (15s)                                          │
│  ├── Conservative: Capital preservation                              │
│  ├── Balanced: Growth with protection                                │
│  ├── Aggressive: Growth-focused                                      │
│  └── Action: User selects profile                                    │
│                                                                      │
│  Step 4: CONSENT GRANT (15s)                                         │
│  ├── Display: What Kai WILL do                                       │
│  ├── Display: What Kai will NEVER do                                 │
│  └── Action: User approves (FaceID/BiometricID)                      │
│                                                                      │
│  Step 5: READY (8s)                                                  │
│  ├── Display: "You're all set!"                                      │
│  └── Action: Start Analyzing button                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Collected

| Step   | Data Point                    | Stored In       |
| ------ | ----------------------------- | --------------- | -------------- | -------------- |
| Step 1 | `legal_acknowledged: true`    | `kai_sessions`  |
| Step 2 | `processing_mode: 'on_device' | 'hybrid'`       | `kai_sessions` |
| Step 3 | `risk_profile: 'conservative' | 'balanced'      | 'aggressive'`  | `kai_sessions` |
| Step 4 | Consent token                 | `consent_audit` |
| Step 5 | `onboarding_complete: true`   | `kai_sessions`  |

---

## API Endpoints

| Endpoint                        | Method | Purpose                |
| ------------------------------- | ------ | ---------------------- |
| `/api/kai/session/start`        | POST   | Create session         |
| `/api/kai/session/:id`          | GET    | Get session state      |
| `/api/kai/session/:id/mode`     | PATCH  | Update processing mode |
| `/api/kai/session/:id/risk`     | PATCH  | Update risk profile    |
| `/api/kai/session/:id/consent`  | POST   | Grant consent          |
| `/api/kai/session/:id/complete` | POST   | Mark complete          |

---

## Session State Machine

```
started → legal_acknowledged → mode_selected → risk_selected → consent_granted → complete
```

---

## Existing UI

Location: `hushh-webapp/app/dashboard/kai/page.tsx`

The 5-step wizard already exists. Needs:

- Replace in-memory `actions.ts` with API calls
- Connect to `/api/kai/*` endpoints
