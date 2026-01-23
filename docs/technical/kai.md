# Agent Kai: Deep Fundamental Analysis

> Comprehensive auditing and visualization of corporate fundamentals.
> Updated: January 2026.

---

## 🎯 Overview

Agent Kai transforms from a basic data fetcher into a **Senior Quant Analyst**. It performs deep-dive audits on companies using SEC filings, market data, and qualitative analysis, presenting findings in a "Premium Institutional Terminal" interface.

## 📊 Key Features

### 1. Context-Aware Personalization (NEW)

Kai now integrates with the **Hushh Investor Profile**.

- **Local Decryption**: The frontend decrypts the user's risk tolerance, investment style, and existing holdings locally.
- **Injected Context**: This context is passed to the analysis engine, allowing for personalized "Bull/Bear" cases. (e.g., "Given your Conservative profile, this high Beta stock poses a resilience risk.")

### 2. Streaming Debate Visualization (Updated)

Real-time SSE streaming of the multi-agent debate process:

- **Unified UI**: Entire experience consolidated into `KaiDebateInline`, removing redundant page elements.
- **Dynamic Loader**: Agent cards display real-time status messages ("Analyzing SEC filings...") received from the backend via `agent_start` events.
- **Token Streaming**: True async token streaming from Gemini 3 Flash via `stream_gemini_response`.

### 3. Consolidated Result View

No more context switching. The final decision is embedded directly within the debate interface:

- **KPI Ribbon**: Key metrics (Revenue CAGR, R&D Intensity) displayed in the "Decision" tab.
- **Interactive Charts**: `KaiFinancialCharts` component renders Revenue Trends, Net Income, and Radar charts.
- **Deep Dive Insights**: Business Moat, Growth, and Capital Allocation audits preserved and displayed alongside the verdict.

---

## 🏗️ Architecture

### Modular Route Structure

Kai API routes are organized in a modular package (`api/routes/kai/`):

```
api/routes/kai/
├── __init__.py       # Router aggregation
├── health.py         # /api/kai/health
├── consent.py        # /api/kai/consent/grant
├── analyze.py        # /api/kai/analyze (Legacy/blocking)
├── stream.py         # /api/kai/analyze/stream (SSE Streaming)
├── decisions.py      # /api/kai/decision/* CRUD
└── preferences.py    # /api/kai/preferences/*
```

### Streaming Pipeline (`stream.py`)

1. **Initialization**: Validates `vaultOwnerToken` and decrypts user context.
2. **Kai Thinking**: Emits `kai_thinking` events to show orchestration logic.
3. **Parallel Analysis**:
   - **Frontend**: `KaiDebateInline` listens to SSE endpoint.
   - **Backend**: `generate_content_async(stream=True)` yields tokens to `stream_agent_thinking`.
   - **Visualization**: Tokens appear in real-time in the Agent Card; status messages update instantly.
4. **Debate Rounds**: Agents exchange `debate_round` events.
5. **Consensus**: Final `decision` event triggers the Result View.

### Frontend Components (`components/kai/`)

- **`KaiDebateInline.tsx`**: The core orchestrator component. Handles SSE connection, state management (Round 1/2/Final), and renders the unified UI.
- **`KaiFinancialCharts.tsx`**: Reusable Recharts wrapper for all financial visualizations.
- **`AgentCard`**: Displays streaming tokens, status messages, and final agent verdicts.

---

## 🔐 Consent & Security

Kai strictly adheres to the **Hushh Consent Protocol** with enhanced token-based compliance:

### Token-Based Access Control

- **VAULT_OWNER Token**: All user data reads require VAULT_OWNER token
  - Investor profile access: `getEncryptedProfile(vaultOwnerToken)`
  - Kai preferences access: Via VaultContext with token validation
  - Analysis history: Stored with token reference

- **Agent-Scoped Token**: Analysis operations use scoped tokens
  - Scope: `agent.kai.analyze`
  - Duration: 7 days (renewable)
  - Validated on every `/api/kai/analyze` request

