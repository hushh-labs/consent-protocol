# 🛠️ Agent CLI Tools (`agentcli`)

The HushhMCP protocol supports lightweight CLI tools to help you **scaffold, manage, and test your AI agents faster** — especially during the hackathon.

These tools are designed to reduce boilerplate, maintain consistency, and speed up prototyping during the event.

---

## ✅ Included CLI Tool

### 1. `generate_agent.py`

Scaffolds a new agent inside `hushh_mcp/agents/`.

```bash
python hushh_mcp/cli/generate_agent.py my_agent_name
````

Creates:

```bash
hushh_mcp/agents/my_agent_name/
├── index.py         # Your agent logic goes here
├── manifest.py      # Agent ID, description, and scopes
```

---

## 🧪 What This CLI Tool Does

* Normalizes agent naming (snake\_case)
* Creates minimal but working files
* Ensures you follow the correct folder structure
* Saves time during onboarding and testing

---

## 🚀 CLI Tools We’d Love to See You Build

As part of the hackathon, we’re encouraging contributors to **create new agentcli tools** that others can use.

Here are some ideas:

### 🔍 1. `debug_token.py`

```bash
python hushh_mcp/cli/debug_token.py <token>
```

Decodes and verifies a HushhConsentToken from the command line. Outputs:

* Scope
* Issued at
* Expires at
* Validity

---

### 🧪 2. `run_agent.py`

```bash
python hushh_mcp/cli/run_agent.py --agent=shopping --token=<token> --user=user_abc
```

Runs any agent locally with input args. Useful for quick validation or prototyping.

---

### 🔁 3. `register_operon.py`

Adds a new operon to an operon registry manifest, ensuring operons can be discovered and reused.

---

### 📜 4. `submit_report.py`

A helper to package your submission as a zip, validate directory structure, and auto-check your README, tests, and agent folders before final push.

---

## 🧠 Why Use CLI Tools?

* ⚡ Speed: Instantly scaffold clean, working code
* 🧬 Consistency: Avoid typos, naming issues, or bad structure
* 💡 Reusability: Your tools can help others in the community
* 🔁 Automation: Makes testing and iteration easier

---

## 🛠 How to Add Your Own Tool

1. Add your script to:

```bash
hushh_mcp/cli/
```

2. Keep it cross-platform (`argparse`, not `click` or shell-only)

3. Add a small README section explaining how it works

4. Make sure it’s safe and respectful of the protocol boundaries (no hardcoded access)

---

## 🏆 Bonus Points

Agents or teams that contribute useful CLI tools will be highlighted at the final demo showcase and may receive additional rewards.

---

Let’s make building agents fast, clean, and collaborative.

—
Team Hushh
