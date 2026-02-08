# consent-protocol/hushh_mcp/services/account_service.py
"""
Account Service
===============

Service layer for account management operations.

Key Responsibilities:
- Account Deletion (Orchestrating cleanup across all services)
- Data Export (Aggregating data from all services)
- Account Status

Architecture:
- Coordinates between VaultKeysService, WorldModelService, UserInvestorProfileService, etc.
- Ensures atomic-like cleanup (best effort)
"""

import logging
import asyncio
from typing import Dict, Any

from hushh_mcp.services.vault_keys_service import VaultKeysService
from hushh_mcp.services.world_model_service import WorldModelService
from hushh_mcp.services.user_investor_profile_db import UserInvestorProfileService
from hushh_mcp.services.chat_db_service import ChatDBService
from db.db_client import get_db

logger = logging.getLogger(__name__)

class AccountService:
    """
    Service for account-level operations.
    """
    
    def __init__(self):
        self.vault_service = VaultKeysService()
        self.world_model_service = WorldModelService()
        self.profile_service = UserInvestorProfileService()
        self.chat_service = ChatDBService()
        self.supabase = get_db()
        
    async def delete_account(self, user_id: str) -> Dict[str, Any]:
        """
        Delete all user data across the system.
        
        Steps:
        1. Delete World Model Data (Encrypted blob + Index)
        2. Delete Identity (User Investor Profile)
        3. Delete Chat History
        4. Delete Vault Keys (The cryptographic erase)
        5. Revoke all tokens (via consent_tokens table)
        6. Clean up audit logs (optional, usually kept for compliance but anonymized)
        
        Args:
            user_id: The user ID to delete
            
        Returns:
            Dict with status of deletion steps
        """
        logger.info(f"🚨 STARTING ACCOUNT DELETION for {user_id}")
        
        results = {
            "world_model": False,
            "identity": False,
            "chat": False,
            "tokens": False,
            "vault": False
        }
        
        try:
            # 1. World Model
            results["world_model"] = await self.world_model_service.delete_user_data(user_id)
            
            # 2. Identity
            # We don't have a direct delete method in profile service that accepts user_id only (usually needs token)
            # But we can use direct DB access here as this is a system-level cleanup
            try:
                self.supabase.table("user_investor_profiles").delete().eq("user_id", user_id).execute()
                results["identity"] = True
            except Exception as e:
                logger.error(f"Failed to delete identity: {e}")
            
            # 3. Chat History
            # Similarly, direct cleanup if service doesn't expose it
            try:
                self.supabase.table("chat_messages").delete().eq("user_id", user_id).execute()
                self.supabase.table("chat_conversations").delete().eq("user_id", user_id).execute()
                results["chat"] = True
            except Exception as e:
                logger.error(f"Failed to delete chat: {e}")
                
            # 4. Tokens (Revoke all)
            try:
                self.supabase.table("consent_tokens").delete().eq("user_id", user_id).execute()
                results["tokens"] = True
            except Exception as e:
                logger.error(f"Failed to delete tokens: {e}")
                
            # 5. Vault Keys (CRITICAL: This makes any remaining data unrecoverable)
            try:
                self.supabase.table("vault_keys").delete().eq("user_id", user_id).execute()
                results["vault"] = True
            except Exception as e:
                logger.error(f"Failed to delete vault keys: {e}")
                
            logger.info(f"✅ ACCOUNT DELETED for {user_id}. Results: {results}")
            return {"success": True, "details": results}
            
        except Exception as e:
            logger.error(f"❌ Account deletion failed for {user_id}: {e}")
            return {"success": False, "error": str(e), "details": results}

    async def export_data(self, user_id: str) -> Dict[str, Any]:
        """
        Export all user data.
        
        Returns a dictionary containing:
        - Vault Keys (Encrypted)
        - World Model Index
        - World Model Data (Encrypted)
        - Identity (Encrypted)
        """
        # TODO: Implement full export if needed. 
        # For now, we reuse the existing specific export endpoints.
        pass
