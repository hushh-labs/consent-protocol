# MCP Integration Architecture

> How external AI agents (Claude Desktop, Cursor) access Hushh vault data with zero-knowledge compliance.

---

## 🎯 Overview

The MCP (Model Context Protocol) server exposes Hushh vault data to AI agents like Claude Desktop while maintaining **zero-knowledge principles** — the server never sees plaintext data.

---

## 🔐 Zero-Knowledge Export Flow

When an MCP agent requests user data, the following flow occurs:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MCP CONSENT FLOW                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Claude Desktop              User Dashboard               FastAPI Server    │
│        │                           │                            │            │
│        │ 1. request_consent        │                            │            │
│        │───────────────────────────►                            │            │
│        │                           │ ◄──── Creates pending ─────│            │
│        │                           │       Shows toast          │            │
│        │                           │                            │            │
│        │                           │ 2. User clicks APPROVE     │            │
│        │                           │                            │            │
│        │                           │ 3. Browser decrypts        │            │
│        │                           │    with vault key          │            │
│        │                           │                            │            │
│        │                           │ 4. Generate export key     │            │
│        │                           │    (random 256-bit)        │            │
│        │                           │                            │            │
│        │                           │ 5. Re-encrypt with         │            │
│        │                           │    export key              │            │
│        │                           │                            │            │
│        │                           │ 6. Send encrypted ─────────► Store      │
│        │                           │    + export key            │  export    │
│        │                           │                            │            │
│        │ 7. Poll returns token + key ◄──────────────────────────│            │
│        │                                                        │            │
│        │ 8. get_food_preferences(token)                         │            │
│        │────────────────────────────────────────────────────────►            │
│        │                                                        │            │
│        │ 9. Return encrypted export ◄───────────────────────────│            │
│        │                                                        │            │
│        │ 10. MCP decrypts with export key                       │            │
│        │                                                        │            │
│        │ ✅ Claude shows REAL user data                         │            │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Security Properties

| Property                  | How It's Achieved                                                |
| ------------------------- | ---------------------------------------------------------------- |
| **Server Zero-Knowledge** | Server stores only AES-256-GCM encrypted export, never plaintext |
| **Ephemeral Export Keys** | Random 256-bit key generated per consent, not stored permanently |
| **Token Binding**         | Export can only be retrieved with the matching consent token     |
| **Time-Limited**          | Exports expire with the consent token (24h default)              |
| **Scope Isolation**       | Export contains only the consented data domain                   |
| **Dual Encryption**       | Vault data encrypted with user key → exported with export key    |

---

## 📁 Key Files

### Frontend (TypeScript)

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `lib/vault/export-encrypt.ts`                  | AES-256-GCM encryption/decryption utilities           |
| `app/dashboard/consents/page.tsx`              | `handleApprove` - generates export key, encrypts data |
| `components/consent/notification-provider.tsx` | Toast notification approval flow                      |

### Backend (Python)

| File                             | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `consent-protocol/server.py`     | `/api/consent/pending/approve` - stores encrypted export  |
| `consent-protocol/server.py`     | `/api/consent/data` - returns encrypted export for MCP    |
| `consent-protocol/mcp_server.py` | `handle_get_food` - decrypts export with key from FastAPI |

---

## 🔧 MCP Tools

| Tool                       | Scope Required                              | Description                                                              |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `request_consent`          | Any                                         | Request user permission for a scope (world_model.read, attr.{domain}.\*) |
| `validate_token`           | None                                        | Validate a consent token before using it with get\_\* or APIs            |
| `discover_user_domains`    | None                                        | Discover which domains a user has; returns scope strings (call first)    |
| `list_scopes`              | None                                        | List available consent scopes (static reference)                         |
| `check_consent_status`     | Any                                         | Poll pending consent until granted or denied                             |
| `get_food_preferences`     | `attr.food.*` or `world_model.read`         | Get food/dining preferences                                              |
| `get_professional_profile` | `attr.professional.*` or `world_model.read` | Get career/professional data                                             |
| `get_financial_profile`    | `attr.financial.*` or `world_model.read`    | Get investment/financial data (NEW)                                      |
| `delegate_to_agent`        | Any                                         | Create TrustLink for A2A delegation                                      |

Agents can read resource **`hushh://info/connector`** for full usage, tool list, recommended flow, and supported scopes.

### Recommended flow

