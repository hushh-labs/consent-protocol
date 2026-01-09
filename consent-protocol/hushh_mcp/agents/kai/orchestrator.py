"""
Agent Kai — Main Orchestrator

Main entry point for Kai analysis. Coordinates all agents, debate, and decision generation.

This is the "conductor" that brings everything together:
1. Validate consent
2. Instantiate 3 agents
3. Run parallel analysis
4. Orchestrate debate
5. Generate decision card
6. Encrypt and store
"""

from typing import Dict, Any, Optional
from datetime import datetime
import logging
import asyncio

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope

from .fundamental_agent import FundamentalAgent
from .sentiment_agent import SentimentAgent
from .valuation_agent import ValuationAgent
from .debate_engine import DebateEngine
from .decision_generator import DecisionGenerator, DecisionCard
from .config import RiskProfile, ProcessingMode, ANALYSIS_TIMEOUT

logger = logging.getLogger(__name__)


class KaiOrchestrator:
    """
    Main Kai Orchestrator - Coordinates entire analysis pipeline.
    
    Usage:
        orchestrator = KaiOrchestrator(
            user_id="firebase_uid",
            risk_profile="balanced",
            processing_mode="hybrid"
        )
        decision_card = await orchestrator.analyze(
            ticker="AAPL",
            consent_token="HCT:..."
        )
    """
    
    def __init__(
        self,
        user_id: str,
        risk_profile: RiskProfile = "balanced",
        processing_mode: ProcessingMode = "hybrid",
    ):
        self.user_id = user_id
        self.risk_profile = risk_profile
        self.processing_mode = processing_mode
        
        # Instantiate components
        self.fundamental_agent = FundamentalAgent(processing_mode)
        self.sentiment_agent = SentimentAgent(processing_mode)
        self.valuation_agent = ValuationAgent(processing_mode)
        self.debate_engine = DebateEngine(risk_profile)
        self.decision_generator = DecisionGenerator(risk_profile)
        
        logger.info(
            f"[Kai] Orchestrator initialized - "
            f"User: {user_id}, Risk: {risk_profile}, Mode: {processing_mode}"
        )
    
    async def analyze(
        self,
        ticker: str,
        consent_token: str,
    ) -> DecisionCard:
        """
        Perform complete investment analysis on a ticker.
        
        Args:
            ticker: Stock ticker symbol (e.g., "AAPL")
            consent_token: Valid consent token for agent.kai.analyze
            
        Returns:
            DecisionCard with complete analysis
            
        Raises:
            ValueError: If consent token is invalid
            TimeoutError: If analysis exceeds timeout
        """
        start_time = datetime.utcnow()
        logger.info(f"[Kai] Starting analysis for {ticker}")
        
        # Step 1: Validate consent
        await self._validate_consent(consent_token)
        
        try:
            # Step 2: Run parallel agent analysis
            fundamental, sentiment, valuation = await asyncio.wait_for(
                self._run_agent_analysis(ticker, consent_token),
                timeout=ANALYSIS_TIMEOUT
            )
            
            # Step 3: Orchestrate debate
            debate_result = await self.debate_engine.orchestrate_debate(
                fundamental, sentiment, valuation
            )
            
            # Step 4: Generate decision card
            decision_card = await self.decision_generator.generate(
                ticker=ticker,
                user_id=self.user_id,
                processing_mode=self.processing_mode,
                fundamental=fundamental,
                sentiment=sentiment,
                valuation=valuation,
                debate=debate_result,
            )
            
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                f"[Kai] Analysis complete for {ticker} in {elapsed:.2f}s - "
                f"Decision: {decision_card.decision} ({decision_card.confidence:.0%})"
            )
            
            return decision_card
            
        except asyncio.TimeoutError:
            logger.error(f"[Kai] Analysis timeout for {ticker}")
            raise TimeoutError(f"Analysis exceeded {ANALYSIS_TIMEOUT}s timeout")
    
    async def _validate_consent(self, consent_token: str):
        """Validate consent token for analysis."""
        
        # Check if the token grants EITHER:
        # 1. agent.kai.analyze (Delegated permission)
        # 2. vault.owner (Self-Access / Master Scope)
        
        required_scopes = [
            ConsentScope("agent.kai.analyze"),
            ConsentScope("vault.owner")
        ]
        
        # Valid if ANY of the required scopes are present
        is_valid = False
        last_reason = "No token provided"
        
        for scope in required_scopes:
            valid, reason, _ = validate_token(consent_token, scope)
            if valid:
                is_valid = True
                break
            last_reason = reason
        
        if not is_valid:
            logger.error(f"[Kai] Consent validation failed: {last_reason}")
            raise ValueError(f"Invalid consent token: {last_reason}")
        
        logger.info("[Kai] Consent validated")
    
    async def _run_agent_analysis(self, ticker: str, consent_token: str):
        """Run all 3 agents in parallel."""
        logger.info(f"[Kai] Running 3-agent analysis for {ticker}")
        
        # Run agents concurrently
        fundamental_task = self.fundamental_agent.analyze(
            ticker, self.user_id, consent_token
        )
        sentiment_task = self.sentiment_agent.analyze(
            ticker, self.user_id, consent_token
        )
        valuation_task = self.valuation_agent.analyze(
            ticker, self.user_id, consent_token
        )
        
        # Await all results
        fundamental, sentiment, valuation = await asyncio.gather(
            fundamental_task,
            sentiment_task,
            valuation_task,
        )
        
        logger.info("[Kai] All agents completed analysis")
        
        return fundamental, sentiment, valuation
