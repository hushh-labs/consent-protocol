# ADK Implementation Guide

This document describes the implementation of the Google Agent Development Kit (ADK) within the Hushh system, following the established consent-first architecture.

## Overview

The Hushh ADK implementation follows Google's official patterns while maintaining the security and consent requirements of the Hushh platform. All agents are wrapped with a `HushhAgent` base class that enforces:
1. Consent token validation at agent entry point
2. Context injection for tool execution
3. Proper logging and error handling

## Core Components

### 1. HushhAgent Base Class

The `HushhAgent` class extends Google ADK's `LlmAgent` and provides:
- Consent validation before agent execution
- Context management for tool calls
- Proper error handling and logging

```python
from hushh_mcp.agents.base_agent import HushhAgent

class MySpecialistAgent(HushhAgent):
    def __init__(self):
        super().__init__(
            name="My Agent",
            model="gemini-3-flash",
            system_prompt="You are a specialized agent...",
            required_scopes=["agent.myagent.analyze"]
        )
```

### 2. @hushh_tool Decorator

The `@hushh_tool` decorator enforces:
- Active HushhContext validation
- Consent scope checking against current token
- User identity verification

```python
from hushh_mcp.tools.hushh_tools import hushh_tool

@hushh_tool(scope="vault.read.finance")
def fetch_financial_data(user_id: str, ticker: str):
    # Implementation that accesses vault data
    pass
```

## Agent Structure

All Hushh agents should follow this pattern:

1. **Inherit from HushhAgent** instead of directly from LlmAgent
2. **Define required scopes** during initialization 
3. **Use @hushh_tool** for all data access operations
4. **Implement proper async/await patterns** for asynchronous operations

## Agent-to-Agent Communication (A2A)

The Hushh system supports A2A communication through the `KaiA2AServer` which:
1. Validates consent tokens for A2A requests
2. Uses the same security patterns as internal agents
3. Implements proper agent cards with manifest metadata

## Implementation Best Practices

### 1. Security
- Always validate consent tokens before any agent execution
- All tool access must go through `@hushh_tool` decorator
- Never bypass consent validation in any circumstance

### 2. Context Management
- Use `HushhContext` for all tool execution to maintain user context
- Ensure proper cleanup of context after agent execution

### 3. Error Handling
- All agents should properly handle and log exceptions
- Return appropriate error responses to the caller
- Avoid exposing internal implementation details in errors

## Migration from Legacy Implementation

The new ADK implementation:
1. Replaces the old `AgentNav` pattern with proper Google ADK patterns
2. Ensures all agent-to-tool communication goes through validated consent
3. Maintains full backward compatibility with existing APIs
4. Adds proper streaming and A2A support

## Testing

All agents must be tested with:
1. Unit tests for tool functionality
2. Integration tests for agent workflows  
3. Security tests for consent validation
4. A2A communication tests when applicable

## Future Enhancements

1. **Streaming Support**: Full implementation of real-time streaming for debate processes
2. **Agent Cloning**: Support for creating multiple instances of agents with different configurations
3. **Dynamic Agent Loading**: Runtime loading of agent modules for scalability
4. **Advanced Tooling**: Support for more complex tool chains and agent collaboration patterns