# Consent Protocol Implementation

> How the Hushh system implements consent-driven authentication and data access.

---

## 🎯 Overview

The consent protocol ensures that **every action on user data requires explicit, cryptographic permission**. This is implemented through a multi-layer security model with **NO authentication bypasses** - even vault owners use consent tokens.

### Consent-First Architecture

```
CORE PRINCIPLE: All data access requires a consent token.
                Vault owners are NOT special - they use VAULT_OWNER tokens.

Traditional     ❌  if (userOwnsVault) { allow(); }
Hushh Approach  ✅  if (validateToken(VAULT_OWNER)) { allow(); }
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Authentication                          │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Firebase Auth     → Identity verification (who you are)│
│ Layer 2: Passphrase        → Knowledge verification (zero-know) │
│ Layer 3: Firebase ID Token → Backend validates identity         │
│ Layer 4: VAULT_OWNER Token → Master consent token (NEW!)        │
│ Layer 5: Agent Tokens      → Scoped consent tokens              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🆕 VAULT_OWNER Token Architecture

### What is a VAULT_OWNER Token?

The **VAULT_OWNER token** is a special consent token with the `vault.owner` scope that grants vault owners full access to their own encrypted data.

**Key Properties:**

- **Scope**: `ConsentScope.VAULT_OWNER` (`"vault.owner"`)
- **Agent ID**: `"self"` (user is accessing their own data)
- **Expiry**: 24 hours (renewable)
- **Reuse**: Tokens are reused while valid (not recreated on every unlock)
- **Audit**: All issuance logged to `consent_audit` table

### Why VAULT_OWNER Tokens?

**Before** (❌ Insecure):

```python
# Old approach - bypassed consent protocol
if user_id == vault_owner:
    return encrypted_data  # No token validation!
```

**After** (✅ Secure):

```python
# New approach - uniform consent architecture
validate_vault_owner_token(token, user_id)
# Checks: signature, expiry, scope, userId match
return encrypted_data
```

**Benefits:**

1. ✅ **No Bypasses**: Vault owners follow same protocol as external agents
2. ✅ **Auditable**: All access logged, even by owner
3. ✅ **Consistent**: Same validation logic everywhere
4. ✅ **Compliance**: Clear audit trail for regulations
5. ✅ **Secure**: Token-based access prevents auth vulnerabilities

---

## 📋 Complete Authentication Flow

### 1. User Login (Firebase)

User authenticates via Google OAuth. Firebase issues an ID token.

```typescript
// Frontend
const result = await signInWithPopup(auth, googleProvider);
const idToken = await result.user.getIdToken();
```

### 2. Passphrase Verification (Frontend - Zero Knowledge)

User enters passphrase to unlock vault. **Passphrase never sent to server.**

```typescript
// components/vault/vault-flow.tsx
const vaultKeyHex = await VaultService.unlockVault(
  passphrase,
  vaultData.encryptedVaultKey,
  vaultData.salt,
  vaultData.iv
);
```

### 3. VAULT_OWNER Token Issuance (NEW!)

After successful passphrase verification, frontend requests VAULT_OWNER token:

```typescript
// components/vault/vault-flow.tsx - handleUnlockPassphrase()
if (decryptedKey) {
  // Get Firebase ID token
  const idToken = await auth.currentUser?.getIdToken();

  // Request VAULT_OWNER token from backend
  const { token, expiresAt } = await VaultService.issueVaultOwnerToken(
    userId,
    idToken
  );

  // Store in memory-only context
  unlockVault(decryptedKey, token, expiresAt);
}
```

### 4. Backend Verification & Token Issuance

Backend verifies Firebase ID token, checks for existing tokens, and issues new one if needed:

```python
# consent-protocol/api/routes/consent.py
@router.post("/vault-owner-token")
async def issue_vault_owner_token(request: Request):
    # 1. Verify Firebase ID token
    decoded_token = firebase_auth.verify_id_token(id_token)
    firebase_uid = decoded_token.get("uid")

    # 2. Ensure user requests token for their own vault
    if firebase_uid != user_id:
        raise HTTPException(403, "Cannot issue token for another user")

    # 3. Check for existing valid token (TOKEN REUSE)
    existing_token = await conn.fetchrow("""
        SELECT token_string, expires_at
        FROM consent_tokens
        WHERE user_id = $1 AND scope = 'vault.owner'
          AND expires_at > $2 AND revoked = FALSE
        LIMIT 1
    """, user_id, now_ms)

    if existing_token:
        # Reuse existing token ♻️
        return {
            "token": existing_token["token_string"],
            "expiresAt": existing_token["expires_at"],
            "scope": "vault.owner"
        }

    # 4. No valid token - issue new one 🔑
    token_obj = issue_token(
        user_id=user_id,
        agent_id="self",
        scope=ConsentScope.VAULT_OWNER,
        expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
    )

    # 5. Log to audit table
    await insert_event(
        user_id=user_id,
        agent_id="self",
        scope="vault.owner",
        action="VAULT_OWNER_TOKEN_ISSUED",
        expires_at=token_obj.expires_at
    )

    return {
        "token": token_obj.token,
        "expiresAt": token_obj.expires_at,
        "scope": "vault.owner"
    }
