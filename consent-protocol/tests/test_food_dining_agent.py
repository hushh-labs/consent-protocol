# tests/test_food_dining_agent.py

"""
Tests for Food & Dining Agent

Validates consent enforcement, vault integration, and recommendation logic.
"""

import pytest
import time
import json
from hushh_mcp.agents.food_dining import HushhFoodDiningAgent
from hushh_mcp.consent.token import issue_token, revoke_token
from hushh_mcp.vault.encrypt import encrypt_data
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID

# Test data
TEST_USER_ID = UserID("test_user_123")
TEST_VAULT_KEY = "a" * 64  # 64-char hex key

TEST_RESTAURANTS = [
    {
        "name": "Vegan Paradise",
        "cuisine": "italian",
        "avg_price": 15,
        "tags": {"vegan", "organic"}
    },
    {
        "name": "Sushi Express",
        "cuisine": "japanese",
        "avg_price": 25,
        "tags": {"fish", "rice"}
    },
    {
        "name": "Cheap Eats",
        "cuisine": "american",
        "avg_price": 8,
        "tags": {"fast_food"}
    },
    {
        "name": "Fancy Steakhouse",
        "cuisine": "american",
        "avg_price": 60,
        "tags": {"meat", "expensive"}
    }
]


def test_agent_initialization():
    """Test agent can be initialized."""
    agent = HushhFoodDiningAgent()
    
    assert agent.agent_id == "agent_food_dining"
    assert agent.manifest is not None
    assert "restaurant_recommendations" in agent.manifest["capabilities"]


def test_consent_validation_success():
    """Test agent validates consent correctly."""
    agent = HushhFoodDiningAgent()
    
    # Issue valid token
    token = issue_token(
        user_id=TEST_USER_ID,
        agent_id=agent.agent_id,
        scope=ConsentScope.VAULT_READ_FINANCE,
        expires_in_ms=1000 * 60  # 1 minute
    )
    
    # Prepare encrypted vault data
    dietary_encrypted = encrypt_data(json.dumps(["vegan"]), TEST_VAULT_KEY)
    cuisine_encrypted = encrypt_data(json.dumps(["italian"]), TEST_VAULT_KEY)
    budget_encrypted = encrypt_data(json.dumps(600), TEST_VAULT_KEY)
    
    vault_data = {
        "dietary_restrictions": dietary_encrypted,
        "cuisine_preferences": cuisine_encrypted,
        "monthly_food_budget": budget_encrypted
    }
    
    # Should succeed
    recommendations = agent.get_restaurant_recommendations(
        user_id=TEST_USER_ID,
        consent_token=token.token,
        vault_key_hex=TEST_VAULT_KEY,
        user_vault_data=vault_data,
        restaurants=TEST_RESTAURANTS,
        max_results=3
    )
    
    assert len(recommendations) > 0
    assert recommendations[0]["name"] == "Vegan Paradise"  # Best match


def test_consent_validation_failure_expired():
    """Test agent rejects expired tokens."""
    agent = HushhFoodDiningAgent()
    
    # Issue token that expires immediately
    token = issue_token(
        user_id=TEST_USER_ID,
        agent_id=agent.agent_id,
        scope=ConsentScope.VAULT_READ_FINANCE,
        expires_in_ms=1  # 1ms
    )
    
    time.sleep(0.01)  # Wait for expiry
    
    vault_data = {
        "dietary_restrictions": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "cuisine_preferences": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "monthly_food_budget": encrypt_data(json.dumps(600), TEST_VAULT_KEY)
    }
    
    # Should fail
    with pytest.raises(PermissionError, match="Token expired"):
        agent.get_restaurant_recommendations(
            user_id=TEST_USER_ID,
            consent_token=token.token,
            vault_key_hex=TEST_VAULT_KEY,
            user_vault_data=vault_data,
            restaurants=TEST_RESTAURANTS
        )


def test_consent_validation_failure_revoked():
    """Test agent rejects revoked tokens."""
    agent = HushhFoodDiningAgent()
    
    token = issue_token(
        user_id=TEST_USER_ID,
        agent_id=agent.agent_id,
        scope=ConsentScope.VAULT_READ_FINANCE
    )
    
    # Revoke token
    revoke_token(token.token)
    
    vault_data = {
        "dietary_restrictions": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "cuisine_preferences": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "monthly_food_budget": encrypt_data(json.dumps(600), TEST_VAULT_KEY)
    }
    
    # Should fail
    with pytest.raises(PermissionError, match="revoked"):
        agent.get_restaurant_recommendations(
            user_id=TEST_USER_ID,
            consent_token=token.token,
            vault_key_hex=TEST_VAULT_KEY,
            user_vault_data=vault_data,
            restaurants=TEST_RESTAURANTS
        )


def test_dietary_restriction_filtering():
    """Test vegan diet filters out meat restaurants."""
    agent = HushhFoodDiningAgent()
    
    token = issue_token(
        user_id=TEST_USER_ID,
        agent_id=agent.agent_id,
        scope=ConsentScope.VAULT_READ_FINANCE
    )
    
    vault_data = {
        "dietary_restrictions": encrypt_data(json.dumps(["vegan"]), TEST_VAULT_KEY),
        "cuisine_preferences": encrypt_data(json.dumps(["american"]), TEST_VAULT_KEY),
        "monthly_food_budget": encrypt_data(json.dumps(1000), TEST_VAULT_KEY)
    }
    
    recommendations = agent.get_restaurant_recommendations(
        user_id=TEST_USER_ID,
        consent_token=token.token,
        vault_key_hex=TEST_VAULT_KEY,
        user_vault_data=vault_data,
        restaurants=TEST_RESTAURANTS
    )
    
    # Should exclude steakhouse (has meat tag)
    restaurant_names = [r["name"] for r in recommendations]
    assert "Fancy Steakhouse" not in restaurant_names
    assert "Vegan Paradise" in restaurant_names


def test_budget_filtering():
    """Test budget constraint filters expensive restaurants."""
    agent = HushhFoodDiningAgent()
    
    token = issue_token(
        user_id=TEST_USER_ID,
        agent_id=agent.agent_id,
        scope=ConsentScope.VAULT_READ_FINANCE
    )
    
    # Low budget: $300/month = ~$5/meal
    vault_data = {
        "dietary_restrictions": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "cuisine_preferences": encrypt_data(json.dumps([]), TEST_VAULT_KEY),
        "monthly_food_budget": encrypt_data(json.dumps(300), TEST_VAULT_KEY)
    }
    
    recommendations = agent.get_restaurant_recommendations(
        user_id=TEST_USER_ID,
        consent_token=token.token,
        vault_key_hex=TEST_VAULT_KEY,
        user_vault_data=vault_data,
        restaurants=TEST_RESTAURANTS
    )
    
    # Should only return cheap options
    for rec in recommendations:
        assert rec["avg_price"] <= 10  # Approximate budget check


def test_get_agent_info():
    """Test agent info endpoint."""
    agent = HushhFoodDiningAgent()
    
    info = agent.get_agent_info()
    
    assert info["agent_id"] == "agent_food_dining"
    assert info["status"] == "active"
    assert info["version"] == "1.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
