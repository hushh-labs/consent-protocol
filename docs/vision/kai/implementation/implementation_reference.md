# Agent Kai V2.0 — Implementation Reference

> **Status**: ✅ Phase 2.0 Complete - Agent Nav Architecture
> **Principle**: Agent Nav = Universal Orchestrator. Consent enforced at every layer.

---

## 1. Architecture Evolution

### From Operons to Agent Nav

**Phase 1.0** (Completed):

- ✅ Operons pattern (modular, consent-validated functions)
- ✅ Specialist agents (Fundamental, Sentiment, Valuation)
- ✅ Debate engine (round-robin orchestration)

**Phase 2.0** (Current):

- ✅ **Agent Nav base class** - Universal orchestrator
- ✅ **Consent token management** - Frontend stores/passes tokens
- ✅ **KaiAgent extends Agent Nav** - Inherits consent enforcement
- ✅ **Real data integration plan** - SEC EDGAR + Financial APIs

---

## 2. Core Components

### Agent Nav Framework

**File**: `consent-protocol/hushh_mcp/agents/agent_nav.py`

```python
class AgentNav(ABC):
    """Universal orchestrator base for all agents."""

    def validate_consent(self, consent_token, required_scope, user_id):
        """Validate consent before action."""

    def issue_consent_token(self, user_id, scope):
        """Issue new consent token."""

    def handle_with_consent(self, action, user_id, consent_token, required_scope, **kwargs):
        """Execute action with consent validation."""
        # 1. Validate consent
        self.validate_consent(consent_token, required_scope, user_id)
        # 2. Execute action
        return self._handle_action(action, user_id, consent_token, **kwargs)

    @abstractmethod
    def _get_manifest(self) -> AgentManifest:
        """Define agent metadata."""

    @abstractmethod
    def _handle_action(self, action, user_id, consent_token, **kwargs):
        """Agent-specific logic."""
```

**Benefits**:

- ~200 lines of reusable infrastructure
- Consistent consent enforcement across all agents
- Eliminates duplicate code (Food, Professional, Kai)

---

## 3. Kai Agent Implementation

### KaiAgent (Orchestrator)

**File**: `consent-protocol/hushh_mcp/agents/kai/agent.py`

```python
class KaiAgent(AgentNav):
    """Main Kai orchestrator extending Agent Nav."""

    def _get_manifest(self):
        return AgentManifest(
            agent_id="agent_kai",
            name="Kai Investment Analyst",
            required_scopes=[
                ConsentScope.VAULT_READ_RISK_PROFILE,
                ConsentScope.VAULT_WRITE_DECISION,
                ConsentScope.AGENT_KAI_ANALYZE,
            ]
        )

    def _handle_action(self, action, user_id, consent_token, **kwargs):
        if action == "analyze":
            return self._analyze_stock(...)
        elif action == "get_history":
            return self._get_decision_history(...)

    def _analyze_stock(self, user_id, consent_token, ticker, session_id):
        # Orchestrate 3 specialist agents
        fundamental = analyze_fundamentals(ticker, user_id, ...)
        sentiment = analyze_sentiment(ticker, user_id, ...)
        valuation = analyze_valuation(ticker, user_id, ...)

        # Aggregate decision
        return self._aggregate_decision(fundamental, sentiment, valuation)
```

### Specialist Agents

**Lightweight Orchestrators** that compose operons:

| Agent           | File                   | Operons Used                                | Output             |
| --------------- | ---------------------- | ------------------------------------------- | ------------------ |
| **Fundamental** | `fundamental_agent.py` | `fetch_sec_filings`, `analyze_fundamentals` | Financial insights |
| **Sentiment**   | `sentiment_agent.py`   | `fetch_market_news`, `analyze_sentiment`    | Sentiment score    |
| **Valuation**   | `valuation_agent.py`   | `fetch_market_data`, `analyze_valuation`    | Pricing metrics    |

---

## 4. Operons Layer

### Analysis Operons

**File**: `consent-protocol/hushh_mcp/operons/kai/analysis.py`

```python
def analyze_fundamentals(ticker, user_id, sec_filings, consent_token):
    """Analyze company fundamentals with consent validation."""
    # Validate consent
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope.AGENT_KAI_ANALYZE
    )

    if not valid:
        raise PermissionError(f"Analysis denied: {reason}")

    # Calculate metrics
    metrics = {
        "revenue_growth_yoy": _calc_revenue_growth(sec_filings),
        "profit_margin": _calc_profit_margin(sec_filings),
        "debt_to_equity": _calc_debt_ratio(sec_filings),
    }

    # Generate insights
    return {
        "summary": f"Analysis of {ticker}...",
        "key_metrics": metrics,
        "strengths": [...],
        "weaknesses": [...],
        "recommendation": "buy" | "hold" | "reduce"
    }
```

