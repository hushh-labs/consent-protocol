# Hushh Technical Architecture (v2.0.0)

> **Status**: Live (ADK Implementation)
> **Core Principle**: "Google ADK Brains, Hushh Security Soul."

## 1. High-Level Overview

Hushh v2.0 adopts a **Hub-and-Spoke** agent architecture built on the Google Agent Development Kit (ADK).
Instead of monolithic logic, we use specialized, smaller agents coordinated by a central Router.

### The "Unified Host" Model

- **Orchestrator (Hub)**: The single entry point for user intent. It does NOT do work; it delegates.
- **Specialist Agents (Spokes)**: Independent, stateless ADK Agents that perform specific domains (Food, Career, Finance).
- **Hushh Security Layer**: A wrapper around _every_ agent that enforces the Consent Protocol.

## 2. The Hushh ADK Standard

Every agent in the system must conform to the **Hushh ADK Standard**:

1.  **Manifest (`agent.yaml`)**:
    - Declarative definition of Model (`gemini-3-flash`), System Prompt, and Scopes.
    - Example: `required_scopes: [vault.read.finance]`

2.  **The Wrapper (`HushhAgent`)**:
    - Extends the standard ADK `Agent` class.
    - **Enforcement**: Automatically calls `validate_token()` before running any prompt.
    - **Context**: Injects `HushhContext` (User ID, Vault Keys) into the execution environment.

3.  **Secure Tools (`@hushh_tool`)**:
    - Python decorator that wraps ADK tools.
    - **Runtime Check**: verifies the active token has the specific scope for _that_ tool.
    - _No scope, no execution._

## 3. Data Flow: The "Hushh Way"

### Trace: "Analyze AAPL"

1.  **User Input**: `POST /api/orchestrator/chat` -> "Analyze AAPL".
2.  **Router**: `OrchestratorAgent` sees "Finance" intent -> Delegates to `KaiAgent`.
3.  **Execution**: `KaiAgent` (Coordinator) plans execution:
    - "I need fundamental data." -> Calls `perform_fundamental_analysis(ticker="AAPL")`.
4.  **Security Intercept**:
    - `@hushh_tool(scope="vault.read.finance")` triggers.
    - Checks `HushhContext.consent_token`.
    - **Pass**: Token has scope. Execution proceeds to Operon.
    - **Fail**: Raises `PermissionError`. Agent catches this and asks user for consent.
5.  **Operon**: Fetches data (e.g., from `sec_payload_aapl.json` or API).
6.  **Response**: Encrypted/Decrypted as needed, returned to User.

## 4. Agent Catalog

| Agent             | Role                | Model            | Key Tools                                                             |
| :---------------- | :------------------ | :--------------- | :-------------------------------------------------------------------- |
| **Orchestrator**  | **Router**          | `gemini-3-flash` | `delegate_to_food`, `delegate_to_kai`, `delegate_to_prof`             |
| **Food & Dining** | **Slot Filler**     | `gemini-3-flash` | `get_restaurant_recommendations` (Real Data), `save_food_preferences` |
| **Professional**  | **Profile Builder** | `gemini-3-flash` | `save_professional_profile`                                           |
| **Kai (Finance)** | **Coordinator**     | `gemini-3-flash` | `perform_fundamental`, `perform_sentiment`, `perform_valuation`       |

## 5. Directory Structure

```
hushh_mcp/
├── agents/             # The Spokes
│   ├── orchestrator/
│   ├── food_dining/
│   ├── professional_profile/
│   └── kai/
├── hushh_adk/          # The Foundation
│   ├── core.py         # HushhAgent
│   ├── tools.py        # @hushh_tool
│   └── context.py      # HushhContext
├── operons/            # The Business Logic (Pure Functions)
└── data/               # Static Datasets (restaurants.json)
```

## 6. Security & Compliance

- **Zero-Trust Tools**: Tools verify consent _again_, even if the Agent has it.
- **Manifest Truth**: Permissions are defined in `yaml`, not code.
- **Audit Logging**: Every tool invocation is logged with `ctx.user_id`.
