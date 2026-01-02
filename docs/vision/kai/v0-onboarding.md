# Agent Kai — v0 Investor Onboarding

> Ship an onboarding flow that collects investor profile data and prepares users for Kai analysis.

---

## v0 Scope

### What v0 Does

- Collect user identity (via existing HushhAuth)
- Obtain legal acknowledgment (educational disclaimer + consent)
- Capture risk profile (Conservative / Balanced / Aggressive)
- Store investor profile (via A2A/Supabase)
- Hand off to Kai agents for analysis

### What v0 Does NOT Do

- Build agents (assume team has this)
- Portfolio integration
- Trade execution
- Fully on-device mode (hybrid only)

---

## Data to Collect

### Identity

- `user_id` — Firebase Auth
- `email` — Google Sign-In
- `created_at` — Timestamp

### Legal Consent

- `educational_disclaimer_accepted` — Required
- `data_processing_consent` — Required
- `terms_accepted_at` — Timestamp

### Risk Profile

- `risk_persona` — Conservative / Balanced / Aggressive
- `investment_experience` — Beginner / Intermediate / Advanced
- `investment_horizon` — Short / Medium / Long term

### Preferences

- `preferred_sectors` — Technology, Healthcare, etc.
- `processing_mode` — Hybrid (v0 default)

---

## Investor Profile Schema

```typescript
interface KaiInvestorProfile {
  user_id: string;
  email: string;

  educational_disclaimer_accepted: boolean;
  data_processing_consent: boolean;
  terms_accepted_at: string;

  risk_persona: "conservative" | "balanced" | "aggressive";
  investment_experience: "beginner" | "intermediate" | "advanced";
  investment_horizon: "short_term" | "medium" | "long_term";

  preferred_sectors: string[];
  processing_mode: "hybrid";

  created_at: string;
  onboarding_completed_at?: string;
}
```

---

## Integration

Uses existing infrastructure:

- **Auth**: HushhAuth plugin (Google Sign-In)
- **Storage**: A2A/Supabase endpoints
- **Consent**: HushhConsent plugin

---

## Questions for Team

1. Profile storage: Existing `profiles` table or new `kai_investor_profiles`?
2. Are the 3 specialist agents (Fundamental, Sentiment, Valuation) built?
3. Standard sector taxonomy?
