# Building Hushh ADK Agents

> **Standard**: ADK v2.0
> **Requirement**: All new agents must follow this guide.

## The 3-Step Process

Building a Hushh Agent is standardized. Do not deviate.

### Step 1: The Manifest (`agent.yaml`)

Define _what_ your agent is. This file is the source of truth for permissions.

```yaml
id: agent_example
name: Example Agent
version: 1.0.0
description: Does useful things securely.
model: gemini-3-flash-preview
system_instruction: |
  You are a helpful assistant.
required_scopes:
  - vault.read.example
tools:
  - name: my_secure_tool
    py_func: hushh_mcp.agents.example.tools.my_secure_tool
    required_scope: vault.read.example
```

### Step 2: The Tools (`tools.py`)

Define _how_ your agent acts. Wrap logic with security.

**CRITICAL RULES**:

- NEVER put business logic in the tool. Call an **Operon**.
- ALWAYS use `@hushh_tool`.
- ALWAYS check `HushhContext.current()` if you need User ID.

```python
from hushh_mcp.hushh_adk.tools import hushh_tool
from hushh_mcp.constants import ConsentScope

@hushh_tool(scope=ConsentScope.VAULT_READ_EXAMPLE, name="my_secure_tool")
def my_secure_tool(query: str) -> str:
    """Description for the LLM."""
    # 1. Security Check happened automatically via decorator

    # 2. Call Business Logic (Operon)
    from hushh_mcp.operons.example import complex_logic
    result = complex_logic(query)

    return result
```

### Step 3: The Agent (`agent.py`)

Define _who_ your agent is. Wire it up.

```python
from hushh_mcp.hushh_adk.core import HushhAgent
from .tools import my_secure_tool

class ExampleAgent(HushhAgent):
    def __init__(self):
        # Load manifest...
        super().__init__(..., tools=[my_secure_tool])

_agent = None
def get_example_agent():
    # Singleton pattern
    pass
```

## Best Practices

1.  **Statelessness**: Agents should not store conversation history in memory. Rely on the client/orchestrator to pass state or prompts.
2.  **Consent First**: If a tool fails with `PermissionError`, the Agent should catch it and tell the user: "I need your consent to do that."
3.  **Real Data**: Do not hardcode dictionaries. Load data from `hushh_mcp/data/` or external APIs.
4.  **Tests**: Write a test in `tests/` that instantiates your agent and mocks the tool execution.
