# hushh_mcp/services/user_investor_profile_db.py
"""
User Investor Profile Service
==============================

Service layer for user_investor_profiles table operations.

This service handles the PRIVATE, E2E encrypted investor profiles
that users create after confirming their identity.

ARCHITECTURE:
    API Route → UserInvestorProfileService → Supabase Client → Database

CONSENT-FIRST:
    All operations validate VAULT_OWNER consent tokens before database access.
    
Privacy Model:
    - investor_profiles: PUBLIC (unencrypted, from SEC filings)
    - user_investor_profiles: PRIVATE (E2E encrypted, consent required)
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from db.db_client import get_db
from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)


class ConsentValidationError(Exception):
    """Raised when consent validation fails."""
    def __init__(self, message: str, reason: str = "unknown"):
        super().__init__(message)
        self.reason = reason


class UserInvestorProfileService:
    """
    Service layer for user investor profile operations.
    
    Handles CRUD operations on user_investor_profiles table
    with strict consent validation.
    """
    
    def __init__(self):
        self._supabase = None
    
    def _get_supabase(self):
        """Get database client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase
    
    def _validate_vault_owner_token(self, token: str) -> str:
        """
        Validate VAULT_OWNER token and return user_id.
        
        Args:
            token: The consent token to validate
            
        Returns:
            user_id from the validated token
            
        Raises:
            ConsentValidationError: If validation fails
        """
        if not token:
            raise ConsentValidationError("Missing consent token", reason="missing_token")
        
        is_valid, error_msg, payload = validate_token(token)
        
        if not is_valid or not payload:
            raise ConsentValidationError(
                error_msg or "Invalid token",
                reason="invalid_token"
            )
        
        if payload.scope != ConsentScope.VAULT_OWNER.value:
            raise ConsentValidationError(
                f"VAULT_OWNER scope required, got: {payload.scope}",
                reason="insufficient_scope"
            )
        
        return payload.user_id
    
    async def get_status(self, consent_token: str) -> Dict[str, Any]:
        """
        Get user's identity confirmation status.
        
        Args:
            consent_token: Valid VAULT_OWNER token
            
        Returns:
            Dictionary with confirmation status
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        user_id = self._validate_vault_owner_token(consent_token)
        
        supabase = self._get_supabase()
        
        response = supabase.table("user_investor_profiles")\
            .select("confirmed_at,confirmed_investor_id")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return {"has_confirmed_identity": False}
        
        row = response.data[0]
        investor_id = row.get("confirmed_investor_id")
        
        # Get investor name/firm if we have an ID (import here to avoid circular)
        investor_name = None
        investor_firm = None
        if investor_id:
            from hushh_mcp.services.investor_db import InvestorDBService
            investor_service = InvestorDBService()
            investor = await investor_service.get_investor_by_id(investor_id)
            if investor:
                investor_name = investor.get("name")
                investor_firm = investor.get("firm")
        
        # Format confirmed_at
        confirmed_at = row.get("confirmed_at")
        if isinstance(confirmed_at, str):
            confirmed_at_str = confirmed_at
        else:
            confirmed_at_str = confirmed_at.isoformat() if hasattr(confirmed_at, 'isoformat') else str(confirmed_at) if confirmed_at else None
        
        return {
            "has_confirmed_identity": True,
            "confirmed_at": confirmed_at_str,
            "investor_name": investor_name,
            "investor_firm": investor_firm
        }
    
    async def get_profile(self, consent_token: str) -> Optional[Dict[str, Any]]:
        """
        Get user's encrypted investor profile.
        
        Args:
            consent_token: Valid VAULT_OWNER token
            
        Returns:
            Dictionary with encrypted profile data or None if not found
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        user_id = self._validate_vault_owner_token(consent_token)
        
        supabase = self._get_supabase()
        
        response = supabase.table("user_investor_profiles")\
            .select("*")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return None
        
        row = response.data[0]
        
        # Format confirmed_at
        confirmed_at = row.get("confirmed_at")
        if isinstance(confirmed_at, str):
            confirmed_at_str = confirmed_at
        else:
            confirmed_at_str = confirmed_at.isoformat() if hasattr(confirmed_at, 'isoformat') else str(confirmed_at) if confirmed_at else None
        
        return {
            "profile_data": {
                "ciphertext": row.get("profile_data_ciphertext"),
                "iv": row.get("profile_data_iv"),
                "tag": row.get("profile_data_tag")
            },
            "custom_holdings": {
                "ciphertext": row.get("custom_holdings_ciphertext"),
                "iv": row.get("custom_holdings_iv"),
                "tag": row.get("custom_holdings_tag")
            } if row.get("custom_holdings_ciphertext") else None,
            "preferences": {
                "ciphertext": row.get("preferences_ciphertext"),
                "iv": row.get("preferences_iv"),
                "tag": row.get("preferences_tag")
            } if row.get("preferences_ciphertext") else None,
            "confirmed_at": confirmed_at_str,
            "algorithm": row.get("algorithm")
        }
    
    async def create_or_update_profile(
        self,
        consent_token: str,
        investor_id: int,
        profile_data_ciphertext: str,
        profile_data_iv: str,
        profile_data_tag: str,
        custom_holdings_ciphertext: Optional[str] = None,
        custom_holdings_iv: Optional[str] = None,
        custom_holdings_tag: Optional[str] = None,
        preferences_ciphertext: Optional[str] = None,
        preferences_iv: Optional[str] = None,
        preferences_tag: Optional[str] = None
    ) -> int:
        """
        Create or update user's encrypted investor profile.
        
        Args:
            consent_token: Valid VAULT_OWNER token
            investor_id: ID of confirmed public investor profile
            profile_data_*: Encrypted profile data
            custom_holdings_*: Optional encrypted custom holdings
            preferences_*: Optional encrypted preferences
            
        Returns:
            The user_investor_profile ID
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        user_id = self._validate_vault_owner_token(consent_token)
        
        supabase = self._get_supabase()
        
        data = {
            "user_id": user_id,
            "confirmed_investor_id": investor_id,
            "profile_data_ciphertext": profile_data_ciphertext,
            "profile_data_iv": profile_data_iv,
            "profile_data_tag": profile_data_tag,
            "custom_holdings_ciphertext": custom_holdings_ciphertext,
            "custom_holdings_iv": custom_holdings_iv,
            "custom_holdings_tag": custom_holdings_tag,
            "preferences_ciphertext": preferences_ciphertext,
            "preferences_iv": preferences_iv,
            "preferences_tag": preferences_tag,
            "confirmed_at": datetime.now().isoformat(),
            "consent_scope": "vault.owner",
            "updated_at": datetime.now().isoformat()
        }
        
        # Upsert (insert or update on conflict)
        response = supabase.table("user_investor_profiles")\
            .upsert(data, on_conflict="user_id")\
            .execute()
        
        # Get the ID from response
        if response.data and len(response.data) > 0:
            profile_id = response.data[0].get("id")
            logger.info(f"✅ Created/updated user investor profile {profile_id} for user {user_id}")
            return profile_id
        
        # Fallback: fetch the ID
        fetch_response = supabase.table("user_investor_profiles")\
            .select("id")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if fetch_response.data:
            return fetch_response.data[0].get("id")
        
        raise Exception("Failed to create user investor profile")
    
    async def delete_profile(self, consent_token: str) -> bool:
        """
        Delete user's confirmed identity profile.
        
        Args:
            consent_token: Valid VAULT_OWNER token
            
        Returns:
            True if deleted successfully
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        user_id = self._validate_vault_owner_token(consent_token)
        
        supabase = self._get_supabase()
        
        response = supabase.table("user_investor_profiles")\
            .delete()\
            .eq("user_id", user_id)\
            .execute()
        
        deleted_count = len(response.data) if response.data else 0
        
        logger.info(f"🗑️ Deleted identity for user {user_id} (deleted: {deleted_count})")
        
        return True
