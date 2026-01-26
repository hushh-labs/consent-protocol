# 🔐 Consent Tokens — How They Work

This doc explains how to use the HushhMCP **consent token system** to grant, validate, and revoke scoped access for agents.

---

## 🧠 What is a HushhConsentToken?

A `HushhConsentToken` is a **signed, stateless contract** that proves:

- A user explicitly authorized an agent
- For a specific scope (e.g., `vault.read.email`)
- For a limited amount of time

It includes:

| Field        | Description                                   |
| ------------ | --------------------------------------------- |
| `user_id`    | The user who granted consent                  |
| `agent_id`   | The agent being authorized                    |
| `scope`      | What the agent is allowed to do               |
| `issued_at`  | Epoch timestamp in ms                         |
| `expires_at` | When this token becomes invalid               |
| `signature`  | HMAC-SHA256 hash (signed using server secret) |

---

## 📦 Token Lifecycle

### ✅ 1. Issue a Token

```python
from hushh_mcp.consent.token import issue_token

token_obj = issue_token(
    user_id="user_abc",
    agent_id="agent_food_dining",
    scope="vault.read.food"
)
```

> The returned `token_obj.token` is a string like:
> `HCT:base64(payload).signature`

---

### ✅ 2. Validate a Token

Before your agent takes action, always verify consent:

```python
from hushh_mcp.consent.token import validate_token

is_valid, reason, parsed_token = validate_token(
    token_str=token_obj.token,
    expected_scope="vault.read.food"
)
```

You should check:

- ✅ `is_valid == True`
- ✅ `parsed_token.user_id == incoming_user_id`
- ✅ `parsed_token.scope` matches your required action

---

### 🛑 3. Revoke a Token (if needed)

If a user revokes access early, or you need to invalidate a token:

```python
from hushh_mcp.consent.token import revoke_token

revoke_token(token_obj.token)
```

---

## ⏱ Expiry Logic

Tokens automatically expire based on the value defined in `.env`:

```env
DEFAULT_CONSENT_TOKEN_EXPIRY_MS=604800000  # 7 days
```

You can override this when issuing:

```python
issue_token(..., expires_in_ms=3600000)  # 1 hour
```

---

## ✅ ConsentScope Values

Defined in `hushh_mcp/constants.py`:

```python
# Vault READ scopes
ConsentScope.VAULT_READ_FINANCE
ConsentScope.VAULT_READ_FOOD
ConsentScope.VAULT_READ_PROFESSIONAL
ConsentScope.VAULT_READ_ALL  # Session scope

# Vault WRITE scopes
ConsentScope.VAULT_WRITE_FOOD
ConsentScope.VAULT_WRITE_FINANCE
ConsentScope.VAULT_WRITE_PROFESSIONAL

# Agent permissioning
ConsentScope.AGENT_SHOPPING_PURCHASE
ConsentScope.AGENT_FOOD_COLLECT

# Custom scopes
ConsentScope.CUSTOM_TEMPORARY
```

If you're using a custom agent, you can define your own scope:

```python
scope = ConsentScope("custom.my_scope_name")
```

---

## 🧪 How to Test It

In `tests/test_token.py`, we’ve included test cases for:

- Valid issuance and use
- Expired tokens
- Signature tampering
- Revoked token rejection

Run tests with:

```bash
pytest tests/test_token.py
```

---

## 💡 When to Use Consent Tokens vs. TrustLinks

| Use Case                                     | Use This                             |
| -------------------------------------------- | ------------------------------------ |
| A user gives permission directly to an agent | ✅ `HushhConsentToken`               |
| One agent acts on behalf of another agent    | 🔁 `TrustLink` (see `docs/trust.md`) |

---

## 🧠 Reminder for Hackathon Teams

Every action by your agent must be gated by a valid token.
Hardcoding trust = disqualification.

All tokens must be:

- Explicitly issued
- Cryptographically signed
- Validated at runtime

Build real agents. Validate real trust.

—
Team Hushh
