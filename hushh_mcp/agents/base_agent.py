"""
Hushh ADK Base Agent

The base class for all HUSHH-compliant agents.
It wraps the Google ADK patterns but injects our strict security loop.
"""

from typing import List, Optional, Dict, Any
import logging

try:
    # Try importing from google-adk if available in env
    from google.adk.agents import LlmAgent
    from google.adk.model import ModelClient
except ImportError:
    # Fallback/stub for development context where ADK might not be installed yet
    # or for defining the interface before linking
    class LlmAgent:
        def __init__(self, **kwargs): pass
        def run(self, **kwargs): pass
    class ModelClient:
        pass

from hushh_mcp.hushh_adk.context import HushhContext
from hushh_mcp.consent.token import validate_token

logger = logging.getLogger(__name__)

class HushhAgent(LlmAgent):
    """
    Secure Wrapper around Google ADK LlmAgent.
    
    Enforces:
    1. Consent Token Validation at Entry
    2. Context Injection for Tools
    3. Structured Logging
    """
    
    def __init__(
        self,
        name: str,
        model: Any, # ModelClient or string
        tools: List[Any] = [],
        system_prompt: str = "",
        required_scopes: List[str] = []
    ):
        """
        Initialize Secure Agent.
        
        Args:
            name: Agent identifier
            model: The LLM client (ADK ModelClient)
            tools: List of @hushh_tool decorated functions
            system_prompt: Core instruction
            required_scopes: List of scopes this agent MUST have to even start
        """
        self.hushh_name = name
        self.required_scopes = required_scopes
        
        # Initialize parent ADK agent with correct parameters
        super().__init__(
            model=model,
            tools=tools,
            system_instruction=system_prompt  # ADK uses 'system_instruction' not 'prompt'
        )
        
    def run(
        self, 
        prompt: str, 
        user_id: str, 
        consent_token: str,
        vault_keys: Dict[str, str] = {}
    ) -> Any:
        """
        Secure Execution Entry Point.
        
        Replaces standard .run() with one that requires Auth.
        """
        logger.info(f"🤖 Agent '{self.hushh_name}' invoked by {user_id}")
        
        # 1. Base Validation
        # Check if token allows accessing THIS agent
        is_valid = False
        last_reason = "No scopes defined"
        
        if not self.required_scopes:
            is_valid = True  # No specific agent-level scope needed, relying on tools
        else:
            for scope in self.required_scopes:
                valid, reason, _ = validate_token(consent_token, expected_scope=scope)
                if valid:
                    is_valid = True
                    break
                last_reason = reason
        
        if not is_valid:
            error_msg = f"⛔ Agent Access Denied: {last_reason}"
            logger.warning(error_msg)
            raise PermissionError(error_msg)
            
        # 2. Context Injection
        # We start a context block. All tools called by the LLM within super().run()
        # will be able to access this context via HushhContext.current()
        
        with HushhContext(user_id=user_id, consent_token=consent_token, vault_keys=vault_keys):
            try:
                # 3. Delegate to ADK LlmAgent with proper parameter passing
                response = super().run(input=prompt)
                return response
            except Exception as e:
                logger.error(f"💥 Agent Failure: {str(e)}")
                raise e