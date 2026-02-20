# hushh_mcp/services/vault_keys_service.py
"""
Vault Keys Service
==================

Service layer for vault_keys + vault_key_wrappers operations.

This service stores encrypted wrappers for the same vault DEK across enrolled
unlock methods (passphrase, biometric, passkey/PRF) plus recovery wrapper.
The backend never sees plaintext vault key material.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import text

from db.db_client import get_db

logger = logging.getLogger(__name__)

ALLOWED_METHODS = {
    "passphrase",
    "generated_default_native_biometric",
    "generated_default_web_prf",
}


class VaultKeysService:
    """Service layer for multi-wrapper vault key operations."""

    def __init__(self):
        self._supabase = None

    def _get_supabase(self):
        """Get database client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase

    @staticmethod
    def _mask_user_id(user_id: str) -> str:
        if not user_id:
            return "<unknown>"
        if len(user_id) <= 8:
            return user_id
        return f"{user_id[:4]}...{user_id[-4:]}"

    @staticmethod
    def _clean_text(value: Optional[str], *, allow_none: bool = False) -> Optional[str]:
        if value is None:
            return None if allow_none else ""
        cleaned = value.strip()
        lowered = cleaned.lower()
        if lowered in {"", "null", "undefined", "none"}:
            return None if allow_none else ""
        return cleaned

    @staticmethod
    def _clean_base64ish(value: Optional[str], *, allow_none: bool = False) -> Optional[str]:
        text = VaultKeysService._clean_text(value, allow_none=allow_none)
        if text is None:
            return None
        return "".join(text.split())

    @staticmethod
    def _normalize_method(method: Optional[str]) -> str:
        normalized = (VaultKeysService._clean_text(method) or "").lower()
        if normalized not in ALLOWED_METHODS:
            raise ValueError(f"Unsupported vault method: {method}")
        return normalized

    @classmethod
    def _normalize_wrapper(cls, wrapper: Dict[str, Any]) -> Dict[str, Any]:
        method = cls._normalize_method(wrapper.get("method"))
        encrypted_vault_key = cls._clean_base64ish(wrapper.get("encryptedVaultKey")) or ""
        salt = cls._clean_base64ish(wrapper.get("salt")) or ""
        iv = cls._clean_base64ish(wrapper.get("iv")) or ""

        if not encrypted_vault_key or not salt or not iv:
            raise ValueError(f"Wrapper for method '{method}' is missing required ciphertext fields")

        passkey_credential_id = cls._clean_text(wrapper.get("passkeyCredentialId"), allow_none=True)
        passkey_prf_salt = cls._clean_base64ish(wrapper.get("passkeyPrfSalt"), allow_none=True)

        if method == "generated_default_web_prf" and (
            not passkey_credential_id or not passkey_prf_salt
        ):
            raise ValueError(
                "generated_default_web_prf wrapper requires passkey credential metadata"
            )

        return {
            "method": method,
            "encrypted_vault_key": encrypted_vault_key,
            "salt": salt,
            "iv": iv,
            "passkey_credential_id": passkey_credential_id,
            "passkey_prf_salt": passkey_prf_salt,
        }

    async def check_vault_exists(self, user_id: str) -> bool:
        """Check if a vault exists for the user."""
        supabase = self._get_supabase()
        response = (
            supabase.table("vault_keys").select("user_id").eq("user_id", user_id).limit(1).execute()
        )
        return len(response.data) > 0 if response.data else False

    async def get_vault_state(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Return vault state with recovery wrapper and all enrolled method wrappers."""
        supabase = self._get_supabase()

        header_response = (
            supabase.table("vault_keys")
            .select(
                "vault_key_hash,primary_method,recovery_encrypted_vault_key,recovery_salt,recovery_iv"
            )
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not header_response.data or len(header_response.data) == 0:
            return None

        wrapper_response = (
            supabase.table("vault_key_wrappers")
            .select("method,encrypted_vault_key,salt,iv,passkey_credential_id,passkey_prf_salt")
            .eq("user_id", user_id)
            .execute()
        )

        header = header_response.data[0]
        wrappers: list[dict[str, Any]] = []
        for row in wrapper_response.data or []:
            wrappers.append(
                {
                    "method": self._clean_text(row.get("method")) or "passphrase",
                    "encryptedVaultKey": self._clean_base64ish(row.get("encrypted_vault_key"))
                    or "",
                    "salt": self._clean_base64ish(row.get("salt")) or "",
                    "iv": self._clean_base64ish(row.get("iv")) or "",
                    "passkeyCredentialId": self._clean_text(
                        row.get("passkey_credential_id"), allow_none=True
                    ),
                    "passkeyPrfSalt": self._clean_base64ish(
                        row.get("passkey_prf_salt"), allow_none=True
                    ),
                }
            )

        wrappers.sort(key=lambda item: item["method"])

        return {
            "vaultKeyHash": self._clean_base64ish(header.get("vault_key_hash")) or "",
            "primaryMethod": self._clean_text(header.get("primary_method")) or "passphrase",
            "recoveryEncryptedVaultKey": self._clean_base64ish(
                header.get("recovery_encrypted_vault_key")
            )
            or "",
            "recoverySalt": self._clean_base64ish(header.get("recovery_salt")) or "",
            "recoveryIv": self._clean_base64ish(header.get("recovery_iv")) or "",
            "wrappers": wrappers,
        }

    async def setup_vault_state(
        self,
        *,
        user_id: str,
        vault_key_hash: str,
        primary_method: str,
        recovery_encrypted_vault_key: str,
        recovery_salt: str,
        recovery_iv: str,
        wrappers: list[dict[str, Any]],
    ) -> bool:
        """Create/update vault state atomically by replacing wrappers in one DB transaction."""
        supabase = self._get_supabase()

        user_id_clean = (user_id or "").strip()
        if not user_id_clean:
            raise ValueError("userId is required")

        vault_key_hash_clean = self._clean_base64ish(vault_key_hash) or ""
        if not vault_key_hash_clean:
            raise ValueError("vaultKeyHash is required")

        primary = self._normalize_method(primary_method)

        normalized_wrappers = [self._normalize_wrapper(wrapper) for wrapper in wrappers]
        if not normalized_wrappers:
            raise ValueError("At least one wrapper is required")

        methods = [wrapper["method"] for wrapper in normalized_wrappers]
        unique_methods = set(methods)
        if len(methods) != len(unique_methods):
            raise ValueError("Duplicate wrapper methods are not allowed")

        if "passphrase" not in unique_methods:
            raise ValueError("Passphrase wrapper is mandatory")

        if primary not in unique_methods:
            raise ValueError("primaryMethod must be present in wrappers")

        recovery_encrypted = self._clean_base64ish(recovery_encrypted_vault_key) or ""
        recovery_salt_clean = self._clean_base64ish(recovery_salt) or ""
        recovery_iv_clean = self._clean_base64ish(recovery_iv) or ""
        if not recovery_encrypted or not recovery_salt_clean or not recovery_iv_clean:
            raise ValueError("Recovery wrapper fields are required")

        now_ms = int(datetime.now().timestamp() * 1000)

        key_data = {
            "user_id": user_id_clean,
            "vault_key_hash": vault_key_hash_clean,
            "primary_method": primary,
            "recovery_encrypted_vault_key": recovery_encrypted,
            "recovery_salt": recovery_salt_clean,
            "recovery_iv": recovery_iv_clean,
            "created_at": now_ms,
            "updated_at": now_ms,
        }
        wrapper_rows = [
            {
                "user_id": user_id_clean,
                "method": wrapper["method"],
                "encrypted_vault_key": wrapper["encrypted_vault_key"],
                "salt": wrapper["salt"],
                "iv": wrapper["iv"],
                "passkey_credential_id": wrapper["passkey_credential_id"],
                "passkey_prf_salt": wrapper["passkey_prf_salt"],
                "created_at": now_ms,
                "updated_at": now_ms,
            }
            for wrapper in normalized_wrappers
        ]

        with supabase.engine.begin() as conn:
            upsert_key_result = conn.execute(
                text(
                    """
                    INSERT INTO vault_keys (
                        user_id,
                        vault_key_hash,
                        primary_method,
                        recovery_encrypted_vault_key,
                        recovery_salt,
                        recovery_iv,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :user_id,
                        :vault_key_hash,
                        :primary_method,
                        :recovery_encrypted_vault_key,
                        :recovery_salt,
                        :recovery_iv,
                        :created_at,
                        :updated_at
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        vault_key_hash = EXCLUDED.vault_key_hash,
                        primary_method = EXCLUDED.primary_method,
                        recovery_encrypted_vault_key = EXCLUDED.recovery_encrypted_vault_key,
                        recovery_salt = EXCLUDED.recovery_salt,
                        recovery_iv = EXCLUDED.recovery_iv,
                        updated_at = EXCLUDED.updated_at
                    RETURNING user_id
                    """
                ),
                key_data,
            )
            if upsert_key_result.fetchone() is None:
                raise RuntimeError("Failed to upsert vault_keys row.")

            conn.execute(
                text("DELETE FROM vault_key_wrappers WHERE user_id = :user_id"),
                {"user_id": user_id_clean},
            )

            inserted_wrapper_count = 0
            for row in wrapper_rows:
                wrapper_result = conn.execute(
                    text(
                        """
                        INSERT INTO vault_key_wrappers (
                            user_id,
                            method,
                            encrypted_vault_key,
                            salt,
                            iv,
                            passkey_credential_id,
                            passkey_prf_salt,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :user_id,
                            :method,
                            :encrypted_vault_key,
                            :salt,
                            :iv,
                            :passkey_credential_id,
                            :passkey_prf_salt,
                            :created_at,
                            :updated_at
                        )
                        ON CONFLICT (user_id, method) DO UPDATE SET
                            encrypted_vault_key = EXCLUDED.encrypted_vault_key,
                            salt = EXCLUDED.salt,
                            iv = EXCLUDED.iv,
                            passkey_credential_id = EXCLUDED.passkey_credential_id,
                            passkey_prf_salt = EXCLUDED.passkey_prf_salt,
                            updated_at = EXCLUDED.updated_at
                        RETURNING method
                        """
                    ),
                    row,
                )
                if wrapper_result.fetchone() is None:
                    raise RuntimeError(f"Failed to insert wrapper method '{row['method']}'.")
                inserted_wrapper_count += 1

            if inserted_wrapper_count != len(wrapper_rows):
                raise RuntimeError(
                    "Inserted wrapper count mismatch "
                    f"({inserted_wrapper_count}/{len(wrapper_rows)})."
                )

        logger.info(
            "✅ Vault state setup for user %s (%s wrappers)",
            self._mask_user_id(user_id_clean),
            len(wrapper_rows),
        )
        return True

    async def upsert_wrapper(
        self,
        *,
        user_id: str,
        vault_key_hash: str,
        method: str,
        encrypted_vault_key: str,
        salt: str,
        iv: str,
        passkey_credential_id: Optional[str] = None,
        passkey_prf_salt: Optional[str] = None,
    ) -> bool:
        """Add or update a single wrapper for an existing vault state."""
        supabase = self._get_supabase()

        user_id_clean = (user_id or "").strip()
        if not user_id_clean:
            raise ValueError("userId is required")

        method_norm = self._normalize_method(method)
        vault_key_hash_clean = self._clean_base64ish(vault_key_hash) or ""
        if not vault_key_hash_clean:
            raise ValueError("vaultKeyHash is required")

        existing = (
            supabase.table("vault_keys")
            .select("vault_key_hash")
            .eq("user_id", user_id_clean)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise ValueError("Vault not found")

        existing_hash = self._clean_base64ish(existing.data[0].get("vault_key_hash")) or ""
        if existing_hash != vault_key_hash_clean:
            raise ValueError("vaultKeyHash mismatch")

        wrapper = self._normalize_wrapper(
            {
                "method": method_norm,
                "encryptedVaultKey": encrypted_vault_key,
                "salt": salt,
                "iv": iv,
                "passkeyCredentialId": passkey_credential_id,
                "passkeyPrfSalt": passkey_prf_salt,
            }
        )
        now_ms = int(datetime.now().timestamp() * 1000)

        data = {
            "user_id": user_id_clean,
            "method": wrapper["method"],
            "encrypted_vault_key": wrapper["encrypted_vault_key"],
            "salt": wrapper["salt"],
            "iv": wrapper["iv"],
            "passkey_credential_id": wrapper["passkey_credential_id"],
            "passkey_prf_salt": wrapper["passkey_prf_salt"],
            "created_at": now_ms,
            "updated_at": now_ms,
        }

        upsert_result = (
            supabase.table("vault_key_wrappers")
            .upsert(data, on_conflict="user_id,method")
            .execute()
        )
        if not upsert_result.data:
            raise RuntimeError(f"Wrapper upsert returned no rows for method '{method_norm}'.")

        logger.info(
            "✅ Upserted wrapper '%s' for user %s",
            method_norm,
            self._mask_user_id(user_id_clean),
        )
        return True

    async def set_primary_method(self, *, user_id: str, primary_method: str) -> bool:
        """Set default unlock method for UX prompt among enrolled wrappers."""
        supabase = self._get_supabase()
        user_id_clean = (user_id or "").strip()
        if not user_id_clean:
            raise ValueError("userId is required")

        primary = self._normalize_method(primary_method)

        wrapper_response = (
            supabase.table("vault_key_wrappers")
            .select("method")
            .eq("user_id", user_id_clean)
            .eq("method", primary)
            .limit(1)
            .execute()
        )
        if not wrapper_response.data:
            raise ValueError("Primary method must be an enrolled wrapper")

        now_ms = int(datetime.now().timestamp() * 1000)
        update_result = (
            supabase.table("vault_keys")
            .update({"primary_method": primary, "updated_at": now_ms})
            .eq("user_id", user_id_clean)
            .execute()
        )
        if not update_result.data:
            raise RuntimeError("Failed to set primary method; no vault row updated.")

        logger.info(
            "✅ Set primary method '%s' for user %s",
            primary,
            self._mask_user_id(user_id_clean),
        )
        return True

    async def get_vault_status(self, user_id: str, consent_token: str) -> Dict[str, Any]:
        """Get status for all vault domains."""
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

        kai_has_data = False
        kai_field_count = 0
        try:
            wm_response = (
                supabase.table("world_model_index_v2")
                .select("domain_summaries")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if wm_response.data:
                summaries = wm_response.data[0].get("domain_summaries") or {}
                kai_has_data = (
                    "financial" in summaries
                    or "kai_preferences" in summaries
                    or "kai_decisions" in summaries
                )
                prefs_summary = summaries.get("kai_preferences", {})
                kai_field_count = (
                    prefs_summary.get("field_count", 0) if isinstance(prefs_summary, dict) else 0
                )
        except Exception as e:  # pragma: no cover
            logger.warning(f"Failed to check world_model_index_v2 for vault status: {e}")

        domains = {
            "kai": {
                "hasData": kai_has_data,
                "onboarded": kai_has_data,
                "fieldCount": kai_field_count,
            }
        }

        total_active = 1 if kai_has_data else 0
        total = 1

        logger.info(f"✅ Vault status for {user_id}: {total_active}/{total} domains active")

        return {"domains": domains, "totalActive": total_active, "total": total}
