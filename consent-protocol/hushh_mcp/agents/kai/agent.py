"""
Kai Investment Analysis Agent

Extends AgentNav with investment-specific logic.
Demonstrates compliance with Hushh Consent Protocol.
"""

from typing import Dict, Any
from hushh_mcp.agents.agent_nav import AgentNav, AgentManifest
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID

# Import Kai operons
from hushh_mcp.operons.kai.analysis import (
    analyze_fundamentals,
    analyze_sentiment,
    analyze_valuation
)
from hushh_mcp.operons.kai.storage import (
    store_decision_card,
    retrieve_decision_card
)


class KaiAgent(AgentNav):
    """
    Kai - Educational Investment Analysis Agent
    
    Provides stock analysis through 3 specialized agents:
    - Fundamental analysis (10-K/10-Q filings)
    - Sentiment analysis (news, social media)
    - Valuation analysis (financial metrics)
    
    All analysis requires user consent via AgentNav base class.
    """
    
    def _get_manifest(self) -> AgentManifest:
        """Define Kai agent metadata."""
        return AgentManifest(
            agent_id="agent_kai",
            name="Kai Investment Analyst",
            description="Educational stock analysis with consent-first design",
            version="2.0.0",
            required_scopes=[
                ConsentScope.VAULT_READ_RISK_PROFILE,
                ConsentScope.VAULT_WRITE_DECISION,
                ConsentScope.AGENT_KAI_ANALYZE,
            ]
        )
    
    def _handle_action(
        self,
        action: str,
        user_id: UserID,
        consent_token: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Route to appropriate Kai action.
        
        Called AFTER consent validation by AgentNav.
        """
        
        if action == "analyze":
            return self._analyze_stock(
                user_id=user_id,
                consent_token=consent_token,
                ticker=kwargs.get("ticker"),
                session_id=kwargs.get("session_id")
            )
        
        elif action == "get_history":
            return self._get_decision_history(
                user_id=user_id,
                consent_token=consent_token,
                vault_key_hex=kwargs.get("vault_key_hex")
            )
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _analyze_stock(
        self,
        user_id: UserID,
        consent_token: str,
        ticker: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        Perform comprehensive stock analysis.
        
        Orchestrates:
        1. Fundamental analysis (SEC filings)
        2. Sentiment analysis (news/social)
        3. Valuation analysis (metrics)
        4. Decision aggregation
        
        Each operon independently validates the consent token.
        """
        self.logger.info(f"🔍 Analyzing {ticker} for {user_id}")
        
        # Step 1: Fundamental analysis
        fundamental = analyze_fundamentals(
            ticker=ticker,
            user_id=user_id,
            sec_filings=[],  # TODO: Fetch from SEC API
            consent_token=consent_token
        )
        
        # Step 2: Sentiment analysis
        sentiment = analyze_sentiment(
            ticker=ticker,
            user_id=user_id,
            news_articles=[],  # TODO: Fetch from news API
            consent_token=consent_token
        )
        
        # Step 3: Valuation analysis
        valuation = analyze_valuation(
            ticker=ticker,
            user_id=user_id,
            market_data={},  # TODO: Fetch from market data API
            consent_token=consent_token
        )
        
        # Step 4: Aggregate decision
        decision = self._aggregate_decision(
            fundamental, sentiment, valuation
        )
        
        self.logger.info(
            f"✅ Analysis complete for {ticker}: {decision}"
        )
        
        return {
            "ticker": ticker,
            "decision": decision,
            "session_id": session_id,
            "analyses": {
                "fundamental": fundamental,
                "sentiment": sentiment,
                "valuation": valuation
            },
            "timestamp": self._get_timestamp()
        }
    
    def _aggregate_decision(
        self,
        fundamental: Dict,
        sentiment: Dict,
        valuation: Dict
    ) -> str:
        """
        Aggregate recommendations from 3 agents.
        
        Simple voting mechanism:
        - Each agent votes: buy, hold, or reduce
        - Majority wins
        """
        votes = {
            "buy": 0,
            "hold": 0,
            "reduce": 0
        }
        
        for analysis in [fundamental, sentiment, valuation]:
            vote = analysis.get("recommendation", "hold").lower()
            if vote in votes:
                votes[vote] += 1
        
        # Return majority vote
        return max(votes, key=votes.get)
    
    def _get_decision_history(
        self,
        user_id: UserID,
        consent_token: str,
        vault_key_hex: str
    ) -> Dict[str, Any]:
        """
        Get user's past investment decisions from vault.
        
        Requires vault.read.decision scope.
        """
        self.logger.info(f"📜 Fetching decision history for {user_id}")
        
        # TODO: Implement with retrieve_decision_card operon
        # decisions = retrieve_decision_card(
        #     user_id=user_id,
        #     vault_key_hex=vault_key_hex,
        #     consent_token=consent_token
        # )
        
        return {
            "decisions": [],
            "total": 0,
            "message": "History retrieval coming soon"
        }
    
    def _get_timestamp(self) -> int:
        """Get current Unix timestamp in milliseconds."""
        from datetime import datetime
        return int(datetime.now().timestamp() * 1000)


# Singleton instance for API usage
kai_agent = KaiAgent()
