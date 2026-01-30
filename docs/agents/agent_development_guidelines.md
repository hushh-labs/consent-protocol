# Agent Development Guidelines

This document provides comprehensive guidelines for developing new agents within the Hushh system, following Google's ADK patterns while maintaining our consent-first security model.

## Overview

All Hushh agents must follow a consistent pattern that:
1. Leverages Google ADK for core agent functionality
2. Enforces Hushh's consent security model  
3. Provides clear interfaces for both internal and A2A communication
4. Supports streaming and real-time processing where appropriate

## Agent Structure

### Required Components

Every Hushh agent should include:

1. **Agent Class** - Inherits from `HushhAgent`
2. **Tool Decorators** - All data access uses `@hushh_tool` 
3. **Manifest Metadata** - For A2A discovery
4. **Error Handling** - Proper exception handling and logging

### Basic Template

```python
from hushh_mcp.agents.base_agent import HushhAgent
from hushh_mcp.tools.hushh_tools import hushh_tool

class MyAgent(HushhAgent):
    def __init__(self):
        super().__init__(
            name="My Agent",
            model="gemini-3-flash",
            system_prompt="You are a specialized agent...",
            required_scopes=["agent.myagent.analyze"]
        )
    
    @hushh_tool(scope="vault.read.data")
    async def fetch_data(self, user_id: str, query: str):
        # Implementation that accesses vault data
        pass
    
    async def analyze(self, user_id: str, consent_token: str, input_data: dict):
        # Agent logic here
        pass
```

## Security Requirements

### Consent Validation

All agents must validate consent tokens before processing:

```python
def validate_consent(self, consent_token: str):
    valid, reason, payload = validate_token(
        consent_token,
        expected_scope=ConsentScope("agent.myagent.analyze")
    )
    
    if not valid:
        raise PermissionError(f"Invalid consent: {reason}")
```

### Tool Security

All data access must go through `@hushh_tool` decorated functions:

```python
@hushh_tool(scope="vault.read.finance")
def get_financial_data(self, user_id: str, ticker: str):
    # Secure data access
    pass

@hushh_tool(scope="external.api.news")
def fetch_news(self, user_id: str, ticker: str):
    # Secure external API access
    pass
```

## Context Management

### HushhContext Usage

All tools and operations should use the current context:

```python
from hushh_mcp.hushh_adk.context import HushhContext

@hushh_tool(scope="vault.read.data")
def secure_operation(self, user_id: str, data: str):
    ctx = HushhContext.current()
    # Use ctx.user_id and ctx.consent_token for security
    return "processed data"
```

## Data Flow

### Internal Agent Flow

1. **API Request** → Validate consent token
2. **Agent Execution** → Validate agent scopes  
3. **Tool Access** → Validate tool scopes
4. **Data Processing** → Operons and business logic
5. **Response Generation** → Return structured data

### A2A Agent Flow

1. **A2A Request** → Validate consent token in headers
2. **Agent Processing** → Execute with validated context
3. **Tool Access** → All tools validate scopes  
4. **Result Generation** → Return structured response
5. **Audit Logging** → Log operation for compliance

## Streaming Support

### Real-time Processing

For agents that support streaming (like debate engines):

```python
async def stream_analysis(self, user_id: str, consent_token: str):
    # Yield events for real-time updates
    yield {"event": "agent_start", "data": {...}}
    # Stream tokens from LLM
    async for token in stream_gemini_response(prompt):
        yield {"event": "agent_token", "data": {"text": token}}
    yield {"event": "agent_complete", "data": {...}}
```

## Testing Requirements

### Unit Tests

Each agent must have unit tests covering:
1. Agent initialization with correct parameters
2. Tool security validation
3. Consent token validation  
4. Error handling scenarios

### Integration Tests

Integration tests must verify:
1. Full agent workflow execution
2. A2A communication patterns
3. Streaming functionality (if applicable)
4. Security boundary enforcement

## Manifest Requirements

Every agent must have a proper manifest for A2A discovery:

