# hushh_mcp/services/vault_keys_service.py
"""
Vault Keys Service
==================

Service layer for vault_keys table operations.

This service handles the encrypted vault key storage - the keys
that protect user vault data. The actual vault key is encrypted
with the user's passphrase BEFORE being sent to this service.

ARCHITECTURE:
    API Route → VaultKeysService → Supabase Client → Database

BYOK (Bring Your Own Key):
    This service ONLY stores encrypted vault keys.
    Decryption happens client-side with user's passphrase.
    The backend NEVER sees the plaintext vault key.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from db.db_client import get_db

logger = logging.getLogger(__name__)


class VaultKeysService:
    """
    Service layer for vault key operations.
    
    Handles CRUD for encrypted vault keys (vault_keys table).
    """
    
    def __init__(self):
        self._supabase = None
    
    def _get_supabase(self):
        """Get database client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase
    
    async def check_vault_exists(self, user_id: str) -> bool:
        """
        Check if a vault exists for the user.
        
        Args:
            user_id: The user ID to check
            
        Returns:
            True if vault exists, False otherwise
        """
        supabase = self._get_supabase()
        
        response = supabase.table("vault_keys")\
            .select("user_id")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        return len(response.data) > 0 if response.data else False
    
    async def get_vault_key(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get encrypted vault key data for the user.
        
        Returns the encrypted vault key (still encrypted with user's passphrase).
        Decryption happens client-side.
        
        Args:
            user_id: The user ID
            
        Returns:
            Dictionary with vault key data or None if not found
        """
        supabase = self._get_supabase()
        
        response = supabase.table("vault_keys")\
            .select("auth_method,encrypted_vault_key,salt,iv,recovery_encrypted_vault_key,recovery_salt,recovery_iv")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return None
        
        row = response.data[0]
        return {
            "authMethod": row.get("auth_method"),
            "encryptedVaultKey": row.get("encrypted_vault_key"),
            "salt": row.get("salt"),
            "iv": row.get("iv"),
            "recoveryEncryptedVaultKey": row.get("recovery_encrypted_vault_key"),
            "recoverySalt": row.get("recovery_salt"),
            "recoveryIv": row.get("recovery_iv")
        }
    
    async def setup_vault(
        self,
        user_id: str,
        auth_method: str,
        encrypted_vault_key: str,
        salt: str,
        iv: str,
        recovery_encrypted_vault_key: str,
        recovery_salt: str,
        recovery_iv: str
    ) -> bool:
        """
        Store encrypted vault key data.
        
        The vault key is already encrypted locally with the user's passphrase.
        This just stores the encrypted blob in the database.
        
        Args:
            user_id: The user ID
            auth_method: Authentication method (e.g., "passphrase")
            encrypted_vault_key: The encrypted vault key
            salt: Salt used for key derivation
            iv: Initialization vector
            recovery_encrypted_vault_key: Recovery key (encrypted)
            recovery_salt: Recovery salt
            recovery_iv: Recovery IV
            
        Returns:
            True if successful
        """
        supabase = self._get_supabase()
        
        now_ms = int(datetime.now().timestamp() * 1000)
        data = {
            "user_id": user_id,
            "auth_method": auth_method,
            "encrypted_vault_key": encrypted_vault_key,
            "salt": salt,
            "iv": iv,
            "recovery_encrypted_vault_key": recovery_encrypted_vault_key,
            "recovery_salt": recovery_salt,
            "recovery_iv": recovery_iv,
            "created_at": now_ms,
            "updated_at": now_ms
        }
        
        supabase.table("vault_keys").upsert(
            data,
            on_conflict="user_id"
        ).execute()
        
        logger.info(f"✅ Vault setup for user {user_id[:8]}...")
        return True
    
    async def get_vault_status(
        self,
        user_id: str,
        consent_token: str
    ) -> Dict[str, Any]:
        """
        Get status for all vault domains.
        
        Requires VAULT_OWNER consent token.
        
        Args:
            user_id: The user ID
            consent_token: VAULT_OWNER consent token
            
        Returns:
            Dictionary with domain status information
        """
        # Validate consent token
        from hushh_mcp.consent.token import validate_token
        from hushh_mcp.constants import ConsentScope
        
        valid, reason, token_obj = validate_token(consent_token)
        
        if not valid:
            raise ValueError(f"Invalid consent token: {reason}")
        
        if token_obj.scope != ConsentScope.VAULT_OWNER.value:
            raise ValueError(f"VAULT_OWNER scope required, got: {token_obj.scope}")
        
        if token_obj.user_id != user_id:
            raise ValueError("Token user_id does not match requested user_id")
        
        supabase = self._get_supabase()
        
        # Check world_model_index_v2 for Kai domain data instead of
        # deprecated user_investor_profiles / vault_kai_preferences tables
        kai_has_data = False
        kai_field_count = 0
        try:
            wm_response = supabase.table("world_model_index_v2")\
                .select("domain_summaries")\
                .eq("user_id", user_id)\
                .limit(1)\
                .execute()
            if wm_response.data:
                summaries = wm_response.data[0].get("domain_summaries") or {}
                kai_has_data = (
                    "financial" in summaries
                    or "kai_preferences" in summaries
                    or "kai_decisions" in summaries
                )
                prefs_summary = summaries.get("kai_preferences", {})
                kai_field_count = prefs_summary.get("field_count", 0) if isinstance(prefs_summary, dict) else 0
        except Exception as e:
            logger.warning(f"Failed to check world_model_index_v2 for vault status: {e}")
        
        domains = {
            "kai": {
                "hasData": kai_has_data,
                "onboarded": kai_has_data,
                "fieldCount": kai_field_count
            }
        }
        
        total_active = 1 if kai_has_data else 0
        total = 1
        
        logger.info(f"✅ Vault status for {user_id}: {total_active}/{total} domains active")
        
        return {
            "domains": domains,
            "totalActive": total_active,
            "total": total
        }
    
    async def get_onboarding_status(self, user_id: str) -> bool:
        """
        Check if user has completed onboarding tour.
        
        Args:
            user_id: The user ID
            
        Returns:
            True if onboarding completed, False otherwise
        """
        supabase = self._get_supabase()
        
        response = supabase.table("vault_keys")\
            .select("onboarding_completed")\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return False
        
        return response.data[0].get("onboarding_completed", False)
    
    async def complete_onboarding(self, user_id: str) -> bool:
        """
        Mark user's onboarding as complete.
        
        Args:
            user_id: The user ID
            
        Returns:
            True if successful
        """
        supabase = self._get_supabase()
        
        result = supabase.table("vault_keys")\
            .update({"onboarding_completed": True})\
            .eq("user_id", user_id)\
            .execute()
        
        if result.count == 0:
            logger.warning(f"⚠️ Onboarding complete attempted for {user_id} but NO ROW UPDATED. User ID mismatch?")
            return False
            
        logger.info(f"✅ Onboarding marked complete for user {user_id[:8]} (Rows updated: {result.count})")
        return True
