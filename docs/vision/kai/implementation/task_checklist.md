# Agent Kai V0 — Implementation Task Checklist

## Phase 1: Backend Foundation ✅

### MCP Consent Scopes

- [x] Add Kai vault scopes to `hushh_mcp/constants.py`
- [x] Add Kai agent scopes to `hushh_mcp/constants.py`
- [x] Add external data scopes to `hushh_mcp/constants.py`
- [x] Add `agent_kai` to `AGENT_PORTS`

### Database Migrations

- [x] Create `kai_sessions` table creator in `db/migrate.py`
- [x] Create `kai_decisions` table creator in `db/migrate.py`
- [x] Add to `TABLE_CREATORS` registry
- [x] Run migrations on Cloud SQL (Verified tables exist)

### API Routes

- [x] Create `api/routes/kai.py` with 5 endpoints
- [x] Register router in `server.py`

### Security Fix

- [x] Remove hardcoded credentials from `db/connection.py`
- [x] Remove hardcoded credentials from `db/migrate.py`
- [x] Add `DATABASE_URL` placeholder to `.env`
- [x] Verify no credential leaks in codebase

---

## Phase 2: Frontend Integration ✅

### Onboarding UI

- [x] Luxurious onboarding in `app/dashboard/kai/page.tsx`
- [x] Framer-motion animations
- [x] Glassmorphism styling
- [x] MCP consent badge
- [x] Redirect to analysis dashboard after completion

### Post-Onboarding Dashboard

- [x] Create `app/dashboard/kai/analysis/page.tsx`
- [x] Analysis input with search
- [x] Recent decisions display
- [x] Session status (mode, profile, MCP badge)
- [x] Quick actions grid

### Service Layer

- [x] Create `lib/services/kai-service.ts`
- [x] Update consent scopes in `app/dashboard/kai/actions.ts`

---

## Phase 3: Verification ✅

### Backend Testing

- [x] Start Cloud SQL Proxy (Project: `hushh-pda`)
- [x] Run migrations (`kai_sessions`, `kai_decisions` created)
- [x] Test API endpoints (Server running on port 8000)

### End-to-End

- [ ] Test complete onboarding flow (Ready for User)
- [ ] Verify transition to analysis dashboard (Ready for User)
- [ ] Test analysis input (Ready for User)

---

## Files Created/Modified

| File                                  | Action    | Status |
| ------------------------------------- | --------- | ------ |
| `hushh_mcp/constants.py`              | Modified  | ✅     |
| `db/migrate.py`                       | Modified  | ✅     |
| `db/connection.py`                    | Modified  | ✅     |
| `api/routes/kai.py`                   | Created   | ✅     |
| `server.py`                           | Modified  | ✅     |
| `.env`                                | Modified  | ✅     |
| `app/dashboard/kai/page.tsx`          | Rewritten | ✅     |
| `app/dashboard/kai/analysis/page.tsx` | Created   | ✅     |
| `app/dashboard/kai/actions.ts`        | Modified  | ✅     |
| `lib/services/kai-service.ts`         | Created   | ✅     |
