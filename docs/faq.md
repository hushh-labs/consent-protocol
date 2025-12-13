# 🙋 Hushh PDA Hackathon – FAQ

This FAQ covers common questions asked by hackathon participants, agent builders, and reviewers.

---

## 🧠 What is this protocol for?

The **HushhMCP protocol** ensures that every action your agent takes is:

- Cryptographically permissioned by the user
- Scope-bound
- Time-limited
- Verifiable by anyone reviewing the system

Your agent **must use this protocol** to prove it has user consent.

---

## 📦 Where do I build my agent?

Inside the folder:  
```bash
hushh_mcp/agents/<your_agent_name>/
````

Include at least:

* `index.py`: Your agent’s behavior
* `manifest.py`: Agent ID, scope(s), description

---

## 🔐 How do I know if I’m enforcing consent correctly?

You must use `validate_token()` from:

```python
from hushh_mcp.consent.token import validate_token
```

You should validate:

* The token is not expired
* The signature is valid
* The scope matches what the agent is doing
* The user ID in the token matches the actual user

---

## 🔁 What’s the difference between a Consent Token and a TrustLink?

| Consent Token               | TrustLink                          |
| --------------------------- | ---------------------------------- |
| User → Agent                | Agent A → Agent B                  |
| Used for direct access      | Used for delegated behavior        |
| Issued with `issue_token()` | Created with `create_trust_link()` |

---

## 🧪 How do I test my agent?

Use `pytest`. Add your tests in:

```bash
tests/test_agents.py
```

Every test should check:

* Consent token validation
* Scope enforcement
* Agent’s actual output

Run your tests with:

```bash
pytest
```

---

## 🔐 How do I encrypt user data?

Use the built-in vault layer:

```python
from hushh_mcp.vault.encrypt import encrypt_data, decrypt_data
```

Data must be encrypted **before storing or sharing**, and decrypted only after verifying consent.

---

## ⚙️ How do I generate a new agent?

Use the CLI:

```bash
python hushh_mcp/cli/generate_agent.py my_agent_name
```

This will scaffold:

```bash
hushh_mcp/agents/my_agent_name/index.py
hushh_mcp/agents/my_agent_name/manifest.py
```

---

## 🛑 What will disqualify my team?

* ❌ Skipping token or trust validation
* ❌ Hardcoding access rules
* ❌ Reading data without verifying consent
* ❌ Submitting without working tests
* ❌ Copy-pasting logic from outside the protocol

---

## 🧾 What should be in our submission?

1. Create a new repo:

   ```
   Hushh_Hackathon_Team_Name
   ```

2. Inside your README, explain:

   * How to run the agent
   * What scopes it needs
   * How it validates consent
   * Sample inputs and outputs
   * How to run tests

3. Push your project to GitHub and submit the link.

---

## 💬 Where can I ask for help?

* Use the `#hushh-hackathon` channel in Discord
* DM your mentor
* Ask mentors during office hours
* Or read the full `/docs` for answers

---

Build something powerful. Build it with permission.
—
Team Hushh

```