- **Zero-Knowledge**: Personal holdings and profiles are only ever decrypted in the client's memory
- **Audit Trail**: Every analysis logged to `consent_audit` table with token reference

### Regulatory Compliance (SEC/FINRA)

#### Audit Trail for SEC Requirements

| SEC Requirement    | Hushh Implementation                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recordkeeping**  | Every Kai analysis logged to `consent_audit` with:<br/>- user_id<br/>- timestamp<br/>- ticker analyzed<br/>- VAULT_OWNER token used<br/>- decision card generated |
| **User Consent**   | Explicit token-based consent for each analysis operation                                                                                                          |
| **Fiduciary Duty** | Token system provides cryptographic proof of authorization                                                                                                        |
| **Audit Access**   | `consent_audit` table exportable for regulatory review                                                                                                            |
| **Retention**      | 2-year retention (SEC Rule 17a-4 compliance)                                                                                                                      |

#### VAULT_OWNER Token as Proof of Consent

Traditional robo-advisors use **implied consent** (user agreement buried in TOS).

**Hushh Kai uses cryptographic consent:**

```typescript
// Frontend: app/dashboard/kai/analysis/page.tsx
if (!vaultOwnerToken) {
  toast.error("Session expired. Please unlock vault again.");
  return; // Hard stop - no analysis without token
}

// Every analysis requires fresh token validation
const analysis = await analyzeFundamental({
  user_id: user.uid,
  ticker: targetTicker,
  token: vaultOwnerToken, // Cryptographic proof
  // ...
});
```

**Backend validation:**

```python
# consent-protocol/api/routes/kai.py
@router.post("/analyze")
async def analyze_ticker(request: AnalyzeRequest):
    # Validate VAULT_OWNER token before analysis
    token = request.token
    validate_vault_owner_token(token, request.user_id)

    # Log to audit trail
    await consent_db.insert_event(
        action="ANALYSIS_REQUESTED",
        user_id=request.user_id,
        token_id=token,
        metadata={"ticker": request.ticker}
    )

    # Perform analysis
    # ...
```

**Audit Trail Export for Regulators:**

```sql
-- Generate complete Kai usage report
SELECT
    timestamp,
    action,
    metadata->>'ticker' as ticker_analyzed,
    metadata->>'decision' as recommendation,
    token_id
FROM consent_audit
WHERE user_id = 'user123'
  AND agent_id = 'agent_kai'
ORDER BY timestamp DESC;
```

This provides:

- ✅ **Proof of consent** for each analysis
- ✅ **Complete audit trail** with timestamps
- ✅ **Token-based authorization** (not implied)
- ✅ **Regulatory export capability**
- ✅ **User Privacy**: Zero-Knowledge Proofs for profile data

#### Comparison: Kai vs Traditional Robo-Advisors

| Aspect                     | Traditional Robo-Advisor            | Agent Kai                           |
| -------------------------- | ----------------------------------- | ----------------------------------- |
| **Consent Mechanism**      | Implied (TOS checkbox)              | Cryptographic tokens                |
| **Audit Trail**            | Internal logs (not user-accessible) | `consent_audit` table (exportable)  |
| **Access Control**         | Session-based (stateful)            | Token-based (stateless, verifiable) |
| **Regulatory Review**      | Request logs from company           | User exports own audit trail        |
| **Proof of Authorization** | "User agreed to TOS"                | Cryptographic token signature       |

---

## 🚀 Usage

### Running Analysis

1. Navigate to `/dashboard/kai/analysis`.
2. Enter a ticker (e.g., "AAPL", "NVDA").
3. Click "ANALYZE".
4. Watch the real-time **Streaming Debate**.
5. View the final **Deep Fundamental Report** in the unified interface.

### Key Metrics Explained

- **Earnings Quality Ratio**: `OCF / Net Income`. >1.0 indicates high quality earnings backed by cash. <1.0 suggests accounting maneuvering.
- **Innovation Efficiency**: Revenue growth relative to R&D spend.

---

## 🔒 Deployment

- **Backend Service**: `consent-protocol` on Cloud Run.
- **Data Sources**: SEC EDGAR (primary), yfinance (market data).
