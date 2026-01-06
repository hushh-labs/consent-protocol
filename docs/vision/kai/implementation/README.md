# Agent Kai — Implementation

> **Status**: ✅ Phase 2.0 - Agent Nav Architecture Complete
> **Principle**: Agent Nav is the universal orchestrator. Consent IS MCP communication.

---

## 🏗️ Architecture Overview

### Agent Nav - Universal Orchestrator Framework

Agent Nav is not just a base class—it's the orchestration pattern for ALL Hushh agents:

```
┌─────────────────────────────────────────────────────────────┐
│                      AGENT NAV                               │
│            (Universal Orchestrator Framework)                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Abstract Base (agent_nav.py)                        │  │
│  │  - validate_consent()                                │  │
│  │  - issue_consent_token()                             │  │
│  │  - handle_with_consent()                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│          ┌────────────────┼────────────────┐                │
│          ▼                ▼                ▼                │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │   Food   │    │Professional│    │   Kai    │            │
│   │  Agent   │    │   Agent    │    │  Agent   │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│        │                │                │                   │
│        └────────────────┴────────────────┘                   │
│                         │                                     │
│                    Operons Layer                             │
│            (Business Logic, Consent-Validated)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Implemented Components

### Core Infrastructure

| Component             | File                                        | Description                                                |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| **Agent Nav Base**    | `hushh_mcp/agents/agent_nav.py`             | Universal orchestrator base class with consent enforcement |
| **Kai Agent**         | `hushh_mcp/agents/kai/agent.py`             | Main Kai orchestrator (extends Agent Nav)                  |
| **Fundamental Agent** | `hushh_mcp/agents/kai/fundamental_agent.py` | SEC filings & financial analysis                           |
| **Sentiment Agent**   | `hushh_mcp/agents/kai/sentiment_agent.py`   | News & social sentiment analysis                           |
| **Valuation Agent**   | `hushh_mcp/agents/kai/valuation_agent.py`   | Financial metrics & pricing                                |

### Operons (Business Logic)

| Operon File                  | Functions                                                        | Consent Required       |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `operons/kai/analysis.py`    | `analyze_fundamentals`, `analyze_sentiment`, `analyze_valuation` | `agent.kai.analyze`    |
| `operons/kai/fetchers.py`    | `fetch_sec_filings`, `fetch_market_news`, `fetch_market_data`    | Per-source scopes      |
| `operons/kai/storage.py`     | `store_decision_card`, `retrieve_decision_card`                  | `vault.write.decision` |
| `operons/kai/calculators.py` | Pure calculation functions (no consent needed)                   | None                   |

### API Routes

| Endpoint                        | Method | Description                    | Auth Required |
| ------------------------------- | ------ | ------------------------------ | ------------- |
| `/api/kai/session/start`        | POST   | Create onboarding session      | ✅            |
| `/api/kai/session/{id}`         | GET    | Get session state              | ✅            |
| `/api/kai/session/{id}`         | PATCH  | Update preferences             | ✅            |
| `/api/kai/session/{id}/consent` | POST   | Grant consent (returns tokens) | ✅            |
| `/api/kai/analyze/{session_id}` | POST   | Analyze stock (requires token) | ✅ + Token    |

### Frontend

| Component          | File                                  | Purpose                       |
| ------------------ | ------------------------------------- | ----------------------------- |
| **Agent Nav UI**   | `app/dashboard/agent-nav/page.tsx`    | Universal agent gateway       |
| **Kai Onboarding** | `app/dashboard/kai/page.tsx`          | Investor onboarding flow      |
| **Analysis Page**  | `app/dashboard/kai/analysis/page.tsx` | Stock analysis interface      |
| **Actions Layer**  | `app/dashboard/kai/actions.ts`        | API calls + token management  |
| **Navigation**     | `components/navigation.tsx`           | Agent Nav icon (vault-locked) |

---

## 🔑 Consent Scopes

### Vault Scopes

- `vault.read.risk_profile` - Read user's risk tolerance
- `vault.write.decision` - Store investment decisions
- `vault.read.decision_history` - Access past decisions

### Agent Scopes

- `agent.kai.analyze` - Perform stock analysis
- `agent.kai.debate` - Run multi-agent debate

### External Data Scopes (NEW)

- `external.sec.filings` - SEC EDGAR API access
- `external.news.api` - News data access
- `external.market.data` - Real-time market data
- `external.financial.data` - Financial statements API

---

## 💾 Database Schema

### kai_sessions

```sql
CREATE TABLE kai_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    processing_mode VARCHAR(20), -- 'on_device' | 'hybrid'
    risk_profile VARCHAR(20),    -- 'conservative' | 'balanced' | 'aggressive'
    legal_acknowledged BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### kai_decisions

