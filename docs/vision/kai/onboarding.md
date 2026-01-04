# Kai Investor Onboarding — Technical Specification

> **Mission**: Collapse weeks of investor friction into minutes—without compromising control, privacy, or compliance.

---

## Overview

Kai is the AI investor onboarding concierge for Hushh Technology Fund L.P. (Fund A). It works _through_ existing trusted relationships to minimize investor effort while maintaining full compliance and audit trails.

### Key Principles

| Principle             | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| **Consent-first**     | Every action requires explicit, revocable, scoped consent               |
| **Trust-leveraged**   | Uses existing verified relationships (RIAs, family offices, custodians) |
| **Audit-complete**    | Every interaction logged with timestamps and actors                     |
| **Zero-duplication**  | Only requests information that doesn't already exist                    |
| **Professional tone** | Quiet competence, no chatbot energy                                     |

---

## User Experience Flow

### Phase 1: Introduction (0–7 seconds)

**Kai's Opening:**

> "I'm Kai. I coordinate onboarding through the people you already trust—so you don't spend time on paperwork."

**Design Notes:**

- No emojis
- No small talk
- Establishes role, not personality
- Positions Kai as infrastructure, not software

### Phase 2: Trust Identification (7–30 seconds)

**Kai asks:**

> "Who currently manages capital on your behalf?"

**Options presented (large, calm buttons):**

