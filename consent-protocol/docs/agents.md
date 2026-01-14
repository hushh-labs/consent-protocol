# 🤖 Building AI Agents in HushhMCP

All real work in the Hushh PDA Hackathon happens inside **agents/**. This is where you’ll build actual AI agents that:

- Receive signed consent tokens
- Verify permissions using the HushhMCP protocol
- Perform useful actions like reading vault data, recommending content, or delegating trust
- Respect trust, security, and scope boundaries at all times

---

## 🧱 Agent Philosophy

Every agent should be:

| Principle         | Description                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| **Consent-First** | The agent **must never act** without verifying a valid `HushhConsentToken`   |
| **Scoped**        | It should act only on scopes it was given permission for                     |
| **Modular**       | Agent logic should be clean, testable, and reuse operons where possible      |
| **Auditable**     | The agent’s actions should be explainable through logs or output             |
| **Composable**    | Agents can delegate to each other using TrustLinks                           |
| **MCP-Exposed**   | Agents can be accessed by external AI hosts via MCP Server (`mcp_server.py`) |

---

## 🗂 Folder Structure

Each agent must live inside:

```bash
hushh_mcp/
├── agents/
│   └── my_agent/
│       ├── index.py         # Main logic
│       ├── manifest.py      # Metadata and scope declarations
│       └── utils.py         # Optional helper file
```

### Example:

```bash
hushh_mcp/agents/finance_assistant/
├── index.py
├── manifest.py
└── utils.py
```

---

## 📄 `manifest.py` Format

Every agent must include a `manifest.py` like this:

```python
manifest = {
    "id": "agent_finance_assistant",
    "name": "Finance Assistant",
    "description": "Helps user analyze expenses securely.",
    "scopes": ["vault.read.finance", "vault.read.email"],
    "version": "0.1.0"
}
```

---

## ⚙️ `index.py` Requirements

At minimum, your `index.py` should:

1. Define a `run()` or `handle()` function
2. Accept a `token` and `user_id`
3. Validate the token using `validate_token()`
4. Check the token scope
5. Return meaningful output

### ✅ Example Skeleton:

```python
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

class FinanceAssistantAgent:
    required_scope = ConsentScope.VAULT_READ_FINANCE

    def handle(self, user_id: str, token: str):
        valid, reason, parsed = validate_token(token, expected_scope=self.required_scope)

        if not valid:
            raise PermissionError(f"❌ Invalid token: {reason}")
        if parsed.user_id != user_id:
            raise PermissionError("❌ Token user mismatch")

        # Do real work here
        return {"summary": "💸 Your monthly expenses are down 8%."}
```

---

## 🧪 Testing Your Agent

Write a `pytest` test in `tests/test_agents.py` like this:

```python
def test_finance_agent_flow():
    token = issue_token("user_abc", "agent_finance_assistant", "vault.read.finance")
    agent = FinanceAssistantAgent()
    result = agent.handle("user_abc", token.token)
    assert "summary" in result
```

---

## 🔐 VAULT_OWNER Token Pattern (Production Implementation)

### When to Use VAULT_OWNER Tokens

**VAULT_OWNER tokens are required for all vault data reads/writes:**

| Scenario | Token Type | Validation |
|----------|------------|------------|
| User reads their own food preferences | VAULT_OWNER | `validate_vault_owner_token()` |
| User writes their own food preferences | VAULT_OWNER | `validate_vault_owner_token()` |
| Agent Kai reads user's investor profile | VAULT_OWNER | `validate_vault_owner_token()` |
| External MCP reads user data | MCP Read-Only | Agent-scoped token |

### Production Example: Food Preferences Endpoint

**File:** `api/routes/food.py`

```python
from fastapi import APIRouter, HTTPException, Request
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vault/food", tags=["food"])

def validate_vault_owner_token(consent_token: str, user_id: str) -> None:
    """
    Validate VAULT_OWNER consent token.
    
    Checks:
    1. Token is valid (signature, expiry)
    2. Token has VAULT_OWNER scope
    3. Token userId matches requested userId
    
    Raises HTTPException if validation fails.
    """
    if not consent_token:
        raise HTTPException(
            status_code=401,
            detail="Missing consent token. Vault owner must provide VAULT_OWNER token."
        )
    
    # Validate token
    valid, reason, token_obj = validate_token(consent_token)
    
    if not valid:
        logger.warning(f"Invalid consent token: {reason}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid consent token: {reason}"
        )
    
    # Check scope is VAULT_OWNER
    if token_obj.scope != ConsentScope.VAULT_OWNER.value:
        logger.warning(
            f"Insufficient scope: {token_obj.scope} (requires {ConsentScope.VAULT_OWNER.value})"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient scope. VAULT_OWNER scope required."
        )
    
    # Check userId matches
    if token_obj.user_id != user_id:
        logger.warning(f"Token userId mismatch: {token_obj.user_id} != {user_id}")
        raise HTTPException(
            status_code=403,
            detail="Token userId does not match requested userId"
        )
    
    logger.info(f"✅ VAULT_OWNER token validated for {user_id}")


@router.post("/preferences")
async def get_food_preferences(request: Request):
    """
    Get food preferences for vault owner.
    
    Requires VAULT_OWNER consent token for read access.
    Returns encrypted data for client-side decryption.
    
    CONSENT-FIRST: All vault data reads require token validation.
    """
    try:
        body = await request.json()
        user_id = body.get("userId")
        consent_token = body.get("consentToken")
        
        if not user_id or not consent_token:
            raise HTTPException(
                status_code=400,
                detail="userId and consentToken are required"
            )
        
        # VALIDATE VAULT_OWNER TOKEN
        validate_vault_owner_token(consent_token, user_id)
        
        # Fetch encrypted data from database
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchrow(
                """
                SELECT preferences 
                FROM vault_encrypted 
                WHERE user_id = $1 AND domain = 'food'
                """,
                user_id
            )
        
        if not result:
            logger.info(f"No food preferences found for {user_id}")
            return {"preferences": {}}
        
        logger.info(f"✅ Food preferences retrieved for {user_id}")
        return {"preferences": result["preferences"]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting food preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Token Reuse Pattern (Backend)

**File:** `api/routes/consent.py`

```python
@router.post("/vault-owner-token")
async def issue_vault_owner_token(request: Request):
    """Issue or reuse VAULT_OWNER token."""
    
    # Verify Firebase ID token
    firebase_uid = verify_firebase_bearer(auth_header)
    
    # Check for existing active token (TOKEN REUSE)
    now_ms = int(time.time() * 1000)
    active_tokens = await consent_db.get_active_tokens(user_id)
    
    for token in active_tokens:
        if token.get("scope") == ConsentScope.VAULT_OWNER.value:
            expires_at = token.get("expires_at", 0)
            
            # Reuse if token has > 1 hour left
            if expires_at > now_ms + (60 * 60 * 1000):
                candidate_token = token.get("token_id")
                
                # Validate signature before reusing
                is_valid, reason, payload = validate_token(
                    candidate_token,
                    ConsentScope.VAULT_OWNER
                )
                
                if is_valid:
                    logger.info(f"♻️ Reusing VAULT_OWNER token for {user_id}")
                    return {
                        "token": candidate_token,
                        "expiresAt": expires_at
                    }
    
    # No valid token - issue new one
    logger.info(f"🔑 Issuing NEW VAULT_OWNER token for {user_id}")
    token_obj = issue_token(
        user_id=user_id,
        agent_id="self",
        scope=ConsentScope.VAULT_OWNER,
        expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
    )
    
    # Store in consent_audit
    await consent_db.insert_event(
        user_id=user_id,
        agent_id="self",
        scope="vault.owner",
        action="CONSENT_GRANTED",
        token_id=token_obj.token,
        expires_at=token_obj.expires_at
    )
    
    return {"token": token_obj.token, "expiresAt": token_obj.expires_at}
```

### Frontend Token Usage

**File:** `app/dashboard/food/page.tsx`

```typescript
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";

export default function FoodDashboardPage() {
  const { user } = useAuth();
  const { getVaultKey, getVaultOwnerToken, isVaultUnlocked } = useVault();
  
  async function loadDashboard() {
    const userId = user?.uid;
    const vaultKey = getVaultKey();
    const vaultOwnerToken = getVaultOwnerToken();
    
    // REQUIRE all three: userId, vaultKey, vaultOwnerToken
    if (!userId || !vaultKey || !vaultOwnerToken) {
      router.push("/");
      return;
    }
    
    // Send VAULT_OWNER token with request
    const response = await ApiService.getFoodPreferences(
      userId,
      vaultOwnerToken  // Required parameter
    );
    
    // ... decrypt and display
  }
}
```

---

## 🧬 Reusing Operons

Agents can (and should) reuse logic from `hushh_mcp/operons/`.

Examples:

| Operon                | Use Case                    |
| --------------------- | --------------------------- |
| `verify_email()`      | Identity verification agent |
| `decrypt_data()`      | Secure data access in vault |
| `create_trust_link()` | Agent delegation workflows  |

---

## 🔐 Enforce Consent or Be Disqualified

The judges will audit your agent. If it:

- Does not validate consent
- Ignores scope checks
- Uses hardcoded trust

It will be disqualified — no exceptions.

---

## 🧭 Design Patterns

| Pattern              | Description                                |
| -------------------- | ------------------------------------------ |
| Agent + Operon       | Agent handles auth; operon does logic      |
| A2A Trust Delegation | `identity_agent` signs a `TrustLink`       |
| Vault + Consent Gate | Agent decrypts vault only with valid scope |

---

## 💡 Tips for Success

- Keep each agent focused (single responsibility)
- Use `print()` logs for debugging — logs matter!
- Run tests using `pytest` before submitting
- Don’t build your own protocol — use `hushh_mcp`

---

## ✅ Checklist Before Submission

- [ ] Agent lives inside `hushh_mcp/agents/<your_agent>/`
- [ ] Includes `manifest.py` with correct metadata
- [ ] Validates consent token using `validate_token()`
- [ ] Enforces scope from the token
- [ ] (Optional) Delegates trust via `create_trust_link()`
- [ ] Agent has a test in `tests/test_agents.py`
- [ ] Your `README.md` explains how it works and how to run it

---

Build AI that respects trust.
Build with consent.

—
Team Hushh

```

```
