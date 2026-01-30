# A2A Implementation Guide

This document describes the implementation of Agent-to-Agent (A2A) communication within the Hushh system, following Google's ADK A2A protocol while maintaining the consent-first security model.

## Overview

The Hushh A2A implementation enables agents to communicate and collaborate across different services while maintaining strict security boundaries. All A2A communication is secured through:
1. Consent token validation
2. Agent card verification
3. Audit logging of all interactions

## Architecture

### A2A Server Structure

The `KaiA2AServer` class implements the core A2A functionality:

```python
from hushh_mcp.adk_bridge.kai_agent import KaiA2AServer

# Server initialization
server = KaiA2AServer(
    agent_card=agent_card,
    google_a2a_compatible=True
)
```

### Agent Cards

Agent cards define the metadata that enables A2A discovery and communication:

```python
from python_a2a.models.agent import AgentCard

agent_card = AgentCard(
    name="Agent Kai",
    version="1.0.0",
    description="Explainable investing copilot with 3-agent debate framework",
    url="http://localhost:8001",
    capabilities={
        "streaming": True,
        "on_device": True,
        "hybrid": True,
        "real_time": True,
        "historical": True
    },
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"]
)
```

## Security Model

### Consent Validation in A2A Context

All A2A requests must include a valid consent token in the `X-Consent-Token` header:

```python
# In A2A server handle_message method
consent_token = request.headers.get("X-Consent-Token")
valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)
```

### Token Scopes

A2A communication respects the same scope validation as internal agent calls:
- `agent.kai.analyze` - for analysis operations
- `vault.read.risk_profile` - for risk profile access  
- `vault.write.decision` - for decision storage

## Implementation Details

### Server Setup

The A2A server is configured in `server_a2a.py`:

```python
def create_app():
    # Create Flask app
    flask_app = Flask(__name__)
    
    # Generate Agent Card from manifest
    agent_card = AgentCard(
        name=MANIFEST["name"],
        version=MANIFEST["version"],
        description=MANIFEST["description"],
        url="http://localhost:8001",
        capabilities={
             "streaming": True,
             **{k: v for k, v in MANIFEST.get("capabilities", {}).items()}
        },
        default_input_modes=["text/plain"],
        default_output_modes=["text/plain"]
    )
    
    # Initialize server with agent card
    server = KaiA2AServer(
        agent_card=agent_card,
        google_a2a_compatible=True
    )
    
    # Bind routes
    server.setup_routes(flask_app)
    
    return flask_app
```

### Message Handling

The `handle_message` method processes incoming A2A messages:

```python
def handle_message(self, message: Message) -> Message:
    # Validate consent token from headers
    consent_token = request.headers.get("X-Consent-Token")
    
    # Validate token scope
    valid, reason, payload = validate_token(consent_token, ConsentScope.VAULT_OWNER)
    
    # Process with validated context
    result_text = self._run_analysis_pipeline(user_id, consent_token, ticker)
    
    return Message(
        content=TextContent(text=result_text),
        role=MessageRole.AGENT,
        parent_message_id=message.message_id,
        conversation_id=message.conversation_id
    )
```

## Usage Patterns

### Remote Agent Invocation

A remote agent can be invoked using the A2A protocol:

```bash
curl -X POST http://localhost:8001/api/agent/kai/analyze \
  -H "X-Consent-Token: HCT:..." \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}'
```

### Agent Discovery

Agents can be discovered through the A2A protocol using their agent cards:

```python
# Get agent information via A2A discovery
agent_info = {
    "name": "Agent Kai",
    "version": "1.0.0", 
    "description": "Investing copilot",
    "capabilities": {
        "streaming": True,
        "on_device": True
    }
}
```

## Integration with Consent Protocol

The A2A implementation integrates tightly with Hushh's consent system:

1. **Token Validation**: All A2A requests must provide a valid consent token
2. **Scope Enforcement**: Tokens are validated against required scopes 
3. **Audit Logging**: All A2A interactions are logged with operation details
4. **Context Preservation**: User context is maintained through the A2A chain

## Testing

A2A implementation should be tested with:
1. Unit tests for agent card generation
2. Integration tests for message handling
3. Security tests for token validation
4. End-to-end tests for agent-to-agent communication

## Migration from Legacy Implementation

The new A2A implementation:
1. Replaces the partial implementation in `server_a2a.py`
2. Adds proper agent card support with manifest metadata
3. Implements full A2A protocol compliance
4. Maintains compatibility with existing Hushh consent model

## Future Enhancements

1. **Bidirectional Streaming**: Support for real-time bidirectional communication
2. **Agent Clustering**: Support for agent groups and collaborative processing
3. **Security Auditing**: Enhanced audit logging and compliance features
4. **Performance Optimization**: Caching and connection pooling for high-volume scenarios