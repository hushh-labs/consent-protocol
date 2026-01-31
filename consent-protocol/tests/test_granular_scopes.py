# consent-protocol/tests/test_granular_scopes.py
"""
Tests for granular consent scopes.
"""

from hushh_mcp.constants import ConsentScope


class TestGranularScopes:
    """Test suite for granular consent scopes."""

    def test_vault_owner_scope_exists(self):
        """Test that VAULT_OWNER scope exists."""
        assert ConsentScope.VAULT_OWNER.value == "vault.owner"

    def test_financial_attribute_scopes(self):
        """Test financial attribute scopes."""
        financial_scopes = ConsentScope.financial_scopes()
        
        assert len(financial_scopes) == 4
        assert ConsentScope.ATTR_FINANCIAL_RISK_PROFILE in financial_scopes
        assert ConsentScope.ATTR_FINANCIAL_HOLDINGS in financial_scopes
        assert ConsentScope.ATTR_FINANCIAL_PERFORMANCE in financial_scopes
        assert ConsentScope.ATTR_FINANCIAL_DECISIONS in financial_scopes

    def test_lifestyle_attribute_scopes(self):
        """Test lifestyle attribute scopes."""
        lifestyle_scopes = ConsentScope.lifestyle_scopes()
        
        assert len(lifestyle_scopes) == 3
        assert ConsentScope.ATTR_LIFESTYLE_INTERESTS in lifestyle_scopes
        assert ConsentScope.ATTR_LIFESTYLE_SPENDING in lifestyle_scopes
        assert ConsentScope.ATTR_LIFESTYLE_LOCATIONS in lifestyle_scopes

    def test_portfolio_scopes(self):
        """Test portfolio operation scopes."""
        assert ConsentScope.PORTFOLIO_IMPORT.value == "portfolio.import"
        assert ConsentScope.PORTFOLIO_ANALYZE.value == "portfolio.analyze"
        assert ConsentScope.PORTFOLIO_READ.value == "portfolio.read"

    def test_chat_scopes(self):
        """Test chat history scopes."""
        assert ConsentScope.CHAT_HISTORY_READ.value == "chat.history.read"
        assert ConsentScope.CHAT_HISTORY_WRITE.value == "chat.history.write"

    def test_embedding_scopes(self):
        """Test embedding scopes."""
        assert ConsentScope.EMBEDDING_PROFILE_READ.value == "embedding.profile.read"
        assert ConsentScope.EMBEDDING_PROFILE_COMPUTE.value == "embedding.profile.compute"

    def test_kai_agent_scopes(self):
        """Test Kai agent operation scopes."""
        assert ConsentScope.AGENT_KAI_ANALYZE.value == "agent.kai.analyze"
        assert ConsentScope.AGENT_KAI_DEBATE.value == "agent.kai.debate"
        assert ConsentScope.AGENT_KAI_INFER.value == "agent.kai.infer"

    def test_external_data_scopes(self):
        """Test external data source scopes."""
        assert ConsentScope.EXTERNAL_SEC_FILINGS.value == "external.sec.filings"
        assert ConsentScope.EXTERNAL_NEWS_API.value == "external.news.api"
        assert ConsentScope.EXTERNAL_MARKET_DATA.value == "external.market.data"
        assert ConsentScope.EXTERNAL_RENAISSANCE.value == "external.renaissance.data"

    def test_scope_list(self):
        """Test that list() returns all scope values."""
        scope_list = ConsentScope.list()
        
        assert isinstance(scope_list, list)
        assert "vault.owner" in scope_list
        assert "attr.financial.risk_profile" in scope_list
        assert "portfolio.import" in scope_list

    def test_scope_values_are_strings(self):
        """Test that all scope values are strings."""
        for scope in ConsentScope:
            assert isinstance(scope.value, str)
            assert len(scope.value) > 0

    def test_scope_naming_convention(self):
        """Test that scopes follow naming convention."""
        for scope in ConsentScope:
            value = scope.value
            # Should be lowercase with dots
            assert value == value.lower()
            # Should have at least one dot (category.subcategory)
            assert "." in value

    def test_attribute_scopes_prefix(self):
        """Test that attribute scopes have attr. prefix."""
        attr_scopes = [
            ConsentScope.ATTR_FINANCIAL_RISK_PROFILE,
            ConsentScope.ATTR_FINANCIAL_HOLDINGS,
            ConsentScope.ATTR_LIFESTYLE_INTERESTS,
            ConsentScope.ATTR_PROFESSIONAL_SKILLS,
        ]
        
        for scope in attr_scopes:
            assert scope.value.startswith("attr.")