### Fetcher Operons

**File**: `consent-protocol/hushh_mcp/operons/kai/fetchers.py`

```python
async def fetch_sec_filings(ticker, user_id, consent_token):
    """Fetch SEC filings with per-source consent."""
    # Validate external data consent
    valid, reason, token = validate_token(
        consent_token,
        ConsentScope.EXTERNAL_SEC_FILINGS
    )

    if not valid:
        raise PermissionError(f"SEC access denied: {reason}")

    # Fetch from SEC EDGAR
    cik = await get_cik_from_ticker(ticker)
    url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers={
            "User-Agent": "Hushh Agent Kai dev@hushh.ai"
        })
        return response.json()
```

**Status**:

- ✅ `fetch_sec_filings`: Ready for implementation (FREE SEC EDGAR API)
- 📋 `fetch_market_news`: Planned (NewsAPI or RSS)
- 📋 `fetch_market_data`: Planned (yfinance or Alpha Vantage)

---

## 5. API Routes

### Backend (FastAPI)

**File**: `consent-protocol/api/routes/kai.py`

#### Grant Consent (Returns Tokens)

```python
@router.post("/api/kai/session/{session_id}/consent")
async def grant_consent(session_id: str, request: GrantConsentRequest):
    """Issue consent tokens and return to frontend."""

    tokens = {}
    for scope_str in request.scopes:
        scope = ConsentScope(scope_str)
        token_obj = kai_agent.issue_consent_token(user_id, scope)
        tokens[scope_str] = token_obj.token

    # ✅ Return tokens (was missing in v1.0)
    return {
        "success": True,
        "tokens": tokens,  # Frontend stores these
        "expires_at": token_obj.expires_at
    }
```

#### Analyze Stock (Validates Token)

```python
@router.post("/api/kai/analyze/{session_id}")
async def analyze_stock(
    session_id: str,
    request: AnalyzeRequest,
    x_consent_token: str = Header(..., alias="X-Consent-Token")
):
    """Analyze stock with consent enforcement."""

    # ✅ Validate token (new in v2.0)
    valid, reason, parsed = validate_token(
        x_consent_token,
        ConsentScope.AGENT_KAI_ANALYZE
    )

    if not valid:
        raise HTTPException(403, f"Consent denied: {reason}")

    # Execute via KaiAgent
    result = kai_agent.handle_with_consent(
        action="analyze",
        user_id=parsed.user_id,
        consent_token=x_consent_token,
        required_scope=ConsentScope.AGENT_KAI_ANALYZE,
        ticker=request.ticker,
        session_id=session_id
    )

    return result
```

---

## 6. Frontend Implementation

### Token Management

**File**: `hushh-webapp/app/dashboard/kai/actions.ts`

```typescript
// Store tokens from backend
export async function grantKaiConsent(
  sessionId: string,
  scopes: string[]
): Promise<TokensResponse> {
  const response = await fetch(`/api/kai/session/${sessionId}/consent`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, scopes }),
  });

  const data = await response.json();

  // ✅ Store in sessionStorage (secure, tab-isolated)
  const storageData = {
    tokens: data.tokens,
    expires_at: data.expires_at,
  };
  sessionStorage.setItem("kai_consent_tokens", JSON.stringify(storageData));

  return { tokens: data.tokens, expires_at: data.expires_at };
}

// Retrieve token for specific scope
export function getConsentToken(scope: string): string | null {
  const storageJson = sessionStorage.getItem("kai_consent_tokens");
  if (!storageJson) return null;

  const storageData = JSON.parse(storageJson);
  return storageData.tokens?.[scope] || null;
}

// Check if consent is valid
export function hasValidConsent(scope: string): boolean {
  const token = getConsentToken(scope);
  if (!token) return false;

  // Check expiry
  const storageData = JSON.parse(sessionStorage.getItem("kai_consent_tokens"));
  if (storageData.expires_at && Date.now() > storageData.expires_at) {
    return false;
  }

  return true;
}
```

### Analysis Page Integration

