# 📖 Hushh PDA Hackathon – Developer Docs

Welcome to the official documentation for teams participating in the **Hushh PDA Hackathon**.

This project provides the programmable trust and consent layer you’ll use to build real, production-grade AI agents.

---

## 🚀 Hackathon Goals

- Build real AI agents that act **only with user consent**
- Use the `HushhMCP` protocol for all access control and trust flows
- Design your own **sign-in/auth method** (e.g. Apple ID, Google, etc.)
- Store and access personal data **securely, with AES encryption**
- Use signed TrustLinks to safely delegate agent-to-agent actions
- Submit a working repo on GitHub with setup instructions

---

## 🛠 What You Need to Do

1. **Fork this repo**

   ```bash
   git clone https://github.com/YOUR_TEAM/Hushh_Hackathon_Team_Name.git
   cd Hushh_Hackathon_Team_Name    ```

2. **Implement your own sign-in system**

   * You can use OAuth (Google, Apple, GitHub, etc.)
   * Just make sure it maps to a `UserID` used in the protocol

3. **Use HushhMCP for all access logic**

   * Do **not** build a custom trust layer — extend the one already in `hushh_mcp/`
   * All agents must verify consent before performing actions

4. **Build your agents inside the `/agents/` folder**

   * Each agent should have its own folder
   * Include an `index.py` and a `manifest.py`

5. **Use consent tokens + TrustLinks correctly**

   * `issue_token()` from `consent/token.py`
   * `validate_token()` before accessing any data
   * Use `create_trust_link()` if one agent is acting for another

6. **Encrypt all user data using the vault**

   * Use `encrypt_data()` and `decrypt_data()` from `vault/encrypt.py`
   * Vault records should always include metadata (agent ID, scope, timestamps)

7. **Write tests**

   * Add `pytest`-compatible tests in the `tests/` folder
   * Validate agent behavior, consent flow, trust verification, and encryption

---

## 🧪 Project Submission Format

At the end of the hackathon:

### ✅ Create a new GitHub repository:

```
Hushh_Hackathon_Team_Name
```

### ✅ Inside that repo:

* Fork this repo’s code as your base
* Add your agent(s) inside `hushh_mcp/agents/<agent_name>/`
* Update `README.md` to explain:

  * Setup instructions
  * How your agent(s) work
  * What trust model you implemented
  * How to test the project end-to-end

> ✅ Include sample consent tokens, data payloads, and TrustLink flows in your README.

---

## 📁 Key Files to Modify

| File                             | Purpose                              |
| -------------------------------- | ------------------------------------ |
| `hushh_mcp/agents/<your_agent>/` | Where your AI agent logic lives      |
| `hushh_mcp/trust/link.py`        | Where A2A TrustLinks are defined     |
| `hushh_mcp/consent/token.py`     | Where tokens are created/validated   |
| `hushh_mcp/vault/encrypt.py`     | Where encrypted vault access happens |
| `tests/`                         | Add tests for everything you write   |

---

## 🧠 Reminder: Use Scopes, Not Roles

All agents should only act when they have:

* A valid `HushhConsentToken` with the correct `ConsentScope`
* OR a `TrustLink` from a permitted delegator agent

---

## 📬 Questions or Clarifications?

* DM the mentor assigned to your team
* Ask in the Whatsapp Group (channel: `#hushh-hackathon`)
* Use the `README.md` and `/docs/*.md` in this repo for architecture references

---

Let’s build AI agents that respect humans — by default.

Good luck, and build with consent.

```

