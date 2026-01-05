# Kai Investor Onboarding — V0 Delivery (5-7 Days)

> **Target Date**: January 10, 2026
> **Scope**: Minimum viable Kai investor onboarding flow for Fund A pilot

---

## V0 Objective

Deliver a working investor onboarding flow that demonstrates the core Kai value proposition:

> **"I coordinate onboarding through the people you already trust—so you don't spend time on paperwork."**

### Success Criteria

| Criteria              | Target                                |
| --------------------- | ------------------------------------- |
| End-to-end flow works | ✅ Investor can complete onboarding   |
| Consent captured      | ✅ Explicit, auditable consent grants |
| Manager notification  | ✅ Email sent to chosen manager       |
| Audit trail complete  | ✅ Every action logged                |
| Time to consent       | < 2 minutes                           |
| Completion rate       | > 70% (for V0 pilot)                  |

---

## Kai Has Two Modes

| Mode                    | Purpose                                     | Focus                      |
| ----------------------- | ------------------------------------------- | -------------------------- |
| **Investor Onboarding** | Onboard LPs into funds via trusted managers | ✅ V0 - Ship this          |
| **Investment Analysis** | Analyze stocks with 3 specialist agents     | Later (existing README.md) |

---

## V0 Flow (60 seconds)

| Time | What Happens                                                |
| ---- | ----------------------------------------------------------- |
| 0:07 | Kai introduces itself                                       |
| 0:15 | "Who currently manages capital on your behalf?"             |
| 0:20 | Investor selects: Family Office / RIA / Private Bank / Self |
| 0:30 | Consent screen: "May I coordinate with them?"               |
| 0:50 | Investor grants consent                                     |
| 0:60 | "I'll take it from here."                                   |

---

## V0 Operons (3 Core + 2 Support)

### Core Operons (P0)

| Operon                    | What It Does                           | Input                         | Output                        |
| ------------------------- | -------------------------------------- | ----------------------------- | ----------------------------- |
| `create_investor_profile` | Store identity + trusted manager       | email, auth method            | investorId, sessionId         |
| `request_manager_consent` | Ask investor to authorize coordination | sessionId, managerType, scope | consentId, status             |
| `initiate_kyc_handoff`    | Begin KYC/AML through trusted manager  | sessionId, consentId          | handoffId, notificationStatus |

### Support Operons (P1)

| Operon               | What It Does                     | Input                       | Output            |
| -------------------- | -------------------------------- | --------------------------- | ----------------- |
| `log_audit_entry`    | Record action to audit trail     | sessionId, action, metadata | entryId           |
| `get_session_status` | Return current onboarding status | sessionId                   | status, analytics |

---

## Data Model (V0)

> See `test.tsx` for full TypeScript interfaces

### Investor Identity

```typescript
interface Investor {
  investorId: string;
  email: string;
  identityVerified: boolean;
  identityVerifiedAt?: Date;
}
```

### Trust Relationship

```typescript
interface TrustRelationship {
  investorId: string;
  managerId: string;
  managerType: "family_office" | "ria" | "private_bank" | "self_managed";
  managerName: string;
  managerEmail?: string;
  consentGranted: boolean;
  consentScope: ConsentScope[];
}
```

### Consent Grant

```typescript
interface ConsentGrant {
  consentId: string;
  sessionId: string;
  investorId: string;
  managerId: string;
  scope: ConsentScope[];
  grantedAt: Date;
  expiresAt: Date;
  revoked: boolean;
}
```

### Audit Entry

```typescript
interface AuditEntry {
  entryId: string;
  sessionId: string;
  action: AuditAction;
  actor: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
```

---

## UI Components (V0)

### 1. Kai Intro Card

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  🤫 Kai                                         │
│                                                 │
│  "I'm Kai.                                      │
│   I coordinate onboarding through the people   │
│   you already trust—so you don't spend time    │
│   on paperwork."                                │
│                                                 │
│                    [Continue →]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. Manager Selection

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Who manages capital on your behalf?            │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ Family Office   │  │ RIA             │       │
│  └─────────────────┘  └─────────────────┘       │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ Private Bank    │  │ Self-Managed    │       │
│  └─────────────────┘  └─────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3. Consent Grant

