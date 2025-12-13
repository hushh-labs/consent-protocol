# tests/test_intent_classifier.py

"""
Tests for Intent Classification Operon
"""

import pytest
from hushh_mcp.operons.intent_classifier import (
    classify_intent,
    get_domain_description,
    should_delegate,
    IntentDomain,
    DOMAIN_TO_AGENT
)


class TestIntentClassification:
    """Test intent classification logic."""
    
    def test_food_dining_intent(self):
        """Test food-related messages are classified correctly."""
        domain, agent, conf = classify_intent("I want to set my food preferences")
        
        assert domain == IntentDomain.FOOD_DINING
        assert agent == "agent_food_dining"
        assert conf >= 0.5
    
    def test_dietary_intent(self):
        """Test dietary restriction messages."""
        domain, agent, conf = classify_intent("I'm vegetarian and have a gluten allergy")
        
        assert domain == IntentDomain.FOOD_DINING
        assert agent == "agent_food_dining"
    
    def test_professional_intent(self):
        """Test professional/career messages."""
        domain, agent, conf = classify_intent("Update my resume with new skills")
        
        assert domain == IntentDomain.PROFESSIONAL
        assert agent == "agent_professional_profile"
    
    def test_finance_intent(self):
        """Test finance-related messages."""
        domain, agent, conf = classify_intent("Analyze my spending and expenses")
        
        assert domain == IntentDomain.FINANCE
        assert agent == "agent_finance"
    
    def test_general_intent(self):
        """Test general/unclear messages."""
        domain, agent, conf = classify_intent("Hello, how are you?")
        
        assert domain == IntentDomain.GENERAL
        assert agent == "agent_orchestrator"
        assert conf < 0.5
    
    def test_empty_message(self):
        """Test empty message handling."""
        domain, agent, conf = classify_intent("")
        
        assert domain == IntentDomain.UNKNOWN
        assert conf == 0.0
    
    def test_none_message(self):
        """Test None message handling."""
        domain, agent, conf = classify_intent(None)
        
        assert domain == IntentDomain.UNKNOWN


class TestDelegation:
    """Test delegation logic."""
    
    def test_should_delegate_food(self):
        """Test food domain should be delegated."""
        assert should_delegate(IntentDomain.FOOD_DINING) is True
    
    def test_should_delegate_professional(self):
        """Test professional domain should be delegated."""
        assert should_delegate(IntentDomain.PROFESSIONAL) is True
    
    def test_should_not_delegate_general(self):
        """Test general domain should not be delegated."""
        assert should_delegate(IntentDomain.GENERAL) is False
    
    def test_should_not_delegate_unknown(self):
        """Test unknown domain should not be delegated."""
        assert should_delegate(IntentDomain.UNKNOWN) is False


class TestDomainDescription:
    """Test domain description helpers."""
    
    def test_food_description(self):
        """Test food domain description."""
        desc = get_domain_description(IntentDomain.FOOD_DINING)
        assert "Food" in desc or "food" in desc
    
    def test_professional_description(self):
        """Test professional domain description."""
        desc = get_domain_description(IntentDomain.PROFESSIONAL)
        assert "Professional" in desc or "resume" in desc


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
