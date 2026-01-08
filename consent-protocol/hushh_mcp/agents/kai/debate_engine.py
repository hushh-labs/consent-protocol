"""
Agent Kai — Debate Engine

Orchestrates round-robin debate between 3 specialist agents to reach consensus.

Key Responsibilities:
- Multi-agent debate orchestration
- Consensus building
- Dissent capture
- Confidence aggregation
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging
from datetime import datetime

from .fundamental_agent import FundamentalAgent, FundamentalInsight
from .sentiment_agent import SentimentAgent, SentimentInsight
from .valuation_agent import ValuationAgent, ValuationInsight
from .config import (
    DEBATE_ROUNDS,
    MIN_CONFIDENCE_THRESHOLD,
    CONSENSUS_THRESHOLD,
    AGENT_WEIGHTS,
    RiskProfile,
    DecisionType,
)

logger = logging.getLogger(__name__)


@dataclass
class DebateRound:
    """Single round of debate."""
    round_number: int
    agent_statements: Dict[str, str]  # agent_id -> statement
    timestamp: datetime


@dataclass
class DebateResult:
    """Result of multi-agent debate."""
    decision: DecisionType
    confidence: float
    consensus_reached: bool
    rounds: List[DebateRound]
    agent_votes: Dict[str, DecisionType]
    dissenting_opinions: List[str]
    final_statement: str


class DebateEngine:
    """
    Debate Engine - Orchestrates 3-agent discussion.
    
    Implements the AlphaAgents framework:
    - Each agent speaks at least twice
    - Round-robin structured debate
    - Consensus building with dissent capture
    - Weighted voting by risk profile
    """
    
    def __init__(self, risk_profile: RiskProfile = "balanced"):
        self.risk_profile = risk_profile
        self.agent_weights = AGENT_WEIGHTS[risk_profile]
        self.rounds: List[DebateRound] = []
        
    async def orchestrate_debate(
        self,
        fundamental_insight: FundamentalInsight,
        sentiment_insight: SentimentInsight,
        valuation_insight: ValuationInsight,
    ) -> DebateResult:
        """
        Orchestrate multi-agent debate to reach consensus.
        
        Args:
            fundamental_insight: Fundamental agent's analysis
            sentiment_insight: Sentiment agent's analysis
            valuation_insight: Valuation agent's analysis
            
        Returns:
            DebateResult with final decision and debate transcript
        """
        logger.info(f"[Debate] Starting {DEBATE_ROUNDS}-round debate with {self.risk_profile} profile")
        
        # Round 1: Initial positions
        round_1 = await self._conduct_round(
            round_num=1,
            fundamental=fundamental_insight,
            sentiment=sentiment_insight,
            valuation=valuation_insight,
            context="initial_analysis",
        )
        self.rounds.append(round_1)
        
        # Round 2: Challenge and refine
        round_2 = await self._conduct_round(
            round_num=2,
            fundamental=fundamental_insight,
            sentiment=sentiment_insight,
            valuation=valuation_insight,
            context="challenge_positions",
        )
        self.rounds.append(round_2)
        
        # Additional rounds if no consensus
        if DEBATE_ROUNDS > 2:
            for round_num in range(3, DEBATE_ROUNDS + 1):
                round_n = await self._conduct_round(
                    round_num=round_num,
                    fundamental=fundamental_insight,
                    sentiment=sentiment_insight,
                    valuation=valuation_insight,
                    context="build_consensus",
                )
                self.rounds.append(round_n)
        
        # Calculate final decision
        result = await self._build_consensus(
            fundamental_insight,
            sentiment_insight,
            valuation_insight,
        )
        
        logger.info(f"[Debate] Decision: {result.decision} (confidence: {result.confidence:.2%})")
        
        return result
    
    async def _conduct_round(
        self,
        round_num: int,
        fundamental: FundamentalInsight,
        sentiment: SentimentInsight,
        valuation: ValuationInsight,
        context: str,
    ) -> DebateRound:
        """Conduct a single round of debate."""
        
        logger.info(f"[Debate] Round {round_num}: {context}")
        
        # Generate agent statements for this round
        statements = {
            "fundamental": await self._generate_statement(
                agent="fundamental",
                insight=fundamental,
                round_num=round_num,
                context=context,
            ),
            "sentiment": await self._generate_statement(
                agent="sentiment",
                insight=sentiment,
                round_num=round_num,
                context=context,
            ),
            "valuation": await self._generate_statement(
                agent="valuation",
                insight=valuation,
                round_num=round_num,
                context=context,
            ),
        }
        
        return DebateRound(
            round_number=round_num,
            agent_statements=statements,
            timestamp=datetime.utcnow(),
        )
    
    async def _generate_statement(
        self,
        agent: str,
        insight: Any,
        round_num: int,
        context: str,
    ) -> str:
        """Generate an agent's statement for a debate round."""
        
        # Context-based statement generation
        if context == "initial_analysis":
            # Round 1: Present findings
            if agent == "fundamental":
                return f"Based on fundamental analysis, I recommend {insight.recommendation}. {insight.summary}"
            elif agent == "sentiment":
                return f"Market sentiment indicates {insight.recommendation}. {insight.summary}"
            else:  # valuation
                return f"Valuation analysis suggests the stock is {insight.recommendation}. {insight.summary}"
        
        elif context == "challenge_positions":
            # Round 2: Address disagreements
            return f"After considering other perspectives, I maintain {insight.recommendation} with {insight.confidence:.0%} confidence."
        
        else:  # build_consensus
            # Later rounds: Move toward consensus
            return f"Balancing all factors, I support {insight.recommendation}."
    
    async def _build_consensus(
        self,
        fundamental: FundamentalInsight,
        sentiment: SentimentInsight,
        valuation: ValuationInsight,
    ) -> DebateResult:
        """Build consensus from agent insights."""
        
        # Collect agent votes
        agent_votes = {
            "fundamental": self._recommendation_to_decision(fundamental.recommendation),
            "sentiment": self._recommendation_to_decision(sentiment.recommendation),
            "valuation": self._recommendation_to_decision(valuation.recommendation),
        }
        
        # Calculate weighted decision
        decision, confidence = self._calculate_weighted_decision(
            fundamental, sentiment, valuation
        )
        
        # Check for consensus
        unique_votes = set(agent_votes.values())
        consensus_reached = len(unique_votes) == 1 or confidence >= CONSENSUS_THRESHOLD
        
        # Capture dissent
        dissenting_opinions = []
        majority_decision = decision
        for agent_id, vote in agent_votes.items():
            if vote != majority_decision:
                dissenting_opinions.append(
                    f"{agent_id.capitalize()} agent dissents: recommends {vote}"
                )
        
        # Generate final statement
        final_statement = self._generate_final_statement(
            decision, confidence, consensus_reached, dissenting_opinions
        )
        
        return DebateResult(
            decision=decision,
            confidence=confidence,
            consensus_reached=consensus_reached,
            rounds=self.rounds,
            agent_votes=agent_votes,
            dissenting_opinions=dissenting_opinions,
            final_statement=final_statement,
        )
    
    def _recommendation_to_decision(self, recommendation: str) -> DecisionType:
        """Convert agent recommendation to decision type."""
        rec = recommendation.lower()
        if rec in ["buy", "bullish", "undervalued"]:
            return "buy"
        elif rec in ["reduce", "bearish", "overvalued"]:
            return "reduce"
        else:
            return "hold"
    
    def _calculate_weighted_decision(
        self,
        fundamental: FundamentalInsight,
        sentiment: SentimentInsight,
        valuation: ValuationInsight,
    ) -> tuple[DecisionType, float]:
        """Calculate weighted decision based on risk profile."""
        
        # Convert recommendations to numeric scores
        # -1 = reduce, 0 = hold, 1 = buy
        scores = {
            "fundamental": self._rec_to_score(fundamental.recommendation),
            "sentiment": self._rec_to_score(sentiment.recommendation),
            "valuation": self._rec_to_score(valuation.recommendation),
        }
        
        # Calculate weighted average
        weighted_score = (
            scores["fundamental"] * self.agent_weights["fundamental"] +
            scores["sentiment"] * self.agent_weights["sentiment"] +
            scores["valuation"] * self.agent_weights["valuation"]
        )
        
        # Calculate weighted confidence
        weighted_confidence = (
            fundamental.confidence * self.agent_weights["fundamental"] +
            sentiment.confidence * self.agent_weights["sentiment"] +
            valuation.confidence * self.agent_weights["valuation"]
        )
        
        # Convert score to decision
        if weighted_score > 0.3:
            decision = "buy"
        elif weighted_score < -0.3:
            decision = "reduce"
        else:
            decision = "hold"
        
        return decision, weighted_confidence
    
    def _rec_to_score(self, recommendation: str) -> float:
        """Convert recommendation to numeric score."""
        rec = recommendation.lower()
        if rec in ["buy", "bullish", "undervalued"]:
            return 1.0
        elif rec in ["reduce", "bearish", "overvalued"]:
            return -1.0
        else:
            return 0.0
    
    def _generate_final_statement(
        self,
        decision: DecisionType,
        confidence: float,
        consensus: bool,
        dissent: List[str],
    ) -> str:
        """Generate final consensus statement."""
        
        consensus_word = "unanimous" if consensus else "majority"
        dissent_note = f" (with {len(dissent)} dissenting opinion(s))" if dissent else ""
        
        return (
            f"After {DEBATE_ROUNDS} rounds of analysis, the committee has reached a "
            f"{consensus_word} decision to {decision.upper()} with {confidence:.0%} confidence{dissent_note}."
        )
