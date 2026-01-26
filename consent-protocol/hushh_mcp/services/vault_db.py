# hushh_mcp/services/vault_db.py
"""
Vault Database Service
======================

Unified database service layer for agent-mediated vault access.

ARCHITECTURE:
    API Route → Agent → Tool → Operon → VaultDBService → Database

CONSENT-FIRST:
    All operations validate consent tokens before database access.
    No direct database queries should bypass this service.

BYOK (Bring Your Own Key):
    This service ONLY stores and retrieves ciphertext.
    Encryption/decryption happens client-side.
    The database and backend NEVER see plaintext user data.

Usage:
    from hushh_mcp.services.vault_db import VaultDBService
    
    service = VaultDBService()
    
    # Store encrypted data
    await service.store_encrypted_field(
        user_id="user_123",
        domain="food",
        field_name="dietary_restrictions",
        payload=encrypted_payload,
        consent_token="HCT:..."
    )
    
    # Retrieve encrypted data
    data = await service.get_encrypted_fields(
        user_id="user_123",
        domain="food",
        consent_token="HCT:..."
    )
"""

import logging
from typing import Dict, List, Optional, Any, Literal
from datetime import datetime

from hushh_mcp.types import EncryptedPayload
from hushh_mcp.consent.token import validate_token_with_db
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

# Domain to table mapping
DOMAIN_TABLES = {
    "food": "vault_food",
    "professional": "vault_professional",
    "kai_preferences": "vault_kai_preferences",
    "kai_decisions": "vault_kai_decisions",
}

# Domain to scope mapping
DOMAIN_READ_SCOPES = {
    "food": [ConsentScope.VAULT_READ_FOOD, ConsentScope.VAULT_OWNER],
    "professional": [ConsentScope.VAULT_READ_PROFESSIONAL, ConsentScope.VAULT_OWNER],
    "kai_preferences": [ConsentScope.VAULT_READ_FINANCE, ConsentScope.VAULT_OWNER],
    "kai_decisions": [ConsentScope.VAULT_READ_FINANCE, ConsentScope.VAULT_OWNER],
}

DOMAIN_WRITE_SCOPES = {
    "food": [ConsentScope.VAULT_WRITE_FOOD, ConsentScope.VAULT_OWNER],
    "professional": [ConsentScope.VAULT_WRITE_PROFESSIONAL, ConsentScope.VAULT_OWNER],
    "kai_preferences": [ConsentScope.VAULT_WRITE_FINANCE, ConsentScope.VAULT_OWNER],
    "kai_decisions": [ConsentScope.VAULT_WRITE_FINANCE, ConsentScope.VAULT_OWNER],
}


class ConsentValidationError(Exception):
    """Raised when consent validation fails."""
    def __init__(self, message: str, reason: str = "unknown"):
        super().__init__(message)
        self.reason = reason


