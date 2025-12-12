# Test Files

This directory contains test scripts for the iWebTechno application.

## Quick Commands

```bash
# Full demo flow (database + email + cleanup)
npx tsx tests/test-demo-flow.ts

# Database only (connection + CRUD + cleanup)
npx tsx tests/test-db-only.ts

# Email only (SMTP + both email types)
npx tsx tests/test-email-only.ts

# Email to specific recipient
npx tsx tests/test-email-only.ts someone@example.com
```

## Test Files

### Main Test Scripts

| Script               | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `test-demo-flow.ts`  | **Full flow** - Simulates complete demo form submission (DB + emails + cleanup) |
| `test-db-only.ts`    | **Database only** - Tests connection, AdminEmails query, FormSubmission CRUD    |
| `test-email-only.ts` | **Email only** - Tests SMTP and sends both welcome + admin emails               |

### Reusable Modules (`lib/`)

| Module          | Exports                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `lib/config.ts` | `TEST_EMAIL`, `TEST_FORM_DATA`, `formatProducts()`                                 |
| `lib/db.ts`     | `createPrismaClient()`, `createTestSubmission()`, `cleanupTestSubmissions()`, etc. |
| `lib/email.ts`  | `createTransporter()`, `sendWelcomeEmail()`, `sendAdminNotification()`, etc.       |

## Test Email Identification

All test emails include a footer:

```
[TEST EMAIL] This is a test from the automated test script.
```

This footer **only appears in test scripts**, not in production emails.

## Cleanup

All test scripts automatically clean up test data:

- `test-demo-flow.ts` - Deletes test FormSubmission after test
- `test-db-only.ts` - Deletes test FormSubmission after test

## Environment Variables Required

Required in `.env`:

```
DATABASE_URL=sqlserver://...
EMAIL_SENDER=yo@genzdealz.ai
EMAIL_PASSWORD=xxx
SMTP_SERVER=smtpout.secureserver.net
SMTP_PORT=465
```

## Legacy Files (kept for reference)

- `test-api.js` - API endpoint testing
- `check-db.js` - Database health check utility