```
┌─────────────────────────────────────────────────┐
│  🔐 Permission Request                          │
│                                                 │
│  Kai will coordinate with your manager to:      │
│                                                 │
│  ✅ Verify your identity (KYC)                  │
│  ✅ Confirm accreditation status                │
│  ✅ Check AML clearance                         │
│                                                 │
│  ❌ Kai will NOT:                               │
│     • Execute any transactions                  │
│     • Access portfolio holdings                 │
│                                                 │
│  [Deny]                    [Grant Permission]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4. Completion Card

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ✅ You're all set.                             │
│                                                 │
│  Kai has notified your manager.                 │
│  We'll update you when verification is          │
│  complete.                                      │
│                                                 │
│  Estimated time: 24-48 hours                    │
│                                                 │
│  [View Status]          [Return to Fund A]      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## API Endpoints (V0)

| Endpoint                              | Method | Description                   |
| ------------------------------------- | ------ | ----------------------------- |
| `/api/onboarding/start`               | POST   | Create new onboarding session |
| `/api/onboarding/:sessionId`          | GET    | Get session status            |
| `/api/onboarding/:sessionId/manager`  | POST   | Record manager selection      |
| `/api/onboarding/:sessionId/consent`  | POST   | Grant consent                 |
| `/api/onboarding/:sessionId/notify`   | POST   | Send manager notification     |
| `/api/onboarding/:sessionId/complete` | POST   | Mark session complete         |
| `/api/audit/:sessionId`               | GET    | Get audit trail               |

---

## Implementation Plan (5-7 Days)

### Day 1-2: Foundation

- [ ] Set up onboarding database schema (PostgreSQL)
- [ ] Create session management logic
- [ ] Implement `create_investor_profile` operon
- [ ] Build Kai intro component

### Day 3-4: Core Flow

- [ ] Build manager selection component
- [ ] Implement `request_manager_consent` operon
- [ ] Build consent grant component
- [ ] Implement `log_audit_entry` operon

### Day 5-6: Notification & Completion

- [ ] Implement `initiate_kyc_handoff` operon (email notification)
- [ ] Build completion card
- [ ] Build status tracking page
- [ ] Test end-to-end flow

### Day 7: Polish & Deploy

- [ ] Fix bugs from testing
- [ ] Deploy to staging
- [ ] Test with internal team
- [ ] Prepare pilot documentation

---

## Success Metrics (V0)

| Metric                   | V0 Target | Measurement                     |
| ------------------------ | --------- | ------------------------------- |
| **Completion rate**      | > 70%     | Sessions completed / started    |
| **Time to consent**      | < 2 min   | Intro → consent granted         |
| **Manager notification** | 100%      | Notifications sent successfully |
| **Audit completeness**   | 100%      | All actions logged              |
| **Investor touches**     | ≤ 3       | Active interactions required    |

---

## V0 Scope: In vs Out

### ✅ In Scope (V0)

- 7-second opening script
- Manager type selection (4 types)
- Consent grant flow with scope display
- Manager notification (email)
- Audit logging
- Session status tracking
- Completion confirmation

### ❌ Out of Scope (V0 → Later)

| Feature                     | Phase   | Reason                  |
| --------------------------- | ------- | ----------------------- |
| A2A protocol                | Phase 2 | Complex integration     |
| Subscription doc generation | Phase 2 | Legal templates needed  |
| Wire instruction automation | Phase 2 | Custodian-specific      |
| Biometric consent (FaceID)  | Phase 2 | Native integration      |
| Manager portal              | Phase 2 | Focus on investor first |
| Pattern learning            | Phase 3 | Need data first         |

---

## Technical Stack

- **Frontend**: Next.js 16 + React 19 (existing webapp)
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (Cloud SQL)
- **Auth**: Google Sign-In (existing)
- **Email**: SendGrid or existing provider
- **Audit**: PostgreSQL + immutable append-only table

---

## Connection to Investment Analysis (Later)

After onboarding completes, investor can access Kai's **investment analysis mode**:

- 3 specialist agents (Fundamental, Sentiment, Valuation)
- Debate process
- Decision Cards with Buy/Hold/Reduce
- Risk personas (Conservative/Balanced/Aggressive)

This is shipped after V0 onboarding works.

---

## Compliance

- Identity verified before any action
- Consent is specific, scoped, revocable
- All consents logged with timestamps
- Every action auditable
- Educational disclaimer on analysis outputs

---

## Related Files

| File                  | Description                          |
| --------------------- | ------------------------------------ |
| `founder-thoughts.md` | Full founder vision from ChatGPT     |
| `onboarding.md`       | Technical specification (detailed)   |
| `test.tsx`            | TypeScript types and KPI definitions |
| `README.md`           | Agent Kai overview (analysis mode)   |

---

_Kai V0 — The fastest path to "Does this fund use Kai?"_
