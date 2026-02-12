# consent-protocol/tests/agents/kai/test_renaissance_agent.py
"""
Tests for Renaissance Agent - Research data integration.
"""

import pytest

from hushh_mcp.agents.kai.renaissance_agent import (
    RenaissanceAgent,
    get_renaissance_agent,
)


class TestRenaissanceAgent:
    """Test suite for RenaissanceAgent."""

    @pytest.fixture
    def agent(self):
        """Get a fresh agent instance."""
        return RenaissanceAgent()

    def test_get_renaissance_rating_ace_tier(self, agent):
        """Test getting rating for ACE tier stock."""
        rating = agent.get_renaissance_rating("AAPL")
        
        assert rating is not None
        assert rating.ticker == "AAPL"
        assert rating.tier == "ACE"
        assert rating.tier_weight == 1.0
        assert rating.is_investable is True
        assert rating.fcf_2024_b > 0

    def test_get_renaissance_rating_king_tier(self, agent):
        """Test getting rating for KING tier stock."""
        rating = agent.get_renaissance_rating("ADBE")
        
        assert rating is not None
        assert rating.tier == "KING"
        assert rating.tier_weight == 0.8

    def test_get_renaissance_rating_queen_tier(self, agent):
        """Test getting rating for QUEEN tier stock."""
        rating = agent.get_renaissance_rating("UBER")
        
        assert rating is not None
        assert rating.tier == "QUEEN"
        assert rating.tier_weight == 0.6

    def test_get_renaissance_rating_jack_tier(self, agent):
        """Test getting rating for JACK tier stock."""
        rating = agent.get_renaissance_rating("ADP")
        
        assert rating is not None
        assert rating.tier == "JACK"
        assert rating.tier_weight == 0.4

    def test_get_renaissance_rating_not_in_universe(self, agent):
        """Test getting rating for stock not in universe."""
        rating = agent.get_renaissance_rating("FAKE")
        
        assert rating is None

    def test_get_renaissance_rating_case_insensitive(self, agent):
        """Test that ticker lookup is case insensitive."""
        rating_upper = agent.get_renaissance_rating("AAPL")
        rating_lower = agent.get_renaissance_rating("aapl")
        rating_mixed = agent.get_renaissance_rating("AaPl")
        
        assert rating_upper is not None
        assert rating_lower is not None
        assert rating_mixed is not None
        assert rating_upper.ticker == rating_lower.ticker == rating_mixed.ticker

    def test_enhance_analysis_buy_aligned(self, agent):
        """Test enhancing BUY decision for ACE tier stock."""
        enhanced = agent.enhance_analysis(
            ticker="AAPL",
            kai_decision="BUY",
            kai_confidence=0.75,
        )
        
        assert enhanced.renaissance_alignment == "aligned"
        assert enhanced.enhanced_confidence > enhanced.original_confidence
        assert "ALIGNED" in enhanced.enhancement_notes

    def test_enhance_analysis_reduce_conflicting(self, agent):
        """Test enhancing REDUCE decision for ACE tier stock."""
        enhanced = agent.enhance_analysis(
            ticker="MSFT",
            kai_decision="REDUCE",
            kai_confidence=0.8,
        )
        
        assert enhanced.renaissance_alignment == "conflicting"
        assert enhanced.enhanced_confidence < enhanced.original_confidence
        assert "CONFLICTING" in enhanced.enhancement_notes

    def test_enhance_analysis_not_in_universe(self, agent):
        """Test enhancing decision for stock not in universe."""
        enhanced = agent.enhance_analysis(
            ticker="FAKE",
            kai_decision="BUY",
            kai_confidence=0.7,
        )
        
        assert enhanced.renaissance_alignment == "neutral"
        assert enhanced.enhanced_confidence == enhanced.original_confidence
        assert enhanced.renaissance_rating is None

    def test_identify_portfolio_alignment(self, agent):
        """Test portfolio alignment analysis."""
        holdings = [
            {"ticker": "AAPL"},  # ACE
            {"ticker": "MSFT"},  # ACE
            {"ticker": "ADBE"},  # KING
            {"ticker": "FAKE"},  # Not in universe
        ]
        
        report = agent.identify_portfolio_alignment(holdings)
        
        assert report.total_holdings == 4
        assert report.renaissance_aligned == 3
        assert report.ace_count == 2
        assert report.king_count == 1
        assert report.non_universe_count == 1
        assert report.alignment_percentage > 0

    def test_get_tier_stocks(self, agent):
        """Test getting all stocks in a tier."""
        ace_stocks = agent.get_tier_stocks("ACE")
        
        assert len(ace_stocks) > 0
        assert all(stock["tier"] == "ACE" for stock in ace_stocks)

    def test_get_sector_leaders(self, agent):
        """Test getting sector leaders by FCF."""
        tech_leaders = agent.get_sector_leaders("Technology")
        
        assert len(tech_leaders) > 0
        # Should be sorted by FCF descending
        if len(tech_leaders) > 1:
            assert tech_leaders[0]["fcf_2024_b"] >= tech_leaders[1]["fcf_2024_b"]

    def test_singleton_instance(self):
        """Test that get_renaissance_agent returns singleton."""
        agent1 = get_renaissance_agent()
        agent2 = get_renaissance_agent()
        
        assert agent1 is agent2
