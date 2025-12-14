# hushh_mcp/operons/food/flexible_storage.py

"""
Flexible Storage Operons

Stores dynamic/custom user data with consent validation.
Uses scope-based naming: {domain}.custom.{key}
"""

from typing import Any
import json

from hushh_mcp.consent.token import validate_token
from hushh_mcp.vault.encrypt import encrypt_data
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID, EncryptedPayload


def store_custom_preference(
    user_id: UserID,
    domain: str,
    key: str,
    value: Any,
    vault_key_hex: str,
    consent_token: str
) -> EncryptedPayload:
    """
    Store a custom preference with flexible key-value structure.
    
    Args:
        user_id: User identifier
        domain: Data domain (e.g., "food", "professional")
        key: Custom field key (e.g., "allergies", "seating_preference")
        value: Any JSON-serializable value
        vault_key_hex: User's vault encryption key
        consent_token: Valid consent token with appropriate write scope
        
    Returns:
        EncryptedPayload for storage
        
    Example:
        >>> payload = store_custom_preference(
        ...     user_id="user_123",
        ...     domain="food",
        ...     key="specific_allergies",
        ...     value={"shellfish": True, "severity": "high"},
        ...     vault_key_hex="...",
        ...     consent_token="HCT:..."
        ... )
        >>> # Stored with scope: "food.custom.specific_allergies"
    """
    # Determine expected scope based on domain
    scope_map = {
        "food": ConsentScope.VAULT_WRITE_FOOD,
        "professional": ConsentScope.VAULT_WRITE_PREFERENCES,
        "finance": ConsentScope.VAULT_WRITE_FINANCE,
    }
    expected_scope = scope_map.get(domain, ConsentScope.VAULT_WRITE_PREFERENCES)
    
    # Validate consent token
    valid, reason, token = validate_token(consent_token, expected_scope=expected_scope)
    
    if not valid:
        raise PermissionError(f"Consent validation failed: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch: expected {user_id}")
    
    # Serialize value to JSON if not string
    if isinstance(value, str):
        plaintext = value
    else:
        plaintext = json.dumps(value)
    
    return encrypt_data(plaintext, vault_key_hex)


def build_custom_scope(domain: str, key: str) -> str:
    """
    Build the scope string for custom data.
    
    Args:
        domain: Data domain (e.g., "food", "professional")
        key: Custom field key
        
    Returns:
        Scope string like "food.custom.allergies"
    """
    # Sanitize key: lowercase, replace spaces with underscores
    safe_key = key.lower().replace(" ", "_").replace("-", "_")
    return f"{domain}.custom.{safe_key}"


def parse_custom_value(encrypted_payload: EncryptedPayload, vault_key_hex: str) -> Any:
    """
    Decrypt and parse custom preference value.
    
    Args:
        encrypted_payload: The encrypted data
        vault_key_hex: User's vault key
        
    Returns:
        Parsed Python object (could be dict, list, string, number)
    """
    from hushh_mcp.vault.encrypt import decrypt_data
    
    decrypted = decrypt_data(encrypted_payload, vault_key_hex)
    
    # Try to parse as JSON, fallback to string
    try:
        return json.loads(decrypted)
    except json.JSONDecodeError:
        return decrypted
