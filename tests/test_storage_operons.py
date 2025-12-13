# tests/test_storage_operons.py

"""
Tests for Food Storage Operons

Validates consent enforcement and encryption on write operations.
"""

import pytest
import json
from hushh_mcp.operons.food.storage import (
    store_dietary_restrictions,
    store_cuisine_preferences,
    store_monthly_budget,
    store_all_food_preferences
)
from hushh_mcp.consent.token import issue_token, revoke_token
from hushh_mcp.vault.encrypt import decrypt_data
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID


# Test data
TEST_USER_ID = UserID("test_user_storage_001")
TEST_VAULT_KEY = "a" * 64  # 64-char hex key


class TestStorageOperons:
    """Test storage operon consent enforcement."""
    
    def test_store_dietary_with_valid_token(self):
        """Test storing dietary restrictions with valid token."""
        # Issue valid token
        token = issue_token(
            user_id=TEST_USER_ID,
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_WRITE_FOOD,
            expires_in_ms=1000 * 60  # 1 minute
        )
        
        dietary = ["vegan", "gluten_free"]
        
        # Should succeed
        payload = store_dietary_restrictions(
            user_id=TEST_USER_ID,
            dietary_restrictions=dietary,
            vault_key_hex=TEST_VAULT_KEY,
            consent_token=token.token
        )
        
        # Verify we got encrypted payload
        assert payload.ciphertext is not None
        assert payload.iv is not None
        assert payload.tag is not None
        
        # Verify we can decrypt it
        decrypted = decrypt_data(payload, TEST_VAULT_KEY)
        assert json.loads(decrypted) == dietary
    
    def test_store_dietary_with_invalid_scope(self):
        """Test storing fails with wrong scope."""
        # Issue token with wrong scope
        token = issue_token(
            user_id=TEST_USER_ID,
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_READ_FOOD,  # Read, not write!
            expires_in_ms=1000 * 60
        )
        
        # Should fail
        with pytest.raises(PermissionError, match="Scope mismatch"):
            store_dietary_restrictions(
                user_id=TEST_USER_ID,
                dietary_restrictions=["vegan"],
                vault_key_hex=TEST_VAULT_KEY,
                consent_token=token.token
            )
    
    def test_store_dietary_with_wrong_user(self):
        """Test storing fails with user mismatch."""
        # Issue token for different user
        token = issue_token(
            user_id="different_user",
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_WRITE_FOOD,
            expires_in_ms=1000 * 60
        )
        
        # Should fail
        with pytest.raises(PermissionError, match="user mismatch"):
            store_dietary_restrictions(
                user_id=TEST_USER_ID,
                dietary_restrictions=["vegan"],
                vault_key_hex=TEST_VAULT_KEY,
                consent_token=token.token
            )
    
    def test_store_cuisine_preferences(self):
        """Test storing cuisine preferences."""
        token = issue_token(
            user_id=TEST_USER_ID,
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_WRITE_FOOD
        )
        
        cuisines = ["italian", "japanese", "thai"]
        
        payload = store_cuisine_preferences(
            user_id=TEST_USER_ID,
            cuisine_preferences=cuisines,
            vault_key_hex=TEST_VAULT_KEY,
            consent_token=token.token
        )
        
        decrypted = decrypt_data(payload, TEST_VAULT_KEY)
        assert json.loads(decrypted) == cuisines
    
    def test_store_budget_requires_finance_scope(self):
        """Test budget storage requires finance scope."""
        # Issue food scope token
        food_token = issue_token(
            user_id=TEST_USER_ID,
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_WRITE_FOOD
        )
        
        # Should fail - budget requires VAULT_WRITE_FINANCE
        with pytest.raises(PermissionError, match="Scope mismatch"):
            store_monthly_budget(
                user_id=TEST_USER_ID,
                budget_amount=500.0,
                vault_key_hex=TEST_VAULT_KEY,
                consent_token=food_token.token
            )
    
    def test_store_budget_with_correct_scope(self):
        """Test budget storage with correct scope."""
        token = issue_token(
            user_id=TEST_USER_ID,
            agent_id="agent_food_dining",
            scope=ConsentScope.VAULT_WRITE_FINANCE
        )
        
        budget = 750.50
        
        payload = store_monthly_budget(
            user_id=TEST_USER_ID,
            budget_amount=budget,
            vault_key_hex=TEST_VAULT_KEY,
            consent_token=token.token
        )
        
        decrypted = decrypt_data(payload, TEST_VAULT_KEY)
        assert json.loads(decrypted) == budget


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
