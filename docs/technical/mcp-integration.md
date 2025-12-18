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

| Tool                       | Scope Required            | Description                                  |
| -------------------------- | ------------------------- | -------------------------------------------- |
| `request_consent`          | Any                       | Request user permission for data access      |
| `check_consent_status`     | Any                       | Poll for consent approval status             |
| `get_food_preferences`     | `vault.read.food`         | Get food/dining preferences (requires token) |
| `get_professional_profile` | `vault.read.professional` | Get career data (requires token)             |
| `delegate_to_agent`        | Any                       | Create TrustLink for A2A delegation          |
| `list_scopes`              | None                      | List available consent scopes                |

---

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
