# hushh_mcp/services/account_service.py
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

IMPORTANT: This is a SYSTEM-LEVEL operation that bypasses consent validation
since it's deleting the entire user account including their vault.
"""

import logging
from typing import Any, Dict

from db.db_client import get_db
from hushh_mcp.services.world_model_service import WorldModelService

logger = logging.getLogger(__name__)


class AccountService:
    """
    Service for account-level operations.

    WARNING: This service performs SYSTEM-LEVEL cleanup that bypasses
    normal consent flows since the user is deleting their entire account.

    DEPRECATED TABLES REMOVED:
    - user_investor_profiles (identity confirmation via external services)
    - chat_conversations / chat_messages (chat functionality removed)
    - kai_sessions (session tracking removed)
    """

    def __init__(self):
        self._supabase = None
        self._world_model_service = None

    @property
    def supabase(self):
        """Get database client."""
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase

    @property
    def world_model_service(self) -> WorldModelService:
        """Get world model service (singleton)."""
        if self._world_model_service is None:
            from hushh_mcp.services.world_model_service import WorldModelService

            self._world_model_service = WorldModelService()
        return self._world_model_service

    async def delete_account(self, user_id: str) -> Dict[str, Any]:
        """
        Delete all user data across the system.

        This is a SYSTEM-LEVEL operation that deletes ALL user data including:
        1. World Model Data (Encrypted blob + Index)
        2. Encrypted Domain Attributes
        3. Vault Keys (The cryptographic erase - makes remaining data unrecoverable)
        4. FCM Push Tokens (if exists)

        DEPRECATED TABLES REMOVED:
        - user_investor_profiles (identity confirmation via external services)
        - chat_conversations / chat_messages (chat functionality removed)
        - kai_sessions (session tracking removed)

        Args:
            user_id: The user ID to delete

        Returns:
            Dict with status of deletion steps
        """
        logger.info(f"🚨 STARTING ACCOUNT DELETION for {user_id}")

        results = {
            "world_model_data": False,
            "world_model_index": False,
            "domain_attributes": False,
            "identity": True,  # Table removed - nothing to clean up
            "chat_messages": True,  # Tables removed - nothing to clean up
            "chat_conversations": True,  # Tables removed - nothing to clean up
            "kai_sessions": True,  # Table removed - nothing to clean up
            "vault_keys": False,
            "push_tokens": False,  # May not exist - handled gracefully
        }

        try:
            # 1. Delete world_model_data (encrypted blob)
            try:
                self.supabase.table("world_model_data").delete().eq("user_id", user_id).execute()
                results["world_model_data"] = True
                logger.info(f"✓ Deleted world_model_data for {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ world_model_data delete skipped or failed: {e}")

            # 2. Delete world_model_index_v2 (index/metadata)
            try:
                self.supabase.table("world_model_index_v2").delete().eq(
                    "user_id", user_id
                ).execute()
                results["world_model_index"] = True
                logger.info(f"✓ Deleted world_model_index_v2 for {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ world_model_index_v2 delete skipped or failed: {e}")

            # 3. world_model_attributes table removed – nothing to clean up
            results["domain_attributes"] = True
            logger.info(f"ℹ️ world_model_attributes table removed – skip for {user_id}")

            # 4. DELETE IDENTITY - REMOVED (no longer in use)
            # The user_investor_profiles table has been deprecated and removed.
            # Identity confirmation is now handled via external services.
            results["identity"] = True  # Mark as complete (nothing to clean up)

            # 5. CHAT & SESSION TABLES REMOVED - nothing to delete
            logger.info("ℹ️ Chat/Session tables already removed from database")

            # 6. Revoke all consent tokens (mark as revoked in audit log)
            try:
                self.supabase.table("consent_audit").update(
                    {
                        "revoked_at": "EXTRACT(EPOCH FROM NOW())::BIGINT",
                        "metadata": '{"revoked_reason": "account_deletion"}',
                    }
                ).eq("user_id", user_id).eq("revoked_at", None).execute()
                results["tokens_revoked"] = True
                logger.info(f"✓ Revoked consent tokens for {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ consent_audit update skipped or failed: {e}")

            # 7. Delete vault keys (CRITICAL: Makes any remaining data unrecoverable)
            try:
                self.supabase.table("vault_keys").delete().eq("user_id", user_id).execute()
                results["vault_keys"] = True
                logger.info(f"✓ Deleted vault_keys for {user_id}")
            except Exception as e:
                logger.error(f"❌ vault_keys deletion failed: {e}")

            # 8. Delete FCM push tokens (if table exists - gracefully handle if not)
            try:
                self.supabase.table("user_push_tokens").delete().eq("user_id", user_id).execute()
                results["push_tokens"] = True
                logger.info(f"✓ Deleted user_push_tokens for {user_id}")
            except Exception as e:
                # This is expected if table doesn't exist - FCM not implemented yet
                logger.info(f"ℹ️ FCM push tokens cleanup skipped (table may not exist): {e}")

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