```

### 5. Token Storage (Frontend)

Tokens stored in React Context (memory-only, not `sessionStorage` or `localStorage`):

```typescript
// lib/vault/vault-context.tsx
interface VaultContextType {
  vaultKey: string | null;
  vaultOwnerToken: string | null; // NEW!
  tokenExpiresAt: number | null; // NEW!
  unlockVault: (key: string, token: string, expiresAt: number) => void;
  getVaultOwnerToken: () => string | null; // Auto-validates expiry
}
```

**Security Benefits:**

- ✅ Memory-only = XSS protection
- ✅ Lost on page refresh = Session security
- ✅ Never persisted = No lingering access

### 6. Using VAULT_OWNER Token

When accessing vault data, frontend passes token to backend:

```typescript
// Frontend - accessing food preferences
const token = getVaultOwnerToken(); // Auto-checks expiry
const response = await fetch("/api/food/preferences", {
  method: "POST",
  body: JSON.stringify({
    userId,
    consentToken: token, // Required!
  }),
});
```

Backend validates token before returning data:

```python
# consent-protocol/api/routes/food.py
@router.post("/preferences")
async def get_food_preferences(request: Request):
    body = await request.json()
    user_id = body.get("userId")
    consent_token = body.get("consentToken")

    # Validate VAULT_OWNER token
    validate_vault_owner_token(consent_token, user_id)
    # Checks: signature, expiry, scope=vault.owner, userId match

    # Fetch encrypted preferences
    return {"preferences": encrypted_data}
```

### 7. Logout

On logout, tokens are destroyed:

```typescript
// components/navigation.tsx - handleLogout()
lockVault(); // Clears vaultKey + vaultOwnerToken from memory
await signOut(auth);
```

---

## 🏗️ Token Validation Helper

Modular agents (Food, Professional) use a shared validation helper:

```python
# api/routes/food.py & api/routes/professional.py
def validate_vault_owner_token(consent_token: str, user_id: str) -> None:
    """
    Validate VAULT_OWNER consent token.
    Raises HTTPException if validation fails.
    """
    if not consent_token:
        raise HTTPException(401, "Missing consent token")

    # 1. Validate token (signature, expiry)
    valid, reason, token_obj = validate_token(consent_token)
    if not valid:
        raise HTTPException(401, f"Invalid token: {reason}")

    # 2. Check scope is VAULT_OWNER
    if token_obj.scope != ConsentScope.VAULT_OWNER.value:
        raise HTTPException(403, "Insufficient scope")

    # 3. Check userId matches
    if token_obj.user_id != user_id:
        raise HTTPException(403, "Token userId mismatch")

    logger.info(f"✅ VAULT_OWNER token validated for {user_id}")
