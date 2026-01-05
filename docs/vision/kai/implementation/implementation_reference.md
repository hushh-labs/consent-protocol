# Agent Kai V0 — Implementation Reference

> **Status**: ✅ Phase 1.5 Complete - Operons Architecture Implemented
> **Principle**: Consent IS MCP communication. Every operon validates TrustLinks.

---

## 1. Implemented Components

### Backend - Operons Architecture (Hushh MCP Pattern)

| Component               | File                               | Description                                                                            |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| **Analysis Operons**    | `operons/kai/analysis.py`          | analyze_fundamentals, analyze_sentiment, analyze_valuation (with TrustLink validation) |
| **Calculator Operons**  | `operons/kai/calculators.py`       | Pure calculation functions (ratios, sentiment scoring)                                 |
| **Storage Operons**     | `operons/kai/storage.py`           | Encrypted decision storage with consent validation                                     |
| **Fetcher Operons**     | `operons/kai/fetchers.py`          | External data (SEC, News, Market) with per-source consent                              |
| **Specialist Agents**   | `agents/kai/*.py`                  | Lightweight orchestrators that compose operons                                         |
| **Debate Engine**       | `agents/kai/debate_engine.py`      | Round-robin orchestration with consensus building                                      |
| **Decision Generator**  | `agents/kai/decision_generator.py` | Decision card creation with compliance disclaimers                                     |
| **API Endpoints**       | `api/routes/kai.py`                | Session management + analyze endpoint                                                  |
| **Database Migrations** | `db/migrate.py`                    | kai_sessions + kai_decisions tables                                                    |
| **MCP Scopes**          | `hushh_mcp/constants.py`           | Vault + Agent + External scopes                                                        |

### Frontend (Hushh Webapp)

| Component              | File                                  | Description                        |
| ---------------------- | ------------------------------------- | ---------------------------------- |
| **Service Layer**      | `lib/services/kai-service.ts`         | API abstraction for Kai endpoints  |
| **Onboarding UI**      | `app/dashboard/kai/page.tsx`          | Glassmorphic onboarding flow       |
| **Analysis Dashboard** | `app/dashboard/kai/analysis/page.tsx` | Post-onboarding analysis interface |
| **Actions**            | `app/dashboard/kai/actions.ts`        | Type definitions and utilities     |

---

## 2. Operons Implementation (NEW)

**Pattern**: Every operon validates TrustLink BEFORE executing business logic.

### Analysis Operons (TrustLink: agent.kai.analyze)

- `analyze_fundamentals(ticker, user_id, sec_filings, consent_token)` → Fundamental insights
- `analyze_sentiment(ticker, user_id, news_articles, consent_token)` → Sentiment insights
- `analyze_valuation(ticker, user_id, market_data, peer_data, consent_token)` → Valuation insights

### Fetcher Operons (Per-Source TrustLinks)

- `fetch_sec_filings(ticker, user_id, consent_token)` → TrustLink: external.sec.filings
- `fetch_market_news(ticker, user_id, consent_token)` → TrustLink: external.news.api
- `fetch_market_data(ticker, user_id, consent_token)` → TrustLink: external.market.data
- `fetch_peer_data(ticker, user_id, consent_token)` → TrustLink: external.market.data

### Storage Operons (TrustLink: vault.write.decision, vault.read.decision_history)

- `store_decision_card(user_id, session_id, decision_card, vault_key_hex, consent_token)`
- `retrieve_decision_card(encrypted_payload, vault_key_hex, consent_token, user_id)`

### Calculator Operons (No TrustLink - Pure Functions)

- `calculate_financial_ratios(sec_filings)` → Financial metrics
- `calculate_sentiment_score(news_articles)` → Sentiment (-1 to +1)
- `calculate_valuation_metrics(market_data)` → P/E, P/B, DCF, etc.

---

## 3. API Routes Implemented

- `POST /api/kai/session/start` — Start onboarding
- `GET /api/kai/session/{id}` — Get session state
- `PATCH /api/kai/session/{id}` — Update prefs (Risk, Mode)
- `POST /api/kai/session/{id}/consent` — Grant MCP consent (Issues Token)
- `GET /api/kai/session/user/{userId}` — Resume session
- **`POST /api/kai/analyze`** — **NEW**: Trigger 3-agent analysis with vault_key_hex
- **`GET /api/kai/decisions/{userId}`** — **NEW**: Decision history metadata
- **`GET /api/kai/decision/{decisionId}`** — **NEW**: Full decision card (decrypted)
- **`DELETE /api/kai/decision/{decisionId}`** — **NEW**: Delete decision

---

## 4. Database Schema (PostgreSQL)

**kai_sessions**

- `session_id` (PK), `user_id` (FK to vault_keys)
- `processing_mode` (on_device | hybrid), `risk_profile` (conservative | balanced | aggressive)
- `legal_acknowledged`, `onboarding_complete`

**kai_decisions**

- `ticker`, `decision_type` (buy | hold | reduce)
- `decision_ciphertext`, `debate_ciphertext` (AES-256-GCM encrypted)
- `iv`, `tag`, `algorithm`, `confidence_score`
- Linked to `kai_sessions` and `vault_keys` (user_id)

---

## 5. Verification

1. **Operons**: ✅ 5 operon files created, following food agent pattern
2. **Agents**: ✅ Refactored to lightweight orchestrators (compose operons)
3. **Backend**: ✅ Analyze endpoint with vault_key_hex integration
4. **Frontend**: ✅ Onboarding complete, analysis dashboard exists
5. **Database**: ✅ Migrations successful via Cloud SQL Proxy
6. **Security**: ✅ No credential leaks, vault_key client-provided

---

## 6. Data Integration (Mock → Real)

**Current**: All operons use mock data
**Next**: External API integration

| Data Source | Operon            | Free API Option                 | Status  |
| ----------- | ----------------- | ------------------------------- | ------- |
| SEC Filings | fetch_sec_filings | SEC EDGAR (free, no key)        | 🔄 Mock |
| News        | fetch_market_news | NewsAPI free tier OR Google RSS | 🔄 Mock |
| Market Data | fetch_market_data | yfinance OR Alpha Vantage free  | 🔄 Mock |

---

## 7. Next Steps (Phase 2)

- [ ] **External Data Integration**: Replace mock data with real API calls
- [ ] **Frontend Enhancement**: Progressive disclosure UI with 3-agent progress
- [ ] **Mobile Testing**: iOS/Android Capacitor builds
- [ ] **On-Device AI**: MLX (iOS) or Gemma (Android) integration
