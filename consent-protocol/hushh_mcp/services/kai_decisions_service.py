# hushh_mcp/services/kai_decisions_service.py
"""
Kai Decisions Service
=====================

Service layer for vault_kai table (decision storage) operations.

This service handles Kai investment decisions that are stored
in the user's encrypted vault.

ARCHITECTURE:
    API Route → KaiDecisionsService → Supabase Client → Database

CONSENT-FIRST:
    All operations validate consent tokens before database access.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from db.supabase_client import get_supabase
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)


class ConsentValidationError(Exception):
    """Raised when consent validation fails."""
    def __init__(self, message: str, reason: str = "unknown"):
        super().__init__(message)
        self.reason = reason


class KaiDecisionsService:
    """
    Service layer for Kai decision operations.
    
    Handles CRUD for encrypted Kai decisions (vault_kai table).
    All operations require VAULT_OWNER or appropriate vault.read/write consent.
    """
    
    def __init__(self):
        self._supabase = None
    
    def _get_supabase(self):
        """Get Supabase client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_supabase()
        return self._supabase
    
    def _validate_consent(self, consent_token: str, user_id: str, operation: str = "access") -> None:
        """
        Validate consent token for Kai operations.
        
        Raises:
            ConsentValidationError: If validation fails
        """
        if not consent_token:
            raise ConsentValidationError(f"Missing consent token for {operation}", reason="missing_token")
        
        valid, reason, token_obj = validate_token(consent_token)
        
        if not valid or not token_obj:
            raise ConsentValidationError(f"Invalid consent token: {reason}", reason="invalid_token")
        
        # Accept VAULT_OWNER or vault.read.finance / vault.write.finance
        allowed_scopes = [
            ConsentScope.VAULT_OWNER.value,
            ConsentScope.VAULT_READ_FINANCE.value,
            ConsentScope.VAULT_WRITE_FINANCE.value
        ]
        
        if token_obj.scope not in allowed_scopes:
            raise ConsentValidationError(
                f"Insufficient scope: {token_obj.scope}. Required one of: {allowed_scopes}",
                reason="insufficient_scope"
            )
        
        if token_obj.user_id != user_id:
            raise ConsentValidationError(
                "Token user_id does not match requested user_id",
                reason="user_mismatch"
            )
        
        logger.debug(f"✅ Consent validated for {operation} (user={user_id})")
    
    async def store_decision(
        self,
        user_id: str,
        consent_token: str,
        ticker: str,
        decision_type: str,
        payload_ciphertext: str,
        payload_iv: str,
        payload_tag: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Store an encrypted Kai decision.
        
        Args:
            user_id: The user ID
            consent_token: Valid consent token
            ticker: The stock ticker
            decision_type: Type of decision (buy, sell, hold, etc.)
            payload_ciphertext: Encrypted decision payload
            payload_iv: Encryption IV
            payload_tag: Encryption auth tag
            metadata: Optional unencrypted metadata
            
        Returns:
            The decision ID
        """
        self._validate_consent(consent_token, user_id, "store_decision")
        
        supabase = self._get_supabase()
        
        now = datetime.now()
        data = {
            "user_id": user_id,
            "ticker": ticker,
            "decision_type": decision_type,
            "payload_ciphertext": payload_ciphertext,
            "payload_iv": payload_iv,
            "payload_tag": payload_tag,
            "metadata": metadata,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        response = supabase.table("vault_kai").insert(data).execute()
        
        if response.data and len(response.data) > 0:
            decision_id = response.data[0].get("id")
            logger.info(f"✅ Stored Kai decision {decision_id} for {ticker}")
            return decision_id
        
        raise Exception("Failed to store decision")
    
    async def get_decisions(
        self,
        user_id: str,
        consent_token: str,
        limit: int = 50,
        ticker: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get user's Kai decisions.
        
        Args:
            user_id: The user ID
            consent_token: Valid consent token
            limit: Maximum number of decisions to return
            ticker: Optional filter by ticker
            
        Returns:
            List of encrypted decisions
        """
        self._validate_consent(consent_token, user_id, "get_decisions")
        
        supabase = self._get_supabase()
        
        query = supabase.table("vault_kai")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(limit)
        
        if ticker:
            query = query.eq("ticker", ticker)
        
        response = query.execute()
        
        decisions = []
        for row in response.data or []:
            decisions.append({
                "id": row.get("id"),
                "ticker": row.get("ticker"),
                "decisionType": row.get("decision_type"),
                "payload": {
                    "ciphertext": row.get("payload_ciphertext"),
                    "iv": row.get("payload_iv"),
                    "tag": row.get("payload_tag")
                },
                "metadata": row.get("metadata"),
                "createdAt": row.get("created_at"),
                "updatedAt": row.get("updated_at")
            })
        
        logger.debug(f"Retrieved {len(decisions)} decisions for user {user_id}")
        return decisions
    
    async def get_decision_by_id(
        self,
        decision_id: int,
        consent_token: str,
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific decision by ID.
        
        Args:
            decision_id: The decision ID
            consent_token: Valid consent token
            user_id: The user ID (for consent validation)
            
        Returns:
            Decision dictionary or None if not found
        """
        self._validate_consent(consent_token, user_id, "get_decision")
        
        supabase = self._get_supabase()
        
        response = supabase.table("vault_kai")\
            .select("*")\
            .eq("id", decision_id)\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return None
        
        row = response.data[0]
        return {
            "id": row.get("id"),
            "ticker": row.get("ticker"),
            "decisionType": row.get("decision_type"),
            "payload": {
                "ciphertext": row.get("payload_ciphertext"),
                "iv": row.get("payload_iv"),
                "tag": row.get("payload_tag")
            },
            "metadata": row.get("metadata"),
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at")
        }
    
    async def delete_decision(
        self,
        decision_id: int,
        consent_token: str,
        user_id: str
    ) -> bool:
        """
        Delete a decision.
        
        Args:
            decision_id: The decision ID to delete
            consent_token: Valid consent token
            user_id: The user ID (for consent validation)
            
        Returns:
            True if deleted
        """
        self._validate_consent(consent_token, user_id, "delete_decision")
        
        supabase = self._get_supabase()
        
        response = supabase.table("vault_kai")\
            .delete()\
            .eq("id", decision_id)\
            .eq("user_id", user_id)\
            .execute()
        
        deleted = len(response.data) > 0 if response.data else False
        
        if deleted:
            logger.info(f"🗑️ Deleted Kai decision {decision_id}")
        
        return deleted
    
    async def get_decision_count(self, user_id: str, consent_token: str) -> int:
        """
        Get count of decisions for a user.
        
        Args:
            user_id: The user ID
            consent_token: Valid consent token
            
        Returns:
            Number of decisions
        """
        self._validate_consent(consent_token, user_id, "count_decisions")
        
        supabase = self._get_supabase()
        
        response = supabase.table("vault_kai")\
            .select("id", count="exact")\
            .eq("user_id", user_id)\
            .limit(0)\
            .execute()
        
        return response.count if hasattr(response, 'count') and response.count is not None else 0