```sql
CREATE TABLE kai_decisions (
    decision_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    ticker VARCHAR(10) NOT NULL,
    decision_type VARCHAR(10), -- 'buy' | 'hold' | 'reduce'
    decision_ciphertext TEXT NOT NULL,
    debate_ciphertext TEXT,
    iv VARCHAR(255),
    tag VARCHAR(255),
    algorithm VARCHAR(50),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### kai_data_cache (NEW)

```sql
CREATE TABLE kai_data_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Consent Token Flow

### 1. Onboarding → Grant Consent

```typescript
// Frontend: User completes onboarding
const { tokens } = await grantKaiConsent(sessionId, [
  "vault.read.risk_profile",
  "vault.write.decision",
  "agent.kai.analyze",
]);

// Tokens stored in sessionStorage
sessionStorage.setItem("kai_consent_tokens", JSON.stringify(tokens));
```

### 2. Analysis → Validate Token

```python
# Backend: Validate before analysis
@router.post("/api/kai/analyze/{session_id}")
async def analyze_stock(
    session_id: str,
    request: AnalyzeRequest,
    x_consent_token: str = Header(..., alias="X-Consent-Token")
):
    # Validate token
    valid, reason, parsed = validate_token(
        x_consent_token,
        ConsentScope.AGENT_KAI_ANALYZE
    )

    if not valid:
        raise HTTPException(403, f"Consent denied: {reason}")

    # Execute analysis with KaiAgent
    result = kai_agent.handle_with_consent(
        action="analyze",
        user_id=parsed.user_id,
        consent_token=x_consent_token,
        required_scope=ConsentScope.AGENT_KAI_ANALYZE,
        ticker=request.ticker
    )
```

### 3. Operons → Validate Again

```python
# Operon: Double validation for external data
async def fetch_sec_filings(ticker, user_id, consent_token):
    # Validate external data consent
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope.EXTERNAL_SEC_FILINGS
    )

    if not valid:
        raise PermissionError(f"SEC access denied: {reason}")

    # Fetch from SEC EDGAR API
    ...
```

---

## 📡 Real Data Integration

### SEC EDGAR API (Primary)

**Status**: 🔄 Ready for implementation

```python
# Free API, no key required
url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"
headers = {"User-Agent": "Hushh Agent Kai dev@hushh.ai"}

# Returns: 10-K, 10-Q filings with full metadata
```

### Financial Data APIs

| Provider                | Cost      | Rate Limit | Status     |
| ----------------------- | --------- | ---------- | ---------- |
| Alpha Vantage           | FREE tier | 25/day     | 📋 Planned |
| Financial Modeling Prep | FREE tier | 250/day    | 📋 Planned |
| yfinance                | FREE      | Unlimited  | 📋 Planned |

**See**: [Fundamental Agent Data Plan](../../../.gemini/antigravity/brain/.../fundamental_agent_data_plan.md)

---

## 🔮 Future: Attention Marketplace

### Placeholder Implementation

```python
# hushh_mcp/agents/kai/fundamental_agent.py
async def fetch_premium_data(
    ticker: str,
    data_source: str,
    consent_token: str,
    bid_amount: Optional[float] = None
):
    """
    [PLACEHOLDER] Fetch premium data via Attention Marketplace.

    v2+ Feature:
    - User bids for Bloomberg/Goldman reports
    - Transparent pricing (Alpha/Aloha scores)
    - Consent-based transactions
    """
    pass
```

**Reference**: `docs/vision/kai/preparation/attention-marketplace.md`

---

## ✅ Verification Checklist

- [x] Agent Nav base class created
- [x] KaiAgent extends Agent Nav
- [x] Consent tokens returned from backend
- [x] Tokens stored in sessionStorage
- [x] Analysis endpoint validates tokens
- [x] Agent Nav UI in navigation bar
- [x] Fundamental Agent with data plan
- [x] Database migrations complete
- [x] Documentation updated

---

## 📚 Key Documents

| Document                                                                              | Purpose                      |
| ------------------------------------------------------------------------------------- | ---------------------------- |
| [implementation_reference.md](./implementation_reference.md)                          | Detailed technical reference |
| [database-schema.md](./database-schema.md)                                            | Complete DB schema           |
| [consent-protocol.md](./consent-protocol.md)                                          | MCP integration guide        |
| [onboarding-flow.md](./onboarding-flow.md)                                            | User journey                 |
| [fundamental_agent_data_plan.md](../../../.gemini/.../fundamental_agent_data_plan.md) | Real data integration plan   |

---

**Last Updated**: 2026-01-05
**Status**: ✅ Phase 2.0 Complete - Agent Nav Architecture
**Next**: Real data integration (SEC EDGAR + Financial APIs)
