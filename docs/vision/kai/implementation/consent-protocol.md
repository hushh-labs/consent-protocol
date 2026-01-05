# Agent Kai — Consent Protocol

> How Kai integrates with Hushh MCP consent infrastructure

---

## Core Principle

**Consent = MCP Communication**

Every data access in Kai flows through the existing Hushh consent system:

```
User → Consent Request → Token Issued → Agent Uses Token → Audit Logged
```

---

## Kai Consent Scopes

Add to `hushh_mcp/constants.py`:

```python
class ConsentScope(str, Enum):
    # ... existing scopes ...

    # ========== KAI SCOPES (V0) ==========

    # Read user vault data
    VAULT_READ_RISK_PROFILE = "vault.read.risk_profile"
    VAULT_READ_DECISION_HISTORY = "vault.read.decision_history"

    # Write to user vault
    VAULT_WRITE_RISK_PROFILE = "vault.write.risk_profile"
    VAULT_WRITE_DECISION = "vault.write.decision"

    # Kai agent operations
    AGENT_KAI_ANALYZE = "agent.kai.analyze"
    AGENT_KAI_DEBATE = "agent.kai.debate"

    # External data sources (Hybrid mode - per-request)
    EXTERNAL_SEC_FILINGS = "external.sec.filings"
    EXTERNAL_NEWS_API = "external.news.api"
    EXTERNAL_MARKET_DATA = "external.market.data"
```

---

## Consent Flow

### 1. Onboarding Consent (One-Time)

```
User opens Kai → Legal acknowledgment → Processing mode → Risk profile → Consent grant
```

**Scope requested**: `VAULT_WRITE_RISK_PROFILE` + `VAULT_WRITE_DECISION`

### 2. Analysis Consent (Per-Request in Hybrid Mode)

```
User asks "Analyze AAPL" → Kai requests external data consent → User approves → Data fetched
```

**Scopes requested**:

- `EXTERNAL_SEC_FILINGS` (for Fundamental Agent)
- `EXTERNAL_NEWS_API` (for Sentiment Agent)
- `EXTERNAL_MARKET_DATA` (for Valuation Agent)

### 3. Reading History (Implicit after onboarding)

```
User views past decisions → Kai reads from vault → Displayed
```

**Scope used**: `VAULT_READ_DECISION_HISTORY`

---

## Token Flow (Existing System)

```python
# 1. Issue token (when user approves)
from hushh_mcp.consent.token import issue_token

token = issue_token(
    user_id="user_123",
    agent_id="agent_kai",
    scope=ConsentScope.VAULT_WRITE_DECISION,
    expires_in_ms=7 * 24 * 60 * 60 * 1000  # 7 days
)

# 2. Validate token (before any operation)
from hushh_mcp.consent.token import validate_token

valid, error, token_obj = validate_token(token.token)
if not valid:
    raise PermissionError(error)

# 3. Proceed with operation...
```

---

## A2A Communication (TrustLinks)

When Kai orchestrator delegates to specialist agents:

```python
from hushh_mcp.trust.link import create_trust_link, verify_trust_link

# Kai Orchestrator → Fundamental Agent
trust_link = create_trust_link(
    from_agent="agent_kai_orchestrator",
    to_agent="agent_kai_fundamental",
    scope=ConsentScope.AGENT_KAI_ANALYZE,
    signed_by_user=user_id
)

# Fundamental Agent verifies before processing
if not verify_trust_link(trust_link):
    raise PermissionError("Invalid TrustLink")
```

---

## Audit Trail

All consent actions logged to `consent_audit` table:

| Action            | When                    |
| ----------------- | ----------------------- |
| `REQUESTED`       | Consent request created |
| `CONSENT_GRANTED` | User approved           |
| `CONSENT_DENIED`  | User denied             |
| `REVOKED`         | User revoked            |

Kai-specific actions also logged with `agent_id = "agent_kai"`.

---

## Implementation Checklist

- [ ] Add Kai scopes to `hushh_mcp/constants.py`
- [ ] Add `agent_kai` to `AGENT_PORTS`
- [ ] Create Kai consent request flow in frontend
- [ ] Implement token validation in Kai operons
