# Agent Kai — Implementation

> Technical implementation artifacts for Agent Kai

---

## Documents

| Document                                     | Purpose                   |
| -------------------------------------------- | ------------------------- |
| [database-schema.md](./database-schema.md)   | PostgreSQL tables for Kai |
| [consent-protocol.md](./consent-protocol.md) | MCP consent integration   |
| [onboarding-flow.md](./onboarding-flow.md)   | User onboarding journey   |

---

## Quick Reference

### New Tables

- `kai_sessions` — Onboarding state
- `kai_decisions` — Decision history (encrypted)

### New Consent Scopes

- `vault.read.risk_profile`
- `vault.read.decision_history`
- `vault.write.risk_profile`
- `vault.write.decision`
- `agent.kai.analyze`
- `agent.kai.debate`
- `external.sec.filings`
- `external.news.api`
- `external.market.data`

### API Endpoints

- `POST /api/kai/session/start`
- `GET /api/kai/session/:id`
- `PATCH /api/kai/session/:id/mode`
- `PATCH /api/kai/session/:id/risk`
- `POST /api/kai/session/:id/consent`
- `POST /api/kai/session/:id/complete`

---

## Files to Create/Modify

| Action | Path                                        |
| ------ | ------------------------------------------- |
| MODIFY | `consent-protocol/hushh_mcp/constants.py`   |
| MODIFY | `consent-protocol/db/migrate.py`            |
| NEW    | `consent-protocol/api/routes/kai.py`        |
| MODIFY | `consent-protocol/server.py`                |
| MODIFY | `hushh-webapp/app/dashboard/kai/actions.ts` |

---

_See main spec: [../README.md](../README.md)_
