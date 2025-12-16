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
const vaultKeyHex = await unlockVaultWithPassphrase(
  passphrase,
  vaultData.encryptedVaultKey,
  vaultData.salt,
  vaultData.iv
);
sessionStorage.setItem("vault_key", vaultKeyHex);
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

## 🛡️ Security Guarantees

1. **No passphrase on server** - Zero-knowledge design
2. **Firebase ID token verification** - Backend validates identity
3. **Token binding** - userId in request must match verified token UID
4. **Session expiry** - Tokens expire after 24 hours
5. **Logout destroys tokens** - No lingering access
6. **Audit trail** - All actions logged to consent_audit table
