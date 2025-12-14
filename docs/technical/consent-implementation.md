# Consent Protocol Implementation

> How agents issue and validate consent tokens in the Hushh system.

---

## 🎯 Overview

The consent protocol ensures that **every action on user data requires explicit, cryptographic permission**. This document explains how agents implement the protocol.

---

## 🔐 Token Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   REQUIRE   │────►│    ISSUE    │────►│   VALIDATE  │────►│   REVOKE    │
│   Consent   │     │   Token     │     │   Token     │     │   (Optional)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
User confirms       Agent calls         Vault API calls      User or system
"Save" in UI        issue_token()       validate_token()     invalidates
```

---

## 📋 Implementation Steps

### 1. Agent Collects Data

```python
class HushhFoodDiningAgent:
    def handle_message(self, message, user_id, session_state):
        # Multi-turn conversation to collect:
        # - Dietary restrictions
        # - Cuisine preferences
        # - Monthly budget
        state = session_state or {"step": "greeting", "collected": {}}

        # ... conversation logic ...

        return {
            "response": response_message,
            "session_state": state,
            "collected_data": state.get("collected", {}),
            "is_complete": False,
            "needs_consent": False
        }
```

### 2. Show Confirmation Before Save

```python
def _handle_budget_input(self, message, state):
    # Parse and store budget
    state["collected"]["monthly_budget"] = parsed_budget
    state["step"] = "confirm"

    return {
        "message": (
            "📋 **Summary:**\n\n"
            f"🥗 Dietary: {dietary}\n"
            f"🍜 Cuisines: {cuisines}\n"
            f"💰 Budget: ${budget}\n\n"
            "Save to your encrypted vault?"
        ),
        "state": state,
        "ui_type": "buttons",
        "options": ["💾 Save Preference", "✏️ Edit"],
        "needs_consent": True,  # Signal frontend
        "consent_scope": [ConsentScope.VAULT_WRITE_FOOD.value]
    }
```

### 3. Issue Token on Confirmation

```python
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

def _handle_confirmation(self, message, state, user_id):
    msg_lower = message.lower().strip()

    if msg_lower in ["save", "yes", "confirm"]:
        # === CONSENT PROTOCOL: Issue signed token ===
        consent_token = issue_token(
            user_id=user_id,
            agent_id=self.manifest["name"],  # "agent_food_dining"
            scope=ConsentScope.VAULT_WRITE_FOOD
        )

        logger.info(f"🔐 Issued consent token for {user_id}")

        return {
            "message": "🎉 Preferences saved successfully!",
            "state": {"step": "complete", "collected": state["collected"]},
            "is_complete": True,
            # Return token to frontend
            "consent_token": consent_token.token,
            "consent_scope": ConsentScope.VAULT_WRITE_FOOD.value,
            "consent_issued_at": consent_token.issued_at,
            "consent_expires_at": consent_token.expires_at
        }
```

### 4. Frontend Encrypts & Sends to Vault

```typescript
// Frontend: agent-chat.tsx
if (data.isComplete && data.consent_token) {
  // Encrypt data locally
  const encrypted = await encryptData(
    JSON.stringify(data.sessionState.collected),
    vaultKey // sessionStorage - never sent to server
  );

  // Send to vault with consent token
  await fetch("/api/vault/store-preferences", {
    method: "POST",
    body: JSON.stringify({
      userId,
      preferences: encrypted,
      consentToken: data.consent_token, // For validation
    }),
  });
}
```

### 5. Vault Validates Token Before Write

```typescript
// API: /api/vault/store-preferences/route.ts
export async function POST(req: NextRequest) {
  const { userId, preferences, consentToken } = await req.json();

  // Validate consent token
  const validation = await fetch("http://localhost:8000/api/validate-token", {
    method: "POST",
    body: JSON.stringify({ token: consentToken }),
  });
  const result = await validation.json();

  if (!result.valid) {
    return NextResponse.json(
      { error: `Consent validation failed: ${result.reason}` },
      { status: 403 }
    );
  }

  // Verify token is for this user
  if (result.user_id !== userId) {
    return NextResponse.json({ error: "User mismatch" }, { status: 403 });
  }

  // Only now perform the write
  await db.vault_food.upsert({
    where: { user_id: userId },
    data: preferences, // Already encrypted
  });

  return NextResponse.json({ success: true });
}
```

---

## 🔑 Token Format

```
HCT:base64(user_id|agent_id|scope|issued_at|expires_at).hmac_sha256_signature
```

### Example Token

```
HCT:dXNlcl9tb2NrXzAwMXxhZ2VudF9mb29kX2RpbmluZ3x2YXVsdC53cml0ZS5mb29kfDE3MDI1NjAwMDAwMDB8MTcwMjY0NjQwMDAwMA==.a1b2c3d4e5f6...
```

### Decoded Payload

```
user_mock_001|agent_food_dining|vault.write.food|1702560000000|1702646400000
```

---

## ✅ Validation Logic

```python
# hushh_mcp/consent/token.py

