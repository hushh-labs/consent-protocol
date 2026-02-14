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
        # User context for personalization (e.g. Renaissance Tier)
        self.user_context = {} 
        self.renaissance_context = {}

    def __init__(
        self,
        risk_profile: RiskProfile = "balanced",
        disconnection_event: Optional[asyncio.Event] = None,
        user_context: Optional[Dict[str, Any]] = None,
        renaissance_context: Optional[Dict[str, Any]] = None,
    ):
        self.risk_profile = risk_profile
        self.agent_weights = AGENT_WEIGHTS[risk_profile]
        self.rounds: List[DebateRound] = []
        self.current_statements: Dict[str, str] = {}
        self._disconnection_event = disconnection_event
        self.user_context = user_context or {}
        self.renaissance_context = renaissance_context or {}



    async def orchestrate_debate_stream(
        self,
        fundamental_insight: FundamentalInsight,
        sentiment_insight: SentimentInsight,
        valuation_insight: ValuationInsight,
        user_context: Optional[Dict[str, Any]] = None,
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

        # Store insights and context
        self.insights = {
            "fundamental": fundamental_insight,
            "sentiment": sentiment_insight,
            "valuation": valuation_insight,
        }
        self.user_context = user_context or {}
        
        # Buffer for XML stream parsing
        self._xml_buffer = ""

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

        # Reset emitted IDs for this turn
        self.emitted_ids = set()

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
            
            # Artificial "Thinking" Delay to prevent "Dummy" feel
            await asyncio.sleep(0.05) 
            
            # --- REAL-TIME XML PARSING ---
            # Parse the accumulating response to find completed XML tags
            # We use a simple regex approach on the full_response to find *new* tags
            # To avoid complexity, we just scan for the closing tags and emit if we haven't seen this ID yet.
            import re
            
            # Pattern for Claims: <claim ...>content</claim>
            # Pattern for Impact: <portfolio_impact ...>content</portfolio_impact>
            
            # Note: This is a lightweight extraction. 
            # Ideally we'd use lxml.etree.iterparse but that requires valid chunks.
            # For 10x implementation, we can do a robust regex scan on the *tail* or full text.
            
            # Let's extract 'claim' tags that have closed
            claim_iter = re.finditer(r'<claim id="([^"]+)" type="([^"]+)" confidence="([^"]+)">([^<]+)</claim>', full_response)
            for match in claim_iter:
                claim_id = match.group(1)
                if claim_id not in self.emitted_ids:
                    self.emitted_ids.add(claim_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "claim",
                            "classification": match.group(2), # fact/projection
                            "confidence": float(match.group(3)),
                            "content": match.group(4).strip(),
                            "agent": agent_name
                        }
                    }

            # Extract Evidence
            evidence_iter = re.finditer(r'<evidence target="([^"]+)" source="([^"]+)">([^<]+)</evidence>', full_response)
            for match in evidence_iter:
                # Evidence doesn't have a unique ID usually, so we hash it or check strict equality
                # For simplicity, we assume unique content for now or just emit.
                evidence_content = match.group(3).strip()
                evidence_id = f"ev_{hash(evidence_content)}"
                if evidence_id not in self.emitted_ids:
                    self.emitted_ids.add(evidence_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "evidence",
                            "target_claim_id": match.group(1),
                            "source": match.group(2),
                            "content": evidence_content,
                            "agent": agent_name
                        }
                    }
                    
            # Extract Portfolio Impact
            impact_iter = re.finditer(r'<portfolio_impact type="([^"]+)" magnitude="([^"]+)" score="([^"]+)">([^<]+)</portfolio_impact>', full_response)
            for match in impact_iter:
                impact_content = match.group(4).strip()
                impact_id = f"imp_{hash(impact_content)}"
                if impact_id not in self.emitted_ids:
                    self.emitted_ids.add(impact_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "impact",
                            "classification": match.group(1), # risk/opportunity
                            "magnitude": match.group(2), # high/med/low
                            "score": int(match.group(3)), # 0-10
                            "content": impact_content,
                            "agent": agent_name
                        }
                    } 

            # --- TRINITY CARD EXTRACTION (Scientist-Level) ---
            
            # 1. Personalized Bull Case
            bull_match = re.search(r'<bull_case_personalized>(.*?)</bull_case_personalized>', full_response, re.DOTALL)
            if bull_match:
                bull_content = bull_match.group(1).strip()
                bull_id = f"bull_{agent_name}_{round_num}"
                if bull_id not in self.emitted_ids:
                    self.emitted_ids.add(bull_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "bull_case_personalized",
                            "content": bull_content,
                            "agent": agent_name
                        }
                    }

            # 2. Personalized Bear Case
            bear_match = re.search(r'<bear_case_personalized>(.*?)</bear_case_personalized>', full_response, re.DOTALL)
            if bear_match:
                bear_content = bear_match.group(1).strip()
                bear_id = f"bear_{agent_name}_{round_num}"
                if bear_id not in self.emitted_ids:
                    self.emitted_ids.add(bear_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "bear_case_personalized",
                            "content": bear_content,
                            "agent": agent_name
                        }
                    }

            # 3. Renaissance Verdict
            ren_match = re.search(r'<renaissance_verdict>(.*?)</renaissance_verdict>', full_response, re.DOTALL)
            if ren_match:
                ren_content = ren_match.group(1).strip()
                ren_id = f"ren_{agent_name}_{round_num}"
                if ren_id not in self.emitted_ids:
                    self.emitted_ids.add(ren_id)
                    yield {
                        "event": "insight_extracted",
                        "data": {
                            "type": "renaissance_verdict",
                            "content": ren_content,
                            "agent": agent_name
                        }
                    }

        # Additional pause after full generation to let it sink in before next agent
        await asyncio.sleep(1.0)

        # Fallback if empty (Gemini error or timeout)
        if not full_response:
             # STRICT NO-MOCK POLICY: If agent fails to produce output, we error out or return empty.
             # We do NOT fallback to "I recommend..." templates anymore.
             logger.error(f"[{agent_name}] Failed to generate response (Empty output)")
             yield {
                 "event": "agent_error",
                 "data": {"agent": agent_name, "error": "No data returned from analysis engine."}
             }
             return

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

        # --- AlphaAgents Persona Injection ---
        
        # Check for Renaissance Tier
        is_renaissance = self.user_context.get("is_renaissance", False) or \
                         self.user_context.get("tier") == "renaissance"
        
        complexity_instruction = ""
        if is_renaissance:
            complexity_instruction = "User is a RENAISSANCE TIER member. Use institutional-grade terminology, reference specific Greeks or advanced ratios if applicable. Do not simplify."
        else:
            complexity_instruction = "Use clear, professional financial language accessible to a knowledgeable retail investor."

        role_desc = ""
        if agent == "fundamental":
            role_desc = (
                "You are 'The Skeptic' (Fundamental Analyst). "
                "You prioritize balance sheet strength, free cash flow, and competitive moats. "
                "You are risk-averse and critical of hype. "
                "You focus on downside protection and long-term durability metrics (ROIC, Margins)."
            )
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Moat: {insight.business_moat}\n- Bull: {insight.bull_case}\n- Bear: {insight.bear_case}"
        
        elif agent == "valuation":
            role_desc = (
                "You are 'The Quant' (Valuation Expert). "
                "You rely strictly on numbers—DCF, multiples (P/E, EV/EBITDA), and historical averages. "
                "You ignore narratives and focus on mispricing. "
                "You are objective, precise, and emotionally detached."
            )
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Summary: {insight.summary}"
        
        else: # sentiment
            role_desc = (
                "You are 'The Trader' (Sentiment Analyst). "
                "You care about market psychology, news catalysts, and social volume. "
                "You believe price action rules all. "
                "You look for momentum, contrarian signals, and immediate catalysts."
            )
            details = f"Your Analysis:\n- Recommendation: {insight.recommendation}\n- Score: {getattr(insight, 'sentiment_score', 'N/A')}\n- Catalysts: {getattr(insight, 'key_catalysts', 'N/A')}"

        previous_context = ""
        if round_num > 1:
            previous_context = "Round 1 Statements (for context/rebuttal):\n"
            for r in self.rounds:
                for ag, stmt in r.agent_statements.items():
                    if ag != agent:
                        previous_context += f"- {ag.title()} Agent: {stmt}\n"

        task = ""
        if round_num == 1:
            task = (
                f"State your initial position clearly in 3-4 sentences. "
                f"Support it with your key metrics. Be decisive ({insight.recommendation.upper()}). "
                "Do not hedge."
            )
        else:
            task = (
                f"Critique the positions of other agents if they differ from yours. "
                f"If you agree, explain why their evidence reinforces your view from your specific lens. "
                f"Re-affirm your {insight.recommendation.upper()} stance. "
                "Keep it to 2-3 sentences. Be punchy."
            )

        # --- RENAISSANCE CONTEXT (The Truth) ---
        ren_context_str = ""
        if self.renaissance_context:
            tier = self.renaissance_context.get("tier", "Standard")
            fcf = self.renaissance_context.get("fcf_projection", "N/A")
            thesis = self.renaissance_context.get("thesis", "N/A")
            ren_context_str = f"""
        RENAISSANCE DATA (THE MATHEMATICAL TRUTH):
        - Tier: {tier} (ACE/KING = Strong Buy, QUEEN/JACK = Watch/Hold)
        - Free Cash Flow: {fcf}
        - Thesis: {thesis}
        
        MANDATE: You MUST reference this 'Renaissance' data. 
        If Tier is ACE/KING, respect the math even if sentiment is weak.
            """

        # --- USER CONTEXT (The Person) ---
        user_context_str = ""
        if self.user_context:
            risk = self.user_context.get("risk_profile", self.risk_profile)
            holdings = self.user_context.get("holdings_summary", [])
            port_alloc = self.user_context.get("portfolio_allocation", {})
            user_context_str = f"""
        USER CONTEXT (THE PERSON):
        - Risk Profile: {risk}
        - Portfolio Alloc: {port_alloc}
        - Current Holdings: {holdings}
        
        MANDATE: You MUST personalize your argument.
        Example: "Since you own [Holding], adding [Ticker] increases/decreases risk..."
            """

        prompt = f"""
        {role_desc}
        
        AUDIENCE CONTEXT:
        User Name: {self.user_context.get('user_name', 'Value Investor')}
        {user_context_str}
        {ren_context_str}
        {complexity_instruction}
        
        YOUR DATA:
        {details}
        
        {previous_context}
        
        TASK:
        {task}
        
        STRICT OUTPUT FORMAT (XML):
        <analysis>
           <thought>Step-by-step reasoning...</thought>
           
           <claim id="c1" type="fact/projection" confidence="0.9">Key point here</claim>
           <evidence target="c1" source="SEC/News">Quote or metric</evidence>
           <portfolio_impact type="risk/opportunity" magnitude="high" score="8">Impact on user</portfolio_impact>
           
           <!-- TRINITY CARDS - MANDATORY SECTIONS -->
           <bull_case_personalized>
               [Why THIS USER specifically should be bullish. Reference their portfolio/goals.]
           </bull_case_personalized>
           
           <bear_case_personalized>
               [Why THIS USER specifically should be worried. Reference their risk profile/holdings.]
           </bear_case_personalized>
           
           <renaissance_verdict>
               [The Mathematical Truth. Cite the Tier, FCF, and Thesis explicitly.]
           </renaissance_verdict>
        </analysis>
        """
        return prompt
        


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