```

---

## 🗄️ Database Tables

### consent_tokens (NEW!)

Stores all consent tokens including VAULT_OWNER tokens:

```sql
CREATE TABLE consent_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,  -- 'self' for VAULT_OWNER
  scope TEXT NOT NULL,      -- 'vault.owner' for VAULT_OWNER
  token_string TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_tokens_lookup
  ON consent_tokens(user_id, agent_id, scope, expires_at);
```

### consent_audit

Logs all consent actions including VAULT_OWNER token issuance:

```sql
CREATE TABLE consent_audit (
  id SERIAL PRIMARY KEY,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,  -- 'self' for vault owner
  scope TEXT NOT NULL,      -- 'vault.owner' for VAULT_OWNER
  action TEXT NOT NULL,     -- 'VAULT_OWNER_TOKEN_ISSUED'
  issued_at BIGINT NOT NULL,
  expires_at BIGINT,
  revoked_at BIGINT,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

**Example audit entry**:

```json
{
  "user_id": "user123",
  "agent_id": "self",
  "scope": "vault.owner",
  "action": "VAULT_OWNER_TOKEN_ISSUED",
  "issued_at": 1735968000000,
  "expires_at": 1736054400000
}
```

---

## 🔗 API Endpoints

### VAULT_OWNER Token Endpoints

| Endpoint                         | Method | Purpose                                                    |
| -------------------------------- | ------ | ---------------------------------------------------------- |
| `/api/consent/vault-owner-token` | POST   | Issue/reuse VAULT_OWNER token (requires Firebase ID token) |

### Modular Agent Endpoints (NEW!)

| Endpoint                              | Method | Purpose                           | Requires Token |
| ------------------------------------- | ------ | --------------------------------- | -------------- |
| `/api/food/preferences`               | POST   | Get encrypted food data           | VAULT_OWNER    |
| `/api/food/preferences/store`         | POST   | Store encrypted food data         | VAULT_OWNER    |
| `/api/professional/preferences`       | POST   | Get encrypted professional data   | VAULT_OWNER    |
| `/api/professional/preferences/store` | POST   | Store encrypted professional data | VAULT_OWNER    |

### Legacy Endpoints (Deprecated)

| Endpoint               | Status        | Migration Path                      |
| ---------------------- | ------------- | ----------------------------------- |
| `/db/food/get`         | ⚠️ DEPRECATED | Use `/api/food/preferences`         |
| `/db/professional/get` | ⚠️ DEPRECATED | Use `/api/professional/preferences` |

See deprecation warnings in `api/routes/db_proxy.py`.

---

## 🛡️ Security Guarantees

### VAULT_OWNER Token Security

1. ✅ **Firebase Verification**: Backend validates Firebase ID token before issuing
2. ✅ **Token Reuse**: Existing valid tokens returned instead of creating duplicates
3. ✅ **Scope Enforcement**: All agents validate `scope = "vault.owner"`
4. ✅ **User ID Binding**: Token userId must match request userId
5. ✅ **Signature Validation**: HMAC-SHA256 signature checked on every request
6. ✅ **Expiry Check**: Tokens expire after 24 hours
7. ✅ **Memory-Only Storage**: Frontend stores in React Context (XSS protected)
8. ✅ **Audit Trail**: All token issuance logged to `consent_audit`

### Traditional Security Features (Unchanged)

1. **No passphrase on server** - Zero-knowledge design
2. **Logout destroys tokens** - No lingering access
3. **Export zero-knowledge** - MCP access never exposes plaintext to server

---

## 🔄 Token Lifecyle

```
┌─────────────────────────────────────────────────────────────────┐
│                    VAULT_OWNER TOKEN LIFECYCLE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. ISSUANCE                                                      │
│    User unlocks vault → Backend issues token → Stored in DB     │
│                                                                  │
│ 2. REUSE                                                         │
│    User unlocks again → Backend finds existing → Returns same   │
│                         (while valid)                            │
│                                                                  │
│ 3. VALIDATION                                                    │
│    Every API call → validate_vault_owner_token() → Allow/Deny   │
│                                                                  │
│ 4. EXPIRY                                                        │
│    After 24h → Token invalid → User must unlock again           │
│                                                                  │
│ 5. LOGOUT                                                        │
│    User logs out → Token cleared from memory → Session ended    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎛️ Platform-Aware Routing

VAULT_OWNER token issuance works across all platforms:

```
┌──────────────────────────────────────────────────────────────┐
│              VAULT_OWNER TOKEN - PLATFORM ROUTING             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ WEB                                                           │
│  Frontend → /api/consent/vault-owner-token (Next.js proxy)   │
│          → Backend /api/consent/vault-owner-token            │
│                                                               │
│ iOS                                                           │
│  Frontend → HushhConsent.issueVaultOwnerToken() (Swift)      │
│          → Backend /api/consent/vault-owner-token            │
│                                                               │
│ ANDROID                                                       │
│  Frontend → HushhConsent.issueVaultOwnerToken() (Kotlin)     │
│          → Backend /api/consent/vault-owner-token            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Native Plugin Implementation**:

- **iOS**: `ios/App/App/Plugins/HushhConsentPlugin.swift`
- **Android**: `android/.../HushhConsentPlugin.kt`
- **Interface**: `lib/capacitor/index.ts`

---

## 📡 MCP External Consent (Third-Party Agents)

_[Previous MCP consent flow documentation remains unchanged]_

When external AI agents (Claude Desktop, Cursor, etc.) request access to user data, a special **zero-knowledge export** flow is used with agent-specific tokens (not VAULT_OWNER tokens).

---

## 🧪 Testing & Verification

### Testing Token Reuse

```bash
# 1. First unlock - creates new token
curl -X POST https://backend.example.com/api/consent/vault-owner-token \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -d '{"userId": "user123"}'
# Backend logs: "🔑 Issuing NEW VAULT_OWNER token"

# 2. Lock and unlock again (within 24h) - reuses token
curl -X POST https://backend.example.com/api/consent/vault-owner-token \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -d '{"userId": "user123"}'
# Backend logs: "♻️ Reusing existing VAULT_OWNER token"
```

### Testing Token Validation

```bash
# Valid VAULT_OWNER token
curl -X POST https://backend.example.com/api/food/preferences \
  -d '{"userId": "user123", "consentToken": "HCT:..."}'
# Returns: {"preferences": {...}}

# Missing token
curl -X POST https://backend.example.com/api/food/preferences \
  -d '{"userId": "user123"}'
# Returns: 401 "Missing consent token"

# Wrong scope token
curl -X POST https://backend.example.com/api/food/preferences \
  -d '{"userId": "user123", "consentToken": "HCT:...food.read..."}'
# Returns: 403 "Insufficient scope"
```

---

## 📊 Migration from Legacy Architecture

### Old Approach (Insecure)

```python
# ❌ OLD: db_proxy.py - CRITICAL SECURITY VULNERABILITY
@router.post("/db/food/get")
async def get_food_data(request: Request):
    body = await request.json()
    user_id = body.get("userId")

    # NO AUTHENTICATION! Anyone with userId can access data
    return encrypted_data
```

### New Approach (Secure)

```python
# ✅ NEW: api/routes/food.py - Consent-First Architecture
@router.post("/api/food/preferences")
async def get_food_preferences(request: Request):
    body = await request.json()
    user_id = body.get("userId")
    consent_token = body.get("consentToken")

    # VAULT_OWNER token required!
    validate_vault_owner_token(consent_token, user_id)

    return encrypted_data
```

### Migration Checklist

- [x] Backend `/api/consent/vault-owner-token` endpoint created
- [x] Modular Food agent (`/api/food/preferences`) created
- [x] Modular Professional agent (`/api/professional/preferences`) created
- [x] VaultContext updated to store VAULT_OWNER token
- [x] Vault unlock flow integrated with token request
- [x] iOS Swift plugin implemented
- [x] Android Kotlin plugin implemented
- [x] Token reuse logic implemented
- [x] Legacy routes deprecated with warnings
- [ ] Frontend API calls updated to pass tokens
- [ ] End-to-end testing across all platforms

---

_Version: 5.0 | Updated: January 2026 | VAULT_OWNER Token Architecture Release_