def validate_token(token_str, expected_scope=None):
    # 1. Check if revoked
    if token_str in _revoked_tokens:
        return False, "Token has been revoked", None

    # 2. Parse token
    prefix, signed_part = token_str.split(":")
    encoded, signature = signed_part.split(".")

    # 3. Verify prefix
    if prefix != CONSENT_TOKEN_PREFIX:  # "HCT"
        return False, "Invalid token prefix", None

    # 4. Decode payload
    decoded = base64.urlsafe_b64decode(encoded).decode()
    user_id, agent_id, scope_str, issued_at, expires_at = decoded.split("|")

    # 5. Verify signature
    raw = f"{user_id}|{agent_id}|{scope_str}|{issued_at}|{expires_at}"
    expected_sig = hmac.new(SECRET_KEY, raw, sha256).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        return False, "Invalid signature", None

    # 6. Check scope
    if expected_scope and scope_str != expected_scope.value:
        return False, "Scope mismatch", None

    # 7. Check expiration
    if int(time.time() * 1000) > int(expires_at):
        return False, "Token expired", None

    # Valid!
    return True, None, HushhConsentToken(...)
```

---

## 📊 ConsentScope Values

```python
class ConsentScope(str, Enum):
    # Food & Dining
    VAULT_READ_FOOD = "vault.read.food"
    VAULT_WRITE_FOOD = "vault.write.food"
    AGENT_FOOD_COLLECT = "agent.food.collect"

    # Professional Profile
    VAULT_READ_PROFESSIONAL = "vault.read.professional"
    VAULT_WRITE_PROFESSIONAL = "vault.write.professional"
    AGENT_PROFESSIONAL_COLLECT = "agent.professional.collect"

    # Finance
    VAULT_READ_FINANCE = "vault.read.finance"
    VAULT_WRITE_FINANCE = "vault.write.finance"

    # Identity
    AGENT_IDENTITY_VERIFY = "agent.identity.verify"
```

---

## 📁 File References

| File                         | Purpose                     |
| ---------------------------- | --------------------------- |
| `hushh_mcp/consent/token.py` | issue, validate, revoke     |
| `hushh_mcp/constants.py`     | ConsentScope enum           |
| `hushh_mcp/types.py`         | HushhConsentToken type      |
| `hushh_mcp/config.py`        | SECRET_KEY, expiry settings |

---

## 🚫 Anti-Patterns

| DON'T                          | DO                                 |
| ------------------------------ | ---------------------------------- |
| Skip consent for "convenience" | Always issue_token() before writes |
| Use hardcoded user IDs         | Pass real Firebase userId          |
| Store vault keys server-side   | Keep in sessionStorage only        |
| Ignore validation errors       | Return 403 on any failure          |

---

## 📈 Implementation Status

| Feature           | Status         |
| ----------------- | -------------- |
| Token issuance    | ✅ Complete    |
| Token validation  | ✅ Complete    |
| Token revocation  | ✅ Complete    |
| Scope enforcement | ✅ Complete    |
| TrustLinks (A2A)  | 🔧 In Progress |
| Audit logging     | 🔧 Planned     |

---

_Version: 2.0 | Updated: 2024-12-14_