1. **Discover** — `discover_user_domains(user_id)` to get domains and scope strings.
2. **Request** — `request_consent(user_id, scope)` for each scope needed.
3. **If pending** — Poll `check_consent_status(user_id, scope)` until granted or denied.
4. **Use** — Use the returned consent token with get\_\* tools or world-model data APIs.

---

## 🔄 MCP Polling Behavior

When `request_consent` returns `pending`, the MCP server blocks and polls for user action:

```
MCP calls request_consent → Returns "pending" (non-blocking)
     ↓
Claude/Agent asks user to approve in app/dashboard
     ↓
Agent calls check_consent_status(user_id, scope)
     ↓
MCP: 1. Check /api/consent/active (found? → SUCCESS)
     2. Check /api/consent/pending (found? → PENDING)
     3. Not found? → NOT_FOUND (suggest retry/request)
```

### Robust Retry Mechanism

The `request_consent` tool now includes a **5-retry backoff logic** after user approval is detected via SSE (Production). This ensures that sync delays between the consent grant and database propagation are handled gracefully, returning the token immediately when ready.

### Key Implementation Details

| Scenario     | MCP Response                              | Retry Allowed?                       |
| ------------ | ----------------------------------------- | ------------------------------------ |
| **Approved** | `status: "granted"` + token               | N/A - success                        |
| **Denied**   | `status: "denied"` + `DO_NOT_RETRY: true` | No (explicit refusal)                |
| **Timeout**  | `status: "timeout"`                       | Yes (user may not have seen request) |

### Denial Response

```json
{
  "status": "denied",
  "message": "❌ User denied the consent request.",
  "privacy_note": "User has the right to refuse data access.",
  "DO_NOT_RETRY": true,
  "instruction": "STOP - Do NOT call request_consent again for this scope."
}
```

> **Important Fix (Dec 2024):** The MCP now checks `/api/consent/active` to determine approval vs denial, rather than re-calling `/api/v1/request-consent`. This prevents duplicate pending requests when user denies.

## 🧪 Testing the Flow

1. **Start servers**

   ```bash
   # Terminal 1: FastAPI
   cd consent-protocol && uvicorn server:app --reload --port 8000

   # Terminal 2: Next.js
   cd hushh-webapp && npm run dev
   ```

2. **Restart Claude Desktop** (System tray → Quit → Reopen)

3. **Ask Claude**

   ```
   "Get my food preferences for kushaltrivedi1711@gmail.com"
   ```

4. **Approve in dashboard** when toast appears

5. **Claude receives real vault data** ✅

---

## 📊 Data Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Browser   │    │   Server    │    │   MCP       │
│   Vault     │    │  (decrypt)  │    │ (encrypted) │    │  (decrypt)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │ vault_key        │                  │                  │
       │► decrypt ────────►                  │                  │
       │                  │                  │                  │
       │                  │ export_key       │                  │
       │                  │── re-encrypt ───►│ ciphertext       │
       │                  │                  │                  │
       │                  │                  │ export_key       │
       │                  │                  │◄── request ──────│
       │                  │                  │                  │
       │                  │                  │── ciphertext ───►│
       │                  │                  │                  │
       │                  │                  │            decrypt with
       │                  │                  │            export_key
       │                  │                  │                  │
       │                  │                  │            PLAINTEXT ✅
```

---

## ✅ Compliance Checklist

- [x] **Consent First** - MCP cannot access data without approved token
- [x] **Zero-Knowledge Server** - FastAPI never sees decrypted vault data
- [x] **Scoped Access** - Each data domain requires separate consent
- [x] **Time-Limited** - Exports expire with consent token
- [x] **Audit Trail** - All consent grants logged
- [x] **Cryptographic Tokens** - HMAC-SHA256 signed consent tokens

---

## 📱 Native Bridge Architecture (Mobile)

The Capacitor plugin **`HushhMCP`** bridges the TypeScript frontend with the Native iOS/Android layer to enable local AI on-device.

### How It Works

1.  **Detection**: `ApiService` checks `Capacitor.isNativePlatform()`.
2.  **Bridge Call**: Frontend calls `HushhMCP.startServer()` (Kotlin/Swift).
3.  **Native Server**:
    - **Android**: Starts a hidden process exposing a JSON-RPC interface.
    - **iOS**: Integrates with `AppIntents` (future) or runs an in-process request handler.
4.  **Registration**: The app registers tool definitions with the OS during sensitive access attempts (e.g. "Ask Hushh").

### Code Reference

```typescript
// lib/capacitor/index.ts
export interface HushhMCPPlugin {
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
  handleToolCall(options: { json: string }): Promise<{ result: string }>;
}
```
