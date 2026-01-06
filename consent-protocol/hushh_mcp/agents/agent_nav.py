"""
Agent Nav - Universal Agent Base Class

Agent Nav is the organizational foundation for all Hushh agents.
It ensures consistent:
- Consent protocol enforcement
- Token validation
- User experience patterns
- Data security

All agents (Food, Professional, Kai) extend AgentNav.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

from hushh_mcp.consent.token import issue_token, validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID

logger = logging.getLogger(__name__)


class AgentManifest:
    """
    Standard agent manifest structure.
    
    Defines agent metadata and capabilities.
    """
    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str,
        version: str,
        required_scopes: List[ConsentScope]
    ):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.version = version
        self.required_scopes = required_scopes
    
    def to_dict(self) -> Dict[str, Any]:
        """Export manifest as dictionary."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "required_scopes": [s.value for s in self.required_scopes]
        }


class AgentNav(ABC):
    """
    Agent Nav - Universal Base Class for All Agents
    
    Provides:
    - Consent token validation before all actions
    - Standard manifest structure
    - Consistent error handling
    - Session state management
    - Audit logging
    
    Subclasses must implement:
    - _get_manifest() -> AgentManifest
    - _handle_action(action, user_id, consent_token, **kwargs) -> Dict
    
    Example:
        class KaiAgent(AgentNav):
            def _get_manifest(self):
                return AgentManifest(
                    agent_id="agent_kai",
                    name="Kai Investment Analyst",
                    ...
                )
            
            def _handle_action(self, action, user_id, consent_token, **kwargs):
                if action == "analyze":
                    return self._analyze_stock(...)
    """
    
    def __init__(self):
        self.manifest = self._get_manifest()
        self.logger = logging.getLogger(self.manifest.agent_id)
        self.logger.info(f"🔷 {self.manifest.name} initialized via Agent Nav")
    
    @abstractmethod
    def _get_manifest(self) -> AgentManifest:
        """
        Define agent metadata.
        
        Must be implemented by subclass.
        
        Returns:
            AgentManifest with agent details
        """
        pass
    
    @abstractmethod
    def _handle_action(
        self,
        action: str,
        user_id: UserID,
        consent_token: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Execute agent-specific action.
        
        This method is called AFTER consent validation.
        
        Args:
            action: Action name (e.g., "recommend", "analyze")
            user_id: User identifier
            consent_token: Valid consent token
            **kwargs: Action-specific parameters
        
        Returns:
            Action result dictionary
        
        Raises:
            ValueError: If action unknown or parameters invalid
        """
        pass
    
    def validate_consent(
        self,
        consent_token: str,
        required_scope: ConsentScope,
        user_id: Optional[UserID] = None
    ) -> tuple[bool, str, Any]:
        """
        Validate consent token for action.
        
        Args:
            consent_token: Token to validate
            required_scope: Required ConsentScope
            user_id: Optional user ID to verify match
        
        Returns:
            (is_valid, reason, parsed_token)
        
        Raises:
            PermissionError: If validation fails
        """
        valid, reason, parsed = validate_token(
            consent_token,
            expected_scope=required_scope
        )
        
        if not valid:
            self.logger.warning(f"❌ Token validation failed: {reason}")
            raise PermissionError(f"Consent denied: {reason}")
        
        # Verify user match if provided
        if user_id and parsed.user_id != user_id:
            self.logger.warning(
                f"❌ User ID mismatch: {user_id} != {parsed.user_id}"
            )
            raise PermissionError("Token user ID mismatch")
        
        self.logger.info(f"✅ Consent validated for {required_scope.value}")
        return valid, reason, parsed
    
    def issue_consent_token(
        self,
        user_id: UserID,
        scope: ConsentScope,
        expires_in_ms: Optional[int] = None
    ) -> Any:
        """
        Issue consent token for user.
        
        Args:
            user_id: User to issue token for
            scope: ConsentScope to grant
            expires_in_ms: Optional custom expiry (default: 7 days)
        
        Returns:
            HushhConsentToken object
        """
        token = issue_token(
            user_id=user_id,
            agent_id=self.manifest.agent_id,
            scope=scope,
            expires_in_ms=expires_in_ms
        )
        
        self.logger.info(
            f"🔐 Issued token for {user_id}: "
            f"{scope.value} (expires: {token.expires_at})"
        )
        
        return token
    
    def handle_with_consent(
        self,
        action: str,
        user_id: UserID,
        consent_token: str,
        required_scope: ConsentScope,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Execute action with consent validation.
        
        This is the main entry point for all agent actions.
        Validates consent BEFORE executing action.
        
        Args:
            action: Action to perform
            user_id: User identifier
            consent_token: Valid consent token
            required_scope: Required scope for action
            **kwargs: Action-specific parameters
        
        Returns:
            Action result
        
        Raises:
            PermissionError: If consent invalid
            ValueError: If action invalid
        """
        # Step 1: Validate consent
        self.validate_consent(consent_token, required_scope, user_id)
        
        # Step 2: Execute action
        try:
            result = self._handle_action(
                action=action,
                user_id=user_id,
                consent_token=consent_token,
                **kwargs
            )
            
            self.logger.info(
                f"✅ Action '{action}' completed for {user_id}"
            )
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Action '{action}' failed: {e}")
            raise
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get agent manifest as dictionary."""
        return self.manifest.to_dict()
