# Consent Protocol Implementation

> How the Hushh system implements consent-driven authentication and data access.

---

## 🎯 Overview

The consent protocol ensures that **every action on user data requires explicit, cryptographic permission**. This is implemented through a multi-layer security model.

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Authentication                          │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Firebase Auth     → Identity verification (who you are)│
│ Layer 2: Passphrase        → Knowledge verification (zero-know) │
│ Layer 3: Firebase ID Token → Backend validates identity         │
│ Layer 4: Session Token     → Signed proof of consent            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Session Token Flow

### 1. User Login (Firebase)

User authenticates via Google OAuth. Firebase issues an ID token.

```typescript
// Firebase handles OAuth
const result = await signInWithPopup(auth, googleProvider);
const idToken = await result.user.getIdToken();
```

### 2. Passphrase Verification (Frontend)

User enters passphrase to unlock vault. This is **zero-knowledge** - passphrase never sent to server.

```typescript
// app/login/page.tsx - handleUnlockPassphrase()
import { useVault } from "@/lib/vault/vault-context";

const { unlockVault } = useVault();
const vaultKeyHex = await unlockVaultWithPassphrase(
  passphrase,
  vaultData.encryptedVaultKey,
  vaultData.salt,
  vaultData.iv
);
// Store in memory only (not sessionStorage) - XSS protection
unlockVault(vaultKeyHex);
```

### 3. Session Token Issuance (Backend)

After passphrase succeeds, frontend requests session token with Firebase ID token:

```typescript
// Frontend sends both userId AND Firebase ID token
const idToken = await auth.currentUser.getIdToken();
const response = await fetch("/api/consent/session-token", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify({ userId }),
});
```

### 4. Backend Verification

Python backend verifies Firebase ID token before issuing session token:

```python
# consent-protocol/server.py
from firebase_admin import auth

# Verify Firebase ID token
decoded_token = auth.verify_id_token(id_token)
verified_uid = decoded_token["uid"]

# Ensure request userId matches verified token
if request.userId != verified_uid:
    raise HTTPException(status_code=403, detail="userId mismatch")

# Issue session token
token_obj = issue_token(
    user_id=request.userId,
    agent_id="orchestrator",
    scope=ConsentScope.VAULT_READ_ALL,
    expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
)
```

### 5. Session Storage

Frontend stores session token for dashboard use:

```typescript
// Vault key stored in memory via VaultContext (not sessionStorage)
// Session token stored in sessionStorage for dashboard use
sessionStorage.setItem("session_token", tokenData.sessionToken);
sessionStorage.setItem("session_token_expires", String(tokenData.expiresAt));
```

### 6. Logout

On logout, tokens are destroyed:

```typescript
// components/navbar.tsx - handleLogout()
await fetch("/api/consent/logout", {
  method: "POST",
  body: JSON.stringify({ userId }),
});
sessionStorage.clear();
await signOut(auth);
```

---

## 🗄️ Database Tables

### session_tokens

Tracks active session tokens:

```sql
CREATE TABLE session_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  scope TEXT DEFAULT 'session',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

### consent_audit

Logs all consent actions:

```sql
CREATE TABLE consent_audit (
  id SERIAL PRIMARY KEY,
  token_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT,
  revoked_at BIGINT,
  metadata JSONB,
  token_type VARCHAR(20) DEFAULT 'consent',
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

---

## 🔗 API Endpoints

| Endpoint                     | Method | Purpose                                          |
| ---------------------------- | ------ | ------------------------------------------------ |
| `/api/consent/session-token` | POST   | Issue session token (requires Firebase ID token) |
| `/api/consent/logout`        | POST   | Destroy all session tokens for user              |
| `/api/consent/history`       | GET    | Get paginated consent audit history              |

---

## 🎛️ UI Components

### ConsentStatusBar

Shows active session status in dashboard:

```tsx
// components/consent/status-bar.tsx
<Badge variant="default">
  <Shield className="h-3 w-3" />
  Session Active
</Badge>
<Badge variant="outline">
  <Clock className="h-3 w-3" />
  23h 45m remaining
</Badge>
```

---

## 🤖 MCP External Consent (Third-Party Agents)

When external AI agents (Claude Desktop, Cursor, etc.) request access to user data, a special **zero-knowledge export** flow is used.

### Architecture: Token-Embedded Export Key

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MCP CONSENT FLOW (ZERO-KNOWLEDGE)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MCP Agent                Dashboard                     Server              │
│   (Claude)                 (Browser)                   (FastAPI)             │
│      │                        │                           │                  │
│      │ 1. request_consent     │                           │                  │
│      │───────────────────────►│ Pending Request Stored    │                  │
│      │                        │                           │                  │
│      │                        │ 2. Toast: "Approve?"      │                  │
│      │                        │    ┌─────────────────┐    │                  │
│      │                        │    │ User Clicks     │    │                  │
│      │                        │    │  ✅ Approve     │    │                  │
│      │                        │    └─────────────────┘    │                  │
│      │                        │                           │                  │
│      │                        │ 3. Browser decrypts       │                  │
│      │                        │    with vault key         │                  │
│      │                        │                           │                  │
│      │                        │ 4. Generate export key    │                  │
│      │                        │    (random AES-256)       │                  │
│      │                        │                           │                  │
│      │                        │ 5. Re-encrypt with        │                  │
│      │                        │    export key             │                  │
│      │                        │                           │                  │
│      │                        │ 6. Send encrypted ───────►│ Store in        │
│      │                        │    + export key           │ _consent_exports │
│      │                        │                           │                  │
│      │ 7. Polling returns token                           │                  │
│      │◄──────────────────────────────────────────────────│                  │
│      │                                                    │                  │
│      │ 8. get_food_preferences(token)                     │                  │
│      │──────────────────────────────────────────────────►│ Return encrypted │
│      │                                                    │ export           │
│      │                                                    │                  │
│      │ 9. MCP decrypts with export key                    │                  │
│      │                                                    │                  │
│      │ 10. Return plaintext to user ✅                    │                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Security Properties

| Property                  | Implementation                                            |
| ------------------------- | --------------------------------------------------------- |
| **Server Zero-Knowledge** | Server stores only encrypted export, never sees plaintext |
| **Export Key Isolation**  | Random per-consent, embedded in token for MCP decryption  |
| **Time-Limited**          | Export expires with consent token (24h default)           |
| **Scope-Limited**         | Only consented data domain is exported                    |
| **Audit Trail**           | All exports logged with access count                      |

### Code: Frontend Export Encryption

```typescript
// lib/vault/export-encrypt.ts
export async function encryptForExport(
  plaintext: string,
  exportKeyHex: string
): Promise<{ ciphertext: string; iv: string; tag: string }> {
  const keyBytes = new Uint8Array(
    exportKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  // Split ciphertext and tag...
}
```

### Code: MCP Decryption

```python
# mcp_server.py - handle_get_food()
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Fetch encrypted export from FastAPI
export_response = await client.get(f"{FASTAPI_URL}/api/consent/data", params={"consent_token": consent_token})

# Decrypt with export key
key_bytes = bytes.fromhex(export_key_hex)
aesgcm = AESGCM(key_bytes)
plaintext = aesgcm.decrypt(iv_bytes, combined, None)
food_data = json.loads(plaintext.decode('utf-8'))
```

---

## 🛡️ Security Guarantees

1. **No passphrase on server** - Zero-knowledge design
2. **Firebase ID token verification** - Backend validates identity
3. **Token binding** - userId in request must match verified token UID
4. **Session expiry** - Tokens expire after 24 hours
5. **Logout destroys tokens** - No lingering access
6. **Audit trail** - All actions logged to consent_audit table
7. **Export zero-knowledge** - MCP access never exposes plaintext to server