```python
MANIFEST = {
    "agent_id": "agent_myagent",
    "name": "My Agent",
    "version": "1.0.0",
    "description": "Specialized agent for specific tasks",
    
    # Required consent scopes
    "required_scopes": [
        ConsentScope("agent.myagent.analyze"),
        ConsentScope("vault.read.data")
    ],
    
    # Optional scopes
    "optional_scopes": [
        ConsentScope("external.api.data")
    ],
    
    # Specialist agents (for complex systems)
    "specialists": [
        {
            "id": "subagent1",
            "name": "Sub Agent 1",
            "description": "Specialized sub-agent",
            "color": "#3b82f6"
        }
    ],
    
    # Capabilities
    "capabilities": {
        "on_device": True,
        "hybrid": True,
        "real_time": False,
        "historical": True
    }
}
```

## Performance Considerations

### Resource Management

1. **Memory Usage**: Avoid holding large data structures in memory
2. **Connection Pooling**: Reuse database and API connections where possible  
3. **Timeout Handling**: Implement proper timeouts for external calls
4. **Caching**: Use appropriate caching for expensive operations

### Scalability

1. **Async Operations**: Use async/await for I/O-bound operations
2. **Parallel Processing**: Leverage asyncio for concurrent operations
3. **Load Balancing**: Design agents to be stateless where possible

## Best Practices

### Code Organization

1. **Single Responsibility**: Each agent should have a clear, focused purpose
2. **Modular Design**: Break complex logic into smaller, reusable components  
3. **Clear Interfaces**: Use well-defined method signatures and return types
4. **Documentation**: Include docstrings for all public methods

### Error Handling

1. **Graceful Degradation**: Provide fallbacks when external services fail
2. **Meaningful Errors**: Return clear error messages to callers
3. **Logging**: Log all significant events and errors for debugging
4. **Security**: Never expose internal implementation details in error responses

### Security

1. **Never Bypass Validation**: All consent checks must be enforced
2. **Context Isolation**: Ensure context is properly isolated between agents
3. **Token Rotation**: Support for token refresh and rotation where applicable
4. **Audit Trail**: Log all operations that access user data

## Migration from Legacy Code

When migrating existing agents:

1. **Update Inheritance**: Change from direct `Agent` to `HushhAgent`
2. **Add Tool Decorators**: Wrap all data access with `@hushh_tool` 
3. **Update Manifest**: Ensure proper manifest metadata
4. **Validate Consent**: Add proper consent validation checks
5. **Test Thoroughly**: Verify all security boundaries work correctly

## Examples

### Simple Agent Implementation

```python
from hushh_mcp.agents.base_agent import HushhAgent
from hushh_mcp.tools.hushh_tools import hushh_tool

class SimpleAnalyzer(HushhAgent):
    def __init__(self):
        super().__init__(
            name="Simple Analyzer",
            model="gemini-3-flash",
            system_prompt="Analyze data with simple rules...",
            required_scopes=["agent.simple.analyze"]
        )
    
    @hushh_tool(scope="vault.read.data")
    def get_user_data(self, user_id: str):
        # Implementation here
        return {"user": user_id, "data": "sample"}
    
    async def analyze(self, user_id: str, consent_token: str, input_data: dict):
        data = self.get_user_data(user_id)
        # Process and return result
        return {"result": "processed", "data": data}
```

### Complex Agent with Streaming

```python
from hushh_mcp.agents.base_agent import HushhAgent
from hushh_mcp.tools.hushh_tools import hushh_tool

class StreamingAnalyzer(HushhAgent):
    def __init__(self):
        super().__init__(
            name="Streaming Analyzer",
            model="gemini-3-flash",
            system_prompt="Analyze data with streaming feedback...",
            required_scopes=["agent.streaming.analyze"]
        )
    
    @hushh_tool(scope="vault.read.data")
    def fetch_source_data(self, user_id: str):
        return {"source": "data"}
    
    async def stream_analysis(self, user_id: str, consent_token: str):
        # Send initial event
        yield {"event": "analysis_start", "data": {"user": user_id}}
        
        # Fetch data
        source_data = self.fetch_source_data(user_id)
        yield {"event": "data_fetched", "data": source_data}
        
        # Simulate streaming analysis
        for i in range(3):
            yield {"event": "processing_step", "data": {"step": i, "status": "running"}}
            await asyncio.sleep(0.1)  # Simulate processing
            
        yield {"event": "analysis_complete", "data": {"result": "success"}}
```

## Version Compatibility

All new agents must be compatible with:
1. Python 3.9+ 
2. Current ADK implementation
3. Hushh's consent protocol
4. A2A communication standards
5. Platform-specific requirements (web, iOS, Android)