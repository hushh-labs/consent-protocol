# hushh_mcp/operons/food/storage.py

"""
Food Storage Operons

Write operons for storing food preferences in the vault with consent validation.
These operons are the building blocks for the agentic data collection flow.
"""

from typing import Dict, Any
import json

from hushh_mcp.consent.token import validate_token
from hushh_mcp.vault.encrypt import encrypt_data
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID, EncryptedPayload


def store_dietary_restrictions(
    user_id: UserID,
    dietary_restrictions: list[str],
    vault_key_hex: str,
    consent_token: str
) -> EncryptedPayload:
    """
    Store dietary restrictions in the vault.
    
    Args:
        user_id: User identifier
        dietary_restrictions: List of dietary restrictions (e.g., ["vegan", "gluten_free"])
        vault_key_hex: User's vault encryption key
        consent_token: Valid consent token with vault.write.food scope
        
    Returns:
        EncryptedPayload containing the encrypted data
        
    Raises:
        PermissionError: If consent validation fails
        
    Example:
        >>> payload = store_dietary_restrictions(
        ...     user_id="user_123",
        ...     dietary_restrictions=["vegan", "nut_free"],
        ...     vault_key_hex="abcd...",
        ...     consent_token="HCT:..."
        ... )
    """
    # Validate consent token
    valid, reason, token = validate_token(
        consent_token,
        expected_scope=ConsentScope.VAULT_WRITE_FOOD
    )
    
    if not valid:
        raise PermissionError(f"Consent validation failed: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch: expected {user_id}")
    
    # Serialize and encrypt
    plaintext = json.dumps(dietary_restrictions)
    return encrypt_data(plaintext, vault_key_hex)


def store_cuisine_preferences(
    user_id: UserID,
    cuisine_preferences: list[str],
    vault_key_hex: str,
    consent_token: str
) -> EncryptedPayload:
    """
    Store cuisine preferences in the vault.
    
    Args:
        user_id: User identifier
        cuisine_preferences: List of preferred cuisines (e.g., ["italian", "japanese"])
        vault_key_hex: User's vault encryption key
        consent_token: Valid consent token with vault.write.food scope
        
    Returns:
        EncryptedPayload containing the encrypted data
        
    Raises:
        PermissionError: If consent validation fails
    """
    valid, reason, token = validate_token(
        consent_token,
        expected_scope=ConsentScope.VAULT_WRITE_FOOD
    )
    
    if not valid:
        raise PermissionError(f"Consent validation failed: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch: expected {user_id}")
    
    plaintext = json.dumps(cuisine_preferences)
    return encrypt_data(plaintext, vault_key_hex)


def store_monthly_budget(
    user_id: UserID,
    budget_amount: float,
    vault_key_hex: str,
    consent_token: str
) -> EncryptedPayload:
    """
    Store monthly food budget in the vault.
    
    Args:
        user_id: User identifier
        budget_amount: Monthly budget in dollars
        vault_key_hex: User's vault encryption key
        consent_token: Valid consent token with vault.write.finance scope
        
    Returns:
        EncryptedPayload containing the encrypted data
        
    Raises:
        PermissionError: If consent validation fails
    """
    valid, reason, token = validate_token(
        consent_token,
        expected_scope=ConsentScope.VAULT_WRITE_FINANCE
    )
    
    if not valid:
        raise PermissionError(f"Consent validation failed: {reason}")
    
    if token.user_id != user_id:
        raise PermissionError(f"Token user mismatch: expected {user_id}")
    
    plaintext = json.dumps(budget_amount)
    return encrypt_data(plaintext, vault_key_hex)


def store_all_food_preferences(
    user_id: UserID,
    preferences: Dict[str, Any],
    vault_key_hex: str,
    food_consent_token: str,
    finance_consent_token: str
) -> Dict[str, EncryptedPayload]:
    """
    Store all food preferences in one call.
    
    Args:
        user_id: User identifier
        preferences: Dict containing dietary_restrictions, cuisine_preferences, monthly_budget
        vault_key_hex: User's vault encryption key
        food_consent_token: Token for vault.write.food scope
        finance_consent_token: Token for vault.write.finance scope
        
    Returns:
        Dict of scope -> EncryptedPayload
        
    Example:
        >>> result = store_all_food_preferences(
        ...     user_id="user_123",
        ...     preferences={
        ...         "dietary_restrictions": ["vegan"],
        ...         "cuisine_preferences": ["italian", "thai"],
        ...         "monthly_budget": 500.0
        ...     },
        ...     vault_key_hex="...",
        ...     food_consent_token="HCT:...",
        ...     finance_consent_token="HCT:..."
        ... )
    """
    result = {}
    
    # Store dietary restrictions
    if "dietary_restrictions" in preferences:
        result["dietary_restrictions"] = store_dietary_restrictions(
            user_id=user_id,
            dietary_restrictions=preferences["dietary_restrictions"],
            vault_key_hex=vault_key_hex,
            consent_token=food_consent_token
        )
    
    # Store cuisine preferences
    if "cuisine_preferences" in preferences:
        result["cuisine_preferences"] = store_cuisine_preferences(
            user_id=user_id,
            cuisine_preferences=preferences["cuisine_preferences"],
            vault_key_hex=vault_key_hex,
            consent_token=food_consent_token
        )
    
    # Store budget (requires finance scope)
    if "monthly_budget" in preferences:
        result["monthly_food_budget"] = store_monthly_budget(
            user_id=user_id,
            budget_amount=preferences["monthly_budget"],
            vault_key_hex=vault_key_hex,
            consent_token=finance_consent_token
        )
    
    return result
