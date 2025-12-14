# Consent Protocol Implementation

## Overview

This document describes how our agents implement the Hushh consent protocol from the foundational `consent-protocol/` module.

> ⚠️ **Rule**: `consent-protocol/` is **READ-ONLY** except for `agents/` and `operons/`.

---

## Token Issuance Flow

When a user confirms "Save" in any domain agent:

```
User → "Save" → Agent calls issue_token() → Frontend receives consent_token → Vault writes with validated token
```

### Implementation in Agents

Both agents follow identical patterns:

```python
from hushh_mcp.consent.token import issue_token, validate_token
from hushh_mcp.constants import ConsentScope

# In confirmation handler
consent_token = issue_token(
    user_id=user_id,
    agent_id=self.agent_id,
    scope=ConsentScope.VAULT_WRITE_PREFERENCES
)

# Return token to frontend
return {
    "is_complete": True,
    "consent_token": consent_token.token,
    "consent_issued_at": consent_token.issued_at,
    "consent_expires_at": consent_token.expires_at
}
```

---

## Agents Implemented

| Agent                  | Token Issuance             | Validation            |
| ---------------------- | -------------------------- | --------------------- |
| `food_dining`          | ✅ `issue_token()` on save | ✅ `validate_token()` |
| `professional_profile` | ✅ `issue_token()` on save | ✅ `validate_token()` |

---

## Token Format

```
HCT:base64(user_id|agent_id|scope|issued_at|expires_at).hmac_sha256_signature
```

- Cryptographically signed with server secret
- Expires after 7 days by default
- Can be revoked programmatically

---

## ConsentScope Values

Used from `hushh_mcp/constants.py` (domain-specific per Bible):

- `VAULT_READ_FOOD` / `VAULT_WRITE_FOOD`
- `VAULT_READ_PROFESSIONAL` / `VAULT_WRITE_PROFESSIONAL`
- `VAULT_READ_FINANCE` / `VAULT_WRITE_FINANCE`
- `VAULT_READ_EMAIL`, `VAULT_READ_PHONE`, `VAULT_READ_CONTACTS`
- `AGENT_IDENTITY_VERIFY`, `AGENT_FOOD_COLLECT`

---

## Foundational Layer Reference

The following files in `consent-protocol/` are **READ-ONLY** reference:

| File               | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `consent/token.py` | issue_token, validate_token, revoke_token |
| `constants.py`     | ConsentScope enum                         |
| `types.py`         | HushhConsentToken type                    |
| `vault/encrypt.py` | Encryption primitives                     |

---

## Implementation Status

- ✅ **Phase 1**: Token issuance on save
- ✅ **Phase 2**: Token validation before vault writes (in storage operons)
- ✅ **Phase 3**: TrustLinks for A2A delegation (in orchestrator)
