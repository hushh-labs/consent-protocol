# Agent Nav — Universal Agent Orchestrator

> **The organizational foundation for all Hushh agents.**

---

## 👩 Nav Persona

**Nav (♀)** is the in-app navigation assistant — an organized, insightful guide who helps users:

- 🔍 Discover available agents
- 📍 Navigate features and data
- 💬 Get answers about the Hushh ecosystem

**Personality Traits:** Organized • Insightful • Helpful • Intuitive • Thoughtful • Proactive • Reliable

**Interface:** Chat-like experience (similar to ChatGPT/Claude) — _Coming Soon_

---

## 🎯 Purpose

Agent Nav provides the base class that ALL Hushh agents extend:

- **🍽️ Food & Dining Agent**
- **💼 Professional Profile Agent**
- **📈 Agent Kai** (Investment Analyst)
- **Future agents...**

It enforces consistent:

- ✅ Consent protocol compliance
- ✅ Token validation before ANY action
- ✅ Standard manifest structure
- ✅ Error handling patterns
- ✅ Audit logging

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        AgentNav (Base)                        │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ validate_      │  │ issue_consent_ │  │ handle_with_   │  │
│  │ consent()      │  │ token()        │  │ consent()      │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
│                           │                                   │
│               Enforces: Token → Action                        │
└──────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  FoodDining   │  │ Professional  │  │   KaiAgent    │
│    Agent      │  │    Agent      │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## 📋 AgentManifest

Every agent defines its metadata via `AgentManifest`:

```python
manifest = AgentManifest(
    agent_id="agent_kai",
    name="Kai Investment Analyst",
    description="Explainable investing copilot",
    version="1.0.0",
    required_scopes=[
        ConsentScope.VAULT_READ_RISK_PROFILE,
        ConsentScope.AGENT_KAI_ANALYZE,
    ]
)
```

---

## 🔐 Core Methods

| Method                  | Purpose                           |
| ----------------------- | --------------------------------- |
| `validate_consent()`    | Validate token before action      |
| `issue_consent_token()` | Issue new consent token           |
| `handle_with_consent()` | Execute action WITH consent check |
| `_handle_action()`      | [Abstract] Agent-specific logic   |
| `_get_manifest()`       | [Abstract] Define agent metadata  |

---

## 🎯 Key Principle

```
🔐 Consent BEFORE Action - Always

handle_with_consent():
    1. validate_consent(token, scope, user_id)  # ✅ FIRST
    2. _handle_action(...)                       # ✅ THEN
```

---

## 📁 Implementation

| File               | Location                                                 |
| ------------------ | -------------------------------------------------------- |
| **Base class**     | `consent-protocol/hushh_mcp/agents/agent_nav.py`         |
| **Kai extension**  | `consent-protocol/hushh_mcp/agents/kai/agent.py`         |
| **Food extension** | `consent-protocol/hushh_mcp/agents/food_dining/agent.py` |

---

## 📚 Related Documentation

- [Consent Protocol](file:///c:/OneDrive%20-%20NS/Repository/hushh-research/consent-protocol/docs/consent.md)
- [Operons](file:///c:/OneDrive%20-%20NS/Repository/hushh-research/consent-protocol/docs/operons.md)
- [Agent Kai](file:///c:/OneDrive%20-%20NS/Repository/hushh-research/docs/vision/kai/readme.md)
