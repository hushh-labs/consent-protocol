# Personal Agent Kai by Hushh Technologies — v0

> AI investor concierge that collapses weeks of onboarding friction into minutes.

---

## Kai Has Two Modes

| Mode                    | Purpose                                     | README.md | v0 Focus     |
| ----------------------- | ------------------------------------------- | --------- | ------------ |
| **Investor Onboarding** | Onboard LPs into funds via trusted managers | New       | ✅ Ship this |
| **Investment Analysis** | Analyze stocks with 3 specialist agents     | Existing  | Later        |

---

## v0: Investor Onboarding

### The 7-Second Opening

```
"I'm Kai.
I coordinate onboarding through the people you already trust—
so you don't spend time on paperwork."
```

### What the Investor Does (Only 3 Things)

1. Verifies identity once
2. Declares who manages their capital
3. Grants explicit consent

Kai handles the rest through their trusted manager.

---

## v0 Flow (60 seconds)

| Time | What Happens                                                |
| ---- | ----------------------------------------------------------- |
| 0:07 | Kai introduces itself                                       |
| 0:15 | "Who currently manages capital on your behalf?"             |
| 0:20 | Investor selects: Family Office / RIA / Private Bank / Self |
| 0:30 | Consent screen: "May I coordinate with them?"               |
| 0:50 | Investor grants consent                                     |
| 0:60 | "I'll take it from here."                                   |

---

## v0 Operons (3 only)

| Operon                    | What It Does                           |
| ------------------------- | -------------------------------------- |
| `create_investor_profile` | Store identity + trusted manager       |
| `request_manager_consent` | Ask investor to authorize coordination |
| `initiate_kyc_handoff`    | Begin KYC/AML through trusted manager  |

---

## Data Collected

### Identity

- `investor_id`
- `email`
- `identity_verified_at`

### Trust Graph

- `trusted_manager_type`: Family Office / RIA / Private Bank / Self
- `trusted_manager_name`
- `trusted_manager_contact`

### Consent

- `consent_granted_at`
- `consent_scope`

---

## Connection to Investment Analysis (Later)

After onboarding completes, investor can access Kai's **investment analysis mode** (from README.md):

- 3 specialist agents (Fundamental, Sentiment, Valuation)
- Debate process
- Decision Cards with Buy/Hold/Reduce
- Risk personas (Conservative/Balanced/Aggressive)

This is shipped after v0 onboarding works.

---

## Compliance

- Identity verified before any action
- Consent is specific, scoped, revocable
- All consents logged with timestamps
- Educational disclaimer on analysis outputs