**File**: `hushh-webapp/app/dashboard/kai/analysis/page.tsx`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // ✅ Get consent token (new in v2.0)
  const analyzeToken = getConsentToken("agent.kai.analyze");

  if (!analyzeToken) {
    alert("Please complete onboarding first");
    router.push("/dashboard/kai");
    return;
  }

  // ✅ Send token in header
  const response = await fetch(`/api/kai/analyze/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Consent-Token": analyzeToken, // Required!
    },
    body: JSON.stringify({ ticker }),
  });

  if (response.status === 403) {
    alert("Consent expired. Please re-onboard.");
    return;
  }

  const result = await response.json();
  // Display analysis...
};
```

---

## 7. Agent Nav UI

### Navigation Integration

**File**: `hushh-webapp/components/navigation.tsx`

```typescript
export function Navigation() {
  const { user } = useAuth();
  const { isVaultUnlocked } = useVault();

  return (
    <nav>
      {/* Agent Nav - visible only when vault unlocked */}
      {user && isVaultUnlocked && (
        <Link href="/dashboard/agent-nav">
          <Button>
            <Search className="h-4 w-4" />
            <span>Agent Nav</span>
          </Button>
        </Link>
      )}
    </nav>
  );
}
```

### Agent Nav Landing Page

**File**: `hushh-webapp/app/dashboard/agent-nav/page.tsx`

Unified gateway to all agents:

- Search functionality
- Agent cards (Food, Professional, Kai)
- Explains Agent Nav philosophy

---

## 8. Data Integration Roadmap

### Phase 1: SEC EDGAR (Week 1-2)

- [ ] Implement `fetch_sec_filings` operon
- [ ] Add CIK lookup helper
- [ ] Implement 24-hour caching
- [ ] Test with AAPL, TSLA, NVDA

### Phase 2: Financial APIs (Week 3-4)

- [ ] Choose provider (Alpha Vantage or FMP)
- [ ] Add API key to `.env`
- [ ] Implement `fetch_financial_statements`
- [ ] Cache financial data (7-day expiry)

### Phase 3: Analysis Integration (Week 5-6)

- [ ] Update `analyze_fundamentals` with real data
- [ ] Calculate real financial ratios
- [ ] Generate insights from actual metrics
- [ ] Add source citations

**See**: `fundamental_agent_data_plan.md` for complete implementation guide

---

## 9. Database Schema

### Existing Tables

- ✅ `kai_sessions` - Onboarding state
- ✅ `kai_decisions` - Encrypted decision history
- ✅ `consent_audit` - Token validation logs

### New Tables (v2.0)

```sql
-- Data caching for API responses
CREATE TABLE kai_data_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kai_cache_ticker ON kai_data_cache(ticker);
CREATE INDEX idx_kai_cache_expires ON kai_data_cache(expires_at);
```

---

## 10. Consent Scopes Complete List

### Vault Scopes

- `vault.read.risk_profile`
- `vault.read.decision_history`
- `vault.write.decision`
- `vault.write.risk_profile`

### Agent Scopes

- `agent.kai.analyze`
- `agent.kai.debate`

### External Data Scopes (NEW in v2.0)

- `external.sec.filings` - SEC EDGAR API
- `external.financial.data` - Financial statements
- `external.news.api` - News/sentiment data
- `external.market.data` - Real-time prices

---

## 11. Verification

### Phase 2.0 Checklist

- [x] Agent Nav base class created (`agent_nav.py`)
- [x] KaiAgent extends Agent Nav
- [x] Fundamental Agent refactored
- [x] Backend returns consent tokens
- [x] Frontend stores tokens in sessionStorage
- [x] Analysis endpoint validates tokens
- [x] Agent Nav UI in navigation
- [x] Data integration plan documented
- [x] Attention Marketplace placeholder added

### Testing Flow

1. ✅ Login → Vault unlocks → Agent Nav visible
2. ✅ Navigate to Kai onboarding
3. ✅ Complete onboarding → Grant consent
4. ✅ Backend issues tokens → Frontend stores
5. ✅ Navigate to analysis page
6. ⏳ Enter ticker → Send with token header
7. ⏳ Backend validates token → Calls KaiAgent
8. ⏳ KaiAgent orchestrates 3 specialists
9. ⏳ Display results

---

## 12. Future Enhancements

### Attention Marketplace (v3.0)

```python
# Premium data bidding
async def fetch_premium_data(ticker, data_source, bid_amount):
    """
    Fetch premium analyst reports via Attention Marketplace.

    User presented with bid options:
    - Goldman Sachs Report: $15 (Alpha: 95)
    - Morgan Stanley: $12 (Alpha: 90)
    - Free: Seeking Alpha (Alpha: 70)
    """
    pass
```

**Reference**: `docs/vision/kai/preparation/attention-marketplace.md`

---

## 13. Key Takeaways

1. **Agent Nav = Universal Pattern** - All agents inherit consent enforcement
2. **Tokens Flow End-to-End** - Backend issues → Frontend stores → Analysis validates
3. **Operons Stay Pure** - Business logic with built-in consent checks
4. **Real Data Ready** - Infrastructure prepared for SEC EDGAR + APIs
5. **Capacitor Compatible** - sessionStorage works in mobile WebView

---

**Last Updated**: 2026-01-05
**Version**: 2.0
**Status**: ✅ Complete - Ready for real data integration
