# Assumptions Audit

> **Purpose**: Single source of verified vs assumed values for the Hushh project. AI agents and contributors should verify against this doc before treating information as fact. Referenced by `.cursorrules`.

---

## Verified Information

| Item | Value | Notes |
|------|--------|------|
| **Contact email** | `eng@hush1one.com` | All contact emails (support, engineering, docs). |
| **Database** | Supabase REST API | Not Cloud SQL. Backend uses Supabase client; no raw Cloud SQL connection strings in app code. |
| **Branch format** | `/[username]/[type]/[type-name]` | Required. Example: `kushaltrivedi/feat/agent-kai-revamp`. |
| **Tri-flow** | Web proxy + iOS plugin + Android plugin | Data-access features require all three; no `fetch("/api/...")` in components. |
| **BYOK** | Vault key memory-only | Never in localStorage/sessionStorage; backend stores ciphertext only. |

---

## Common Assumptions to Flag

| Assumption | Guidance |
|------------|----------|
| **Email addresses** | Use `eng@hush1one.com` (not `@hushh.ai`) unless a different domain is explicitly specified. |
| **External URLs** | Prefer local documentation paths over external URLs (e.g. `docs/reference/...` instead of `docs.hushh.ai/...`). |
| **GCP project IDs** | Do not reference internal GCP project IDs (e.g. `hushh-pda`) in docs or examples; use placeholders like `YOUR_GCP_PROJECT`. |
| **Database** | Supabase REST API; do not assume Cloud SQL connection strings or direct SQL endpoints. |
| **Branch names** | Always use `/[username]/[type]/[type-name]`; never suggest branches starting with `feat/`, `fix/`, or `docs/` without the username prefix. |

---

## Before Using Information

1. Check if a value is a placeholder or example (e.g. `YOUR_API_KEY`, `test_user`).
2. Verify against this document when in doubt.
3. Flag uncertain assumptions with `<!-- ASSUMPTION: [description] -->` in code or docs.
4. Prefer local docs and route contracts over external API URLs.

---

## Last Updated

Audit created to satisfy rules-and-codebase review; update this section when assumptions or verified values change.
