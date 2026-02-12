"""
Agent Kai — Debate Engine

Orchestrates round-robin debate between 3 specialist agents to reach consensus.

Key Responsibilities:
- Multi-agent debate orchestration
- Consensus building
- Dissent capture
- Confidence aggregation

SSE Event Format (for sse_starlette):
    yield {
        "event": "<type>",  # e.g., "agent_start", "agent_token", "debate_round"
        "data": {           # Plain dict, NOT JSON-encoded string
            "<field>": "...",
            ...
        }
    }

The sse_starlette library will automatically convert this to SSE format:
    event: agent_start
    data: {"agent": "fundamental", ...}

NOTE: The 'data' field should be a plain dict, not json.dumps()!
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from hushh_mcp.operons.kai.llm import stream_gemini_response

from .config import (
    AGENT_WEIGHTS,
    CONSENSUS_THRESHOLD,
    DEBATE_ROUNDS,
    DecisionType,
    RiskProfile,
)
from .fundamental_agent import FundamentalInsight
from .sentiment_agent import SentimentInsight
from .valuation_agent import ValuationInsight

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
    Debate Engine - Orchestrates 3-agent discussion with Real-Time Streaming.

    Implements the AlphaAgents framework:
    - Each agent speaks at least twice (A2A Debate)
    - Real-time token streaming from Gemini 3 Flash
    - Round-robin structured debate
    - Consensus building with dissent capture
    - Weighted voting by risk profile

    Args:
        risk_profile: User's risk tolerance ("conservative", "balanced", "aggressive")
        disconnection_event: Optional asyncio.Event to signal when client disconnects
    """

    def __init__(
        self,
        risk_profile: RiskProfile = "balanced",
        disconnection_event: Optional[asyncio.Event] = None,
    ):
        self.risk_profile = risk_profile
        self.agent_weights = AGENT_WEIGHTS[risk_profile]
        self.rounds: List[DebateRound] = []

        # Helper to track full text for the final result object
        self.current_statements: Dict[str, str] = {}

        # Disconnection event to signal when client disconnects
        self._disconnection_event = disconnection_event

    async def orchestrate_debate_stream(
        self,
        fundamental_insight: FundamentalInsight,
        sentiment_insight: SentimentInsight,
        valuation_insight: ValuationInsight,
    ) -> AsyncGenerator[Dict[str, Any], DebateResult]:
        """
        Orchestrate multi-agent debate with real-time streaming.

        Yields events:
        - round_start
        - kai_thinking
        - agent_start
        - agent_token (streaming content)
        - agent_complete
        - debate_round

        NOTE: Data is a plain dict, NOT JSON-encoded. sse_starlette handles encoding.

        Returns:
        - Final DebateResult object (only in Python 3.13+, currently None)
        """
        logger.info(
            f"[Debate Stream] Starting {DEBATE_ROUNDS}-round debate with {self.risk_profile} profile"
        )

        # Store insights for easy access
        self.insights = {
            "fundamental": fundamental_insight,
            "sentiment": sentiment_insight,
            "valuation": valuation_insight,
        }

        # =========================================================================
        # ROUND 1: Initial Presentation
        # =========================================================================
        yield {
            "event": "round_start",
            "data": {
                "round": 1,
                "description": "Round 1: Agents present their initial findings.",
                "is_final_round": False,
            },
        }

        round1_statements = {}

        # Agent 1: Fundamental
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round1",
                "message": "Inviting Fundamental Agent to open the debate...",
                "tokens": ["Analyzing", "SEC", "filings", "and", "growth", "metrics."],
            },
        }
        async for event in self._stream_agent_turn(
            1, "fundamental", "initial_analysis", round1_statements
        ):
            yield event
        round1_statements["fundamental"] = self.current_statements["fundamental"]

        if self._disconnection_event and self._disconnection_event.is_set():
            return
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round1",
                "message": "Checking Sentiment Agent for market pulse...",
                "tokens": ["Scanning", "news", "flow", "and", "market", "momentum."],
            },
        }
        async for event in self._stream_agent_turn(
            1, "sentiment", "initial_analysis", round1_statements
        ):
            yield event
        round1_statements["sentiment"] = self.current_statements["sentiment"]

        if self._disconnection_event and self._disconnection_event.is_set():
            return

        # Agent 3: Valuation (Moved to 3rd position)
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round1",
                "message": "Calling Valuation Agent for price analysis...",
                "tokens": [
                    "Evaluating",
                    "multiples",
                    "vs",
                    "peers",
                    "and",
                    "historical",
                    "averages.",
                ],
            },
        }
        async for event in self._stream_agent_turn(
            1, "valuation", "initial_analysis", round1_statements
        ):
            yield event
        round1_statements["valuation"] = self.current_statements["valuation"]

        if self._disconnection_event and self._disconnection_event.is_set():
            return

        # Record Round 1
        self.rounds.append(DebateRound(1, round1_statements, datetime.utcnow()))
        yield {
            "event": "debate_round",
            "data": {
                "round": 1,
                "statements": round1_statements,
                "context": "presenting initial findings",
                "is_final_round": False,
            },
        }

        # =========================================================================
        # ROUND 2: Rebuttal & Consensus Building
        # =========================================================================
        yield {
            "event": "round_start",
            "data": {
                "round": 2,
                "description": "Round 2: Cross-examination and position refinement.",
                "is_final_round": True,
            },
        }

        round2_statements = {}

        # Agent 1: Fundamental Rebuttal
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round2",
                "message": "Fundamental Agent is reviewing peer arguments...",
                "tokens": ["Comparing", "intrinsic", "value", "against", "market", "sentiment."],
            },
        }
        async for event in self._stream_agent_turn(
            2, "fundamental", "challenge_positions", round2_statements
        ):
            yield event
        round2_statements["fundamental"] = self.current_statements["fundamental"]

        if self._disconnection_event and self._disconnection_event.is_set():
            return

        # Agent 2: Sentiment Rebuttal (Moved to 2nd position)
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round2",
                "message": "Sentiment Agent is analyzing reaction risks...",
                "tokens": [
                    "Assessing",
                    "potential",
                    "volatility",
                    "from",
                    "conflicting",
                    "signals.",
                ],
            },
        }
        async for event in self._stream_agent_turn(
            2, "sentiment", "challenge_positions", round2_statements
        ):
            yield event
        round2_statements["sentiment"] = self.current_statements["sentiment"]

        if self._disconnection_event and self._disconnection_event.is_set():
            return

        # Agent 3: Valuation Rebuttal (Moved to 3rd position)
        yield {
            "event": "kai_thinking",
            "data": {
                "phase": "round2",
                "message": "Valuation Agent is stress-testing assumptions...",
                "tokens": [
                    "Checking",
                    "if",
                    "fundamentals",
                    "justify",
                    "the",
                    "current",
                    "premium.",
                ],
            },
        }
        async for event in self._stream_agent_turn(
            2, "valuation", "challenge_positions", round2_statements
        ):
            yield event
        round2_statements["valuation"] = self.current_statements["valuation"]

        # Record Round 2
        self.rounds.append(DebateRound(2, round2_statements, datetime.utcnow()))
        yield {
            "event": "debate_round",
            "data": {
                "round": 2,
                "statements": round2_statements,
                "context": "challenging and refining positions",
                "is_final_round": True,
            },
        }

        # =========================================================================
        # CONSENSUS PHASE
        # =========================================================================
        # We don't yield the result here, the caller (stream.py) handles the final decision/yield.
        # But we do return it for the caller to use.
        # UPDATE: Async generators cannot return values in Python < 3.13 (or standard usage).
        # stream.py calculates this manually, so we just finish.
        pass

    async def _stream_agent_turn(
        self,
        round_num: int,
        agent_name: str,
        context_type: str,
        current_round_statements: Dict[str, str],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream an individual agent's turn.

        1. Yields 'agent_start'
        2. Streams 'agent_token' from Gemini
        3. Yields 'agent_complete'

        Checks for client disconnection after each event to stop LLM processing
        when client disconnects abruptly.

        NOTE: Data is a plain dict, NOT JSON-encoded. sse_starlette handles encoding.
        """

        agent_display_names = {
            "fundamental": "Fundamental Agent",
            "sentiment": "Sentiment Agent",
            "valuation": "Valuation Agent",
        }

        yield {
            "event": "agent_start",
            "data": {
                "agent": agent_name,
                "agent_name": agent_display_names.get(agent_name, agent_name),
                "message": f"Formulating arguments for Round {round_num}...",
            },
        }

        # Build prompt
        prompt = self._build_agent_prompt(
            agent_name, round_num, context_type, self.insights[agent_name], current_round_statements
        )

        full_response = ""

        # Stream from Gemini
        async for chunk in stream_gemini_response(prompt, agent_name=agent_name):
            if chunk.get("type") == "token":
                text = chunk.get("text", "")
                full_response += text
                yield {
                    "event": "agent_token",
                    "data": {"agent": agent_name, "text": text, "type": "token"},
                }
                # Check for disconnection after each token to stop LLM streaming
                if self._disconnection_event is not None and self._disconnection_event.is_set():
                    logger.info(f"[{agent_name}] Client disconnected during streaming, stopping...")
                    return
            elif chunk.get("type") == "error":
                logger.error(f"[{agent_name}] Stream error: {chunk.get('message')}")

        # Fallback if empty (Gemini error or timeout)
        if not full_response:
            full_response = self._get_fallback_statement(
                agent_name, self.insights[agent_name], round_num
            )
            yield {
                "event": "agent_token",
                "data": {"agent": agent_name, "text": full_response, "type": "token"},
            }

        self.current_statements[agent_name] = full_response

        yield {
            "event": "agent_complete",
            "data": {
                "agent": agent_name,
                "summary": full_response,  # The summary for the card IS the statement
                "recommendation": self.insights[agent_name].recommendation,
                "confidence": self.insights[agent_name].confidence,
                "sentiment_score": getattr(self.insights[agent_name], "sentiment_score", None),
            },
        }

        # Final disconnection check
        if self._disconnection_event is not None and self._disconnection_event.is_set():
            logger.info(f"[{agent_name}] Client disconnected after completion, stopping...")

    def _build_agent_prompt(
        self,
        agent: str,
        round_num: int,
        context_type: str,
        insight: Any,
        current_round_statements: Dict[str, str],
    ) -> str:
        """Construct a specific prompt for the agent's turn."""

        role_desc = ""
        if agent == "fundamental":
            role_desc = "You are a Fundamental Analyst focused on SEC filings, moat, and cash flow."
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Moat: {insight.business_moat}\n- Bull Case: {insight.bull_case}\n- Bear Case: {insight.bear_case}"
        elif agent == "valuation":
            role_desc = "You are a Valuation Expert focused on fair value, multiples, and DCF."
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Summary: {insight.summary}"
        else:
            role_desc = "You are a Sentiment Analyst focused on market momentum and news catalysts."
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Score: {getattr(insight, 'sentiment_score', 'N/A')}\n- Catalysts: {getattr(insight, 'key_catalysts', 'N/A')}"

        previous_context = ""
        if round_num > 1:
            previous_context = "Round 1 Statements (for context/rebuttal):\n"
            for r in self.rounds:
                for ag, stmt in r.agent_statements.items():
                    if ag != agent:
                        previous_context += f"- {ag}: {stmt}\n"

        task = ""
        if round_num == 1:
            task = f"State your initial position clearly in 2-3 sentences. Support it with your key metrics. Be decisive ({insight.recommendation.upper()})."
        else:
            task = f"Critique the positions of other agents if they differ from yours. If you agree, explain why their evidence reinforces your view. Re-affirm your {insight.recommendation.upper()} stance. Keep it to 2-3 sentences."

        prompt = f"""
        {role_desc}
        
        CONTEXT:
        Risk Profile: {self.risk_profile}
        {details}
        
        {previous_context}
        
        TASK:
        {task}
        
        Start directly with your statement. Do not use markdown.
        """
        return prompt

    def _get_fallback_statement(self, agent: str, insight: Any, round_num: int) -> str:
        """Fallback dynamic templates if LLM fails."""
        if round_num == 1:
            return f"Based on my analysis, I recommend {insight.recommendation}. {insight.summary[:100]}..."
        else:
            return f"I maintain my position of {insight.recommendation} with {insight.confidence:.0%} confidence."

    async def _build_consensus(
        self,
        fundamental: FundamentalInsight,
        sentiment: SentimentInsight,
        valuation: ValuationInsight,
    ) -> DebateResult:
        """Build consensus from agent insights (Unchanged logic)."""

        # Collect agent votes
        agent_votes = {
            "fundamental": self._recommendation_to_decision(fundamental.recommendation),
            "sentiment": self._recommendation_to_decision(sentiment.recommendation),
            "valuation": self._recommendation_to_decision(valuation.recommendation),
        }

        # Calculate weighted decision
        decision, confidence = self._calculate_weighted_decision(fundamental, sentiment, valuation)

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
        if any(x in rec for x in ["buy", "bullish", "undervalued"]):
            return "buy"
        elif any(x in rec for x in ["reduce", "bearish", "overvalued", "sell"]):
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
        scores = {
            "fundamental": self._rec_to_score(fundamental.recommendation),
            "sentiment": self._rec_to_score(sentiment.recommendation),
            "valuation": self._rec_to_score(valuation.recommendation),
        }

        # Calculate weighted score
        weighted_score = (
            scores["fundamental"] * self.agent_weights["fundamental"]
            + scores["sentiment"] * self.agent_weights["sentiment"]
            + scores["valuation"] * self.agent_weights["valuation"]
        )

        # Calculate weighted confidence
        weighted_confidence = (
            fundamental.confidence * self.agent_weights["fundamental"]
            + sentiment.confidence * self.agent_weights["sentiment"]
            + valuation.confidence * self.agent_weights["valuation"]
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
        if any(x in rec for x in ["buy", "bullish", "undervalued"]):
            return 1.0
        elif any(x in rec for x in ["reduce", "bearish", "overvalued", "sell"]):
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