class VaultDBService:
    """
    Unified database service for agent-mediated vault access.
    
    This service provides a single interface for all vault database operations,
    ensuring consistent consent validation and audit logging.
    """
    
    def __init__(self):
        self._pool = None
    
    async def _get_pool(self):
        """Get or create database connection pool."""
        if self._pool is None:
            import consent_db
            self._pool = await consent_db.get_pool()
        return self._pool
    
    async def _validate_consent(
        self,
        consent_token: str,
        user_id: str,
        required_scopes: List[ConsentScope],
        operation: str = "access"
    ) -> None:
        """
        Validate consent token for the requested operation.
        
        Args:
            consent_token: The HCT consent token
            user_id: The user ID making the request
            required_scopes: List of acceptable scopes (any match passes)
            operation: Description of the operation for logging
            
        Raises:
            ConsentValidationError: If validation fails
        """
        if not consent_token:
            raise ConsentValidationError(
                f"Missing consent token for {operation}",
                reason="missing_token"
            )
        
        # Validate token with DB revocation check
        valid, reason, token_obj = await validate_token_with_db(consent_token)
        
        if not valid:
            logger.warning(f"Invalid consent token for {operation}: {reason}")
            raise ConsentValidationError(
                f"Invalid consent token: {reason}",
                reason="invalid_token"
            )
        
        # Check scope
        token_scope = ConsentScope(token_obj.scope) if isinstance(token_obj.scope, str) else token_obj.scope
        if token_scope not in required_scopes:
            logger.warning(
                f"Insufficient scope for {operation}: {token_scope} not in {required_scopes}"
            )
            raise ConsentValidationError(
                f"Insufficient scope: {token_scope}. Required one of: {required_scopes}",
                reason="insufficient_scope"
            )
        
        # Check user ID matches
        if token_obj.user_id != user_id:
            logger.warning(
                f"User ID mismatch for {operation}: {token_obj.user_id} != {user_id}"
            )
            raise ConsentValidationError(
                "Token user ID does not match requested user ID",
                reason="user_mismatch"
            )
        
        logger.debug(f"✅ Consent validated for {operation} (user={user_id}, scope={token_scope})")
    
    async def _log_audit(
        self,
        user_id: str,
        action: str,
        domain: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log operation to audit trail."""
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO consent_audit (user_id, action, scope, details, timestamp)
                    VALUES ($1, $2, $3, $4, NOW())
                    """,
                    user_id,
                    action,
                    f"vault.{domain}",
                    str(details) if details else None
                )
        except Exception as e:
            # Don't fail the operation if audit logging fails
            logger.error(f"Failed to log audit: {e}")
    
    # =========================================================================
    # Read Operations
    # =========================================================================
    
    async def get_encrypted_fields(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"],
        consent_token: str,
        field_names: Optional[List[str]] = None
    ) -> Dict[str, EncryptedPayload]:
        """
        Retrieve encrypted fields from vault.
        
        Args:
            user_id: The user ID
            domain: The vault domain (food, professional, kai_preferences, kai_decisions)
            consent_token: Valid consent token with read scope
            field_names: Optional list of specific fields to retrieve
            
        Returns:
            Dictionary mapping field names to encrypted payloads
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        # Validate consent
        await self._validate_consent(
            consent_token=consent_token,
            user_id=user_id,
            required_scopes=DOMAIN_READ_SCOPES.get(domain, [ConsentScope.VAULT_OWNER]),
            operation=f"read_{domain}"
        )
        
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            if field_names:
                rows = await conn.fetch(
                    f"""
                    SELECT field_name, ciphertext, iv, tag, algorithm
                    FROM {table}
                    WHERE user_id = $1 AND field_name = ANY($2)
                    """,
                    user_id,
                    field_names
                )
            else:
                rows = await conn.fetch(
                    f"""
                    SELECT field_name, ciphertext, iv, tag, algorithm
                    FROM {table}
                    WHERE user_id = $1
                    """,
                    user_id
                )
        
        # Build result dictionary
        result = {}
        for row in rows:
            result[row["field_name"]] = EncryptedPayload(
                ciphertext=row["ciphertext"],
                iv=row["iv"],
                tag=row["tag"],
                algorithm=row["algorithm"] or "aes-256-gcm",
                encoding="base64"
            )
        
        logger.info(f"✅ Retrieved {len(result)} fields from {domain} for {user_id}")
        
        # Log audit
        await self._log_audit(
            user_id=user_id,
            action="READ",
            domain=domain,
            details={"field_count": len(result)}
        )
        
        return result
    
    # =========================================================================
    # Write Operations
    # =========================================================================
    
    async def store_encrypted_field(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"],
        field_name: str,
        payload: EncryptedPayload,
        consent_token: str
    ) -> bool:
        """
        Store an encrypted field in vault.
        
        Args:
            user_id: The user ID
            domain: The vault domain
            field_name: Name of the field to store
            payload: Encrypted payload (ciphertext, iv, tag)
            consent_token: Valid consent token with write scope
            
        Returns:
            True if stored successfully
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        # Validate consent
        await self._validate_consent(
            consent_token=consent_token,
            user_id=user_id,
            required_scopes=DOMAIN_WRITE_SCOPES.get(domain, [ConsentScope.VAULT_OWNER]),
            operation=f"write_{domain}"
        )
        
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            # Upsert - insert or update on conflict
            await conn.execute(
                f"""
                INSERT INTO {table} (user_id, field_name, ciphertext, iv, tag, algorithm, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (user_id, field_name)
                DO UPDATE SET
                    ciphertext = EXCLUDED.ciphertext,
                    iv = EXCLUDED.iv,
                    tag = EXCLUDED.tag,
                    algorithm = EXCLUDED.algorithm,
                    updated_at = NOW()
                """,
                user_id,
                field_name,
                payload.ciphertext,
                payload.iv,
                payload.tag,
                payload.algorithm
            )
        
        logger.info(f"✅ Stored {field_name} in {domain} for {user_id}")
        
        # Log audit
        await self._log_audit(
            user_id=user_id,
            action="WRITE",
            domain=domain,
            details={"field_name": field_name}
        )
        
        return True
    
    async def store_encrypted_fields(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"],
        fields: Dict[str, EncryptedPayload],
        consent_token: str
    ) -> int:
        """
        Store multiple encrypted fields in vault.
        
        Args:
            user_id: The user ID
            domain: The vault domain
            fields: Dictionary mapping field names to encrypted payloads
            consent_token: Valid consent token with write scope
            
        Returns:
            Number of fields stored
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        # Validate consent once for all fields
        await self._validate_consent(
            consent_token=consent_token,
            user_id=user_id,
            required_scopes=DOMAIN_WRITE_SCOPES.get(domain, [ConsentScope.VAULT_OWNER]),
            operation=f"write_{domain}"
        )
        
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        stored_count = 0
        pool = await self._get_pool()
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                for field_name, payload in fields.items():
                    await conn.execute(
                        f"""
                        INSERT INTO {table} (user_id, field_name, ciphertext, iv, tag, algorithm, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, NOW())
                        ON CONFLICT (user_id, field_name)
                        DO UPDATE SET
                            ciphertext = EXCLUDED.ciphertext,
                            iv = EXCLUDED.iv,
                            tag = EXCLUDED.tag,
                            algorithm = EXCLUDED.algorithm,
                            updated_at = NOW()
                        """,
                        user_id,
                        field_name,
                        payload.ciphertext,
                        payload.iv,
                        payload.tag,
                        payload.algorithm
                    )
                    stored_count += 1
        
        logger.info(f"✅ Stored {stored_count} fields in {domain} for {user_id}")
        
        # Log audit
        await self._log_audit(
            user_id=user_id,
            action="WRITE_BATCH",
            domain=domain,
            details={"field_count": stored_count, "fields": list(fields.keys())}
        )
        
        return stored_count
    
    # =========================================================================
    # Delete Operations
    # =========================================================================
    
    async def delete_encrypted_fields(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"],
        consent_token: str,
        field_names: Optional[List[str]] = None
    ) -> int:
        """
        Delete encrypted fields from vault.
        
        Args:
            user_id: The user ID
            domain: The vault domain
            consent_token: Valid consent token with write scope
            field_names: Optional list of specific fields to delete (None = delete all)
            
        Returns:
            Number of fields deleted
            
        Raises:
            ConsentValidationError: If consent validation fails
        """
        # Validate consent (write scope required for deletion)
        await self._validate_consent(
            consent_token=consent_token,
            user_id=user_id,
            required_scopes=DOMAIN_WRITE_SCOPES.get(domain, [ConsentScope.VAULT_OWNER]),
            operation=f"delete_{domain}"
        )
        
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            if field_names:
                result = await conn.execute(
                    f"""
                    DELETE FROM {table}
                    WHERE user_id = $1 AND field_name = ANY($2)
                    """,
                    user_id,
                    field_names
                )
            else:
                result = await conn.execute(
                    f"""
                    DELETE FROM {table}
                    WHERE user_id = $1
                    """,
                    user_id
                )
        
        # Parse "DELETE n" result
        deleted_count = int(result.split()[-1]) if result else 0
        
        logger.info(f"✅ Deleted {deleted_count} fields from {domain} for {user_id}")
        
        # Log audit
        await self._log_audit(
            user_id=user_id,
            action="DELETE",
            domain=domain,
            details={"deleted_count": deleted_count, "fields": field_names}
        )
        
        return deleted_count
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    async def check_vault_exists(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"]
    ) -> bool:
        """
        Check if user has any data in the specified vault domain.
        
        Note: This does NOT require consent as it only checks existence,
        not the actual encrypted data.
        """
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval(
                f"""
                SELECT COUNT(*) FROM {table}
                WHERE user_id = $1
                """,
                user_id
            )
        
        return count > 0
    
    async def get_field_names(
        self,
        user_id: str,
        domain: Literal["food", "professional", "kai_preferences", "kai_decisions"],
        consent_token: str
    ) -> List[str]:
        """
        Get list of field names stored for a user in a domain.
        
        Requires read consent.
        """
        await self._validate_consent(
            consent_token=consent_token,
            user_id=user_id,
            required_scopes=DOMAIN_READ_SCOPES.get(domain, [ConsentScope.VAULT_OWNER]),
            operation=f"list_{domain}"
        )
        
        table = DOMAIN_TABLES.get(domain)
        if not table:
            raise ValueError(f"Unknown domain: {domain}")
        
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT field_name FROM {table}
                WHERE user_id = $1
                """,
                user_id
            )
        
        return [row["field_name"] for row in rows]