1. Family Office
2. Registered Investment Advisor (RIA)
3. Private Bank / Custodian
4. Self-managed (I'll guide you)

**No forms yet. No uploads yet. Just identity of trust.**

### Phase 3: Consent Grant (30–60 seconds)

**Kai explains:**

> "I will only ask for information that does not already exist with your trusted managers.
> I will never request duplicate documentation.
> And I will not move funds without explicit, auditable consent."

**Consent screen shows:**

- ✅ Who will be contacted
- ✅ What will be requested
- ❌ What will _not_ be accessed

**Investor grants consent (biometric preferred).**

### Phase 4: Manager Coordination (background)

Kai communicates with the investor's trusted managers via A2A protocol:

1. Verifies existing KYC/AML status
2. Requests only net-new information
3. Generates compliant subscription documents
4. Prepares custodian-specific wiring instructions

### Phase 5: Completion

**Kai announces:**

> "Everything is ready. Review your subscription documents, then wire when ready."

**The "nothing left to do" moment should feel:**

- Clear and definitive
- Celebratory but dignified
- Invitation to ongoing relationship

---

## Technical Architecture

### Trust Graph Data Model

```yaml
investor:
  id: "inv_001"
  email: "lp@example.com"
  identity_verified: true
  verification_method: "biometric"
  verified_at: "2026-01-03T17:00:00Z"

trust_relationships:
  - manager_id: "fm_abc"
    type: "family_office"
    name: "ABC Family Office"
    consent_granted: true
    consent_scope: ["kyc", "aml", "accreditation"]
    consent_at: "2026-01-03T17:01:00Z"
    consent_revocable: true

  - manager_id: "ria_xyz"
    type: "ria"
    name: "XYZ Wealth Management"
    consent_granted: true
    consent_scope: ["aml", "wiring"]
    consent_at: "2026-01-03T17:01:30Z"

compliance_status:
  kyc_verified: true
  kyc_source: "fm_abc"
  aml_verified: true
  aml_source: "ria_xyz"
  accreditation_verified: true
  accreditation_source: "fm_abc"

subscription:
  fund_id: "fund_a"
  amount_committed: 1000000
  subscription_doc_generated: true
  subscription_signed: false
  wire_instructions_ready: true
```

### A2A Protocol Messages

#### Request KYC Verification

```json
{
  "type": "kyc_verification_request",
  "from": "kai_fund_a",
  "to": "fm_abc",
  "investor_id": "inv_001",
  "consent_reference": "consent_2026010317010001",
  "fields_requested": ["full_name", "dob", "citizenship", "tax_id"],
  "purpose": "lp_onboarding_fund_a",
  "expires_at": "2026-01-04T17:00:00Z"
}
```

#### Manager Response

```json
{
  "type": "kyc_verification_response",
  "from": "fm_abc",
  "to": "kai_fund_a",
  "investor_id": "inv_001",
  "status": "verified",
  "verification_date": "2024-06-15T10:00:00Z",
  "verification_method": "passport_scan_verified",
  "fields_provided": {
    "full_name": "John Smith",
    "citizenship": "US",
    "tax_id_verified": true
  }
}
```

### Audit Trail Schema

```yaml
audit_entry:
  id: "audit_001"
  timestamp: "2026-01-03T17:01:00Z"
  action: "consent_granted"
  actor: "inv_001"
  target: "fm_abc"
  scope: ["kyc", "aml", "accreditation"]
  ip_address: "203.0.113.42"
  device_fingerprint: "abc123..."
  biometric_verified: true
  revocable: true
  retention_days: 2555 # 7 years
```

---

## Success Metrics

### Primary KPIs

| Metric                   | Target     | Description                            |
| ------------------------ | ---------- | -------------------------------------- |
| **Time to completion**   | < 48 hours | From first touch to wire sent          |
| **Completion rate**      | > 85%      | Started → Successfully completed       |
| **Investor touches**     | ≤ 3        | Number of active interactions required |
| **Document duplication** | 0%         | Only net-new info requested            |

### Quality KPIs

| Metric                 | Target  | Description                       |
| ---------------------- | ------- | --------------------------------- |
| **LP satisfaction**    | > 4.5/5 | Post-onboarding survey            |
| **Audit completeness** | 100%    | Every action logged               |
| **Compliance flags**   | < 5%    | Issues requiring human escalation |

### Business KPIs

| Metric                   | Target     | Timeline                  |
| ------------------------ | ---------- | ------------------------- |
| **LP referral rate**     | > 30%      | "Does this fund use Kai?" |
| **Repeat investor time** | < 24 hours | Second fund onboarding    |
| **Manager adoption**     | > 80%      | Managers preferring Kai   |

---

## Manager-Facing Experience

Kai also serves the **manager side** (often overlooked, very powerful):

### Manager Portal Features

| Feature                    | Description                            |
| -------------------------- | -------------------------------------- |
| **Pending requests**       | View outstanding verification requests |
| **One-click verification** | Confirm existing credentials apply     |
| **Bulk operations**        | Handle multiple LPs efficiently        |
| **Audit visibility**       | See consent grants and usage           |

### Manager Value Proposition

> "Kai makes your LPs' lives easier—and yours too."

- Fewer repetitive document requests
- Standardized communication
- Clear audit trail for compliance
- Professional interface (not email chaos)

---

## Security & Compliance

### Data Protection

| Layer                     | Implementation                 |
| ------------------------- | ------------------------------ |
| **Encryption at rest**    | AES-256-GCM                    |
| **Encryption in transit** | TLS 1.3                        |
| **Key management**        | Hardware Security Module (HSM) |
| **Access control**        | Role-based, consent-gated      |

### Consent Mechanics

- **Specific**: Each consent grant names exactly what is accessed
- **Revocable**: Investor can revoke at any time via portal
- **Scoped**: Time-limited, purpose-bound
- **Audited**: Every use logged with timestamp and accessor

### Regulatory Alignment

| Regulation    | Compliance Approach                       |
| ------------- | ----------------------------------------- |
| **SEC/FINRA** | Full audit trail, fiduciary documentation |
| **AML/KYC**   | Leverages existing verified credentials   |
| **CCPA/GDPR** | Consent-first, right to deletion          |
| **SOC2**      | In progress for platform certification    |

---

## Implementation Phases

### Phase 1: MVP (30 days)

- [ ] 7-second opening script
- [ ] Manager type selection
- [ ] Consent grant flow (UI + backend)
- [ ] Trust Graph data model
- [ ] Basic audit trail
- [ ] Manual manager coordination (email templates)

### Phase 2: A2A Integration (60 days)

- [ ] Machine-readable consent protocol
- [ ] Manager verification API
- [ ] Subscription doc generation
- [ ] Wire instruction templates
- [ ] Manager portal MVP

### Phase 3: Automation (90 days)

- [ ] Pattern learning (Trust Graph)
- [ ] Custodian-specific wiring
- [ ] Completion experience polish
- [ ] Post-onboarding relationship features

### Phase 4: Scale (6+ months)

- [ ] Multi-fund support
- [ ] Regulator-ready reporting
- [ ] LP self-service portal
- [ ] Third-party manager integrations

---

## Appendix: Sample Consent Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 Consent Request                                             │
│                                                                  │
│  Kai requests permission to coordinate with:                    │
│                                                                  │
│  ✅ ABC Family Office                                           │
│     • Verify your KYC status                                    │
│     • Confirm accreditation                                     │
│     • Request AML clearance                                     │
│                                                                  │
│  ❌ Kai will NOT:                                               │
│     • Execute any transactions                                  │
│     • Access your portfolio holdings                            │
│     • Share information with third parties                      │
│                                                                  │
│  This consent is:                                               │
│     • Specific to Fund A onboarding                             │
│     • Valid for 7 days                                          │
│     • Revocable at any time                                     │
│                                                                  │
│  [Deny]                         [Approve with FaceID 👆]        │
└─────────────────────────────────────────────────────────────────┘
```

---

_Kai by 🤫 — Onboarding that earns silence and signatures._
