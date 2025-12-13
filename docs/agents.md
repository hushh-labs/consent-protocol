# 🤖 Building AI Agents in HushhMCP

All real work in the Hushh PDA Hackathon happens inside **agents/**. This is where you’ll build actual AI agents that:

- Receive signed consent tokens
- Verify permissions using the HushhMCP protocol
- Perform useful actions like reading vault data, recommending content, or delegating trust
- Respect trust, security, and scope boundaries at all times

---

## 🧱 Agent Philosophy

Every agent should be:

| Principle       | Description |
|------------------|-------------|
| **Consent-First** | The agent **must never act** without verifying a valid `HushhConsentToken` |
| **Scoped**        | It should act only on scopes it was given permission for |
| **Modular**       | Agent logic should be clean, testable, and reuse operons where possible |
| **Auditable**     | The agent’s actions should be explainable through logs or output |
| **Composable**    | Agents can delegate to each other using TrustLinks |

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
````

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

* Does not validate consent
* Ignores scope checks
* Uses hardcoded trust

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

* Keep each agent focused (single responsibility)
* Use `print()` logs for debugging — logs matter!
* Run tests using `pytest` before submitting
* Don’t build your own protocol — use `hushh_mcp`

---

## ✅ Checklist Before Submission

* [ ] Agent lives inside `hushh_mcp/agents/<your_agent>/`
* [ ] Includes `manifest.py` with correct metadata
* [ ] Validates consent token using `validate_token()`
* [ ] Enforces scope from the token
* [ ] (Optional) Delegates trust via `create_trust_link()`
* [ ] Agent has a test in `tests/test_agents.py`
* [ ] Your `README.md` explains how it works and how to run it

---

Build AI that respects trust.
Build with consent.

—
Team Hushh

```
