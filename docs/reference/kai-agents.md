# Kai Agents

> Agent Kai: a multi-agent financial analysis system using structured debate to produce explainable investment recommendations.

---

## Overview

Kai implements the AlphaAgents framework -- three specialist agents debate across multiple rounds to reach consensus on a stock recommendation. Each agent brings a distinct analytical lens, and disagreements are preserved as dissenting opinions rather than suppressed.

**Output**: A `DecisionCard` with a recommendation (Buy / Hold / Reduce), confidence score, supporting evidence, and sourced reasoning from all three agents.

---

## Three Specialists

| Agent          | Focus                     | Data Sources                          | Key Operons                                |
| -------------- | ------------------------- | ------------------------------------- | ------------------------------------------ |
| **Fundamental**| Business health and moat  | SEC 10-K/10-Q filings, EDGAR         | `analyze_fundamentals`, `calculate_financial_ratios`, `assess_fundamental_health` |
| **Sentiment**  | Market mood and momentum  | Financial news, analyst ratings       | `analyze_sentiment`, `calculate_sentiment_score`, `extract_catalysts_from_news` |
| **Valuation**  | Fair value and multiples  | Market data (yfinance), peer comps    | `analyze_valuation`, `calculate_financial_ratios` |

Each agent is implemented as a sub-module under `hushh_mcp/agents/kai/`:

```
kai/
├── fundamental_agent.py    # FundamentalInsight dataclass + analyze()
├── sentiment_agent.py      # SentimentInsight dataclass + analyze()
├── valuation_agent.py      # ValuationInsight dataclass + analyze()
├── debate_engine.py        # DebateEngine orchestrator
├── config.py               # Weights, thresholds, timeouts
├── agent.py                # KaiAgent(HushhAgent) -- ADK entry point
├── agent.yaml              # Manifest
└── tools.py                # @hushh_tool wrappers
```

---

## Debate Engine

### Flow

```
Round 1:
  Fundamental Agent → reasoning + recommendation
  Sentiment Agent   → reasoning + recommendation
  Valuation Agent   → reasoning + recommendation

Round 2:
  Fundamental Agent → rebuttal/reinforcement (sees Round 1)
  Sentiment Agent   → rebuttal/reinforcement
  Valuation Agent   → rebuttal/reinforcement

Synthesis:
  Weighted vote → DecisionCard
  Dissenting opinions preserved
```

### Configuration

| Parameter              | Value  | Source                  |
| ---------------------- | ------ | ----------------------- |
| `DEBATE_ROUNDS`        | 2      | Each agent speaks twice |
| `CONSENSUS_THRESHOLD`  | 0.70   | 70% agreement required  |
| `MIN_CONFIDENCE_THRESHOLD` | 0.60 | Minimum 60% confidence |
| `ANALYSIS_TIMEOUT`     | 120s   | Full analysis timeout   |
| `AGENT_TIMEOUT`        | 30s    | Per-agent timeout       |
| `DEBATE_TIMEOUT`       | 45s    | Debate phase timeout    |

### Risk-Weighted Voting

Agent weights shift based on the user's risk profile:

| Profile        | Fundamental | Sentiment | Valuation |
| -------------- | ----------- | --------- | --------- |
| Conservative   | 0.50        | 0.20      | 0.30      |
| Balanced       | 0.35        | 0.30      | 0.35      |
| Aggressive     | 0.25        | 0.45      | 0.30      |

### DebateResult

```python
@dataclass
class DebateResult:
    decision: DecisionType       # "buy" | "hold" | "reduce"
    confidence: float            # 0.0 - 1.0
    consensus_reached: bool
    rounds: List[DebateRound]
    agent_votes: Dict[str, DecisionType]
    dissenting_opinions: List[str]
    final_statement: str
```

---

## SSE Streaming Protocol

The analysis endpoint (`GET /api/kai/analyze/stream`) streams real-time debate progress via Server-Sent Events.

### Event Types

| Event              | Payload                                      | When                          |
| ------------------ | -------------------------------------------- | ----------------------------- |
| `agent_start`      | `{ agent, round, status: "reasoning" }`      | Agent begins analysis         |
| `agent_token`      | `{ agent, round, token, accumulated }`       | Each LLM token streamed       |
| `agent_complete`   | `{ agent, round, summary, recommendation }`  | Agent finishes speaking       |
| `round_complete`   | `{ round, agent_summaries }`                 | All agents done for this round|
| `decision`         | `{ decision, confidence, consensus, votes }` | Final synthesized result      |
| `error`            | `{ message, agent?, recoverable }`           | Error during processing       |
| `done`             | `{}`                                          | Stream complete               |

### Agent Execution Order

Agents always execute sequentially in this order:

1. **Fundamental** (business health first)
2. **Sentiment** (market mood second)
3. **Valuation** (numbers last, with full context)

This order is enforced in `debate_engine.py` and repeated for each round.

---

## Decision Card

The final output is a structured `DecisionCard` displayed in the frontend:

| Field                | Type     | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `ticker`             | string   | Stock symbol                             |
| `decision`           | enum     | `buy` / `hold` / `reduce`               |
| `confidence`         | float    | Weighted consensus confidence (0-1)      |
| `consensus_reached`  | boolean  | Whether agents agreed                    |
| `fundamental_summary`| string   | Fundamental agent's final position       |
| `sentiment_summary`  | string   | Sentiment agent's final position         |
| `valuation_summary`  | string   | Valuation agent's final position         |
| `dissenting_opinions`| string[] | Any minority opinions preserved          |
| `key_metrics`        | object   | P/E, ROE, debt ratio, sentiment score    |
| `sources`            | string[] | URLs to SEC filings, news articles       |
| `timestamp`          | string   | Analysis timestamp                       |

---

## Renaissance Universe Overlay

After the debate, results are cross-referenced against the Renaissance investable universe.

### Tiers

| Tier   | Criteria                  | Meaning                    |
| ------ | ------------------------- | -------------------------- |
| ACE    | Top quantitative scores   | Highest conviction picks   |
| KING   | Strong fundamentals       | Reliable growth            |
| QUEEN  | Balanced profiles         | Moderate opportunity       |
| JACK   | Speculative potential     | Higher risk, higher reward |

### Tables

- `renaissance_universe` -- Full stock universe with tier classifications
- `renaissance_screening_criteria` -- Screening rules per tier
- `renaissance_avoid` -- Stocks explicitly excluded

The `RenaissanceService` provides lookup methods used by the losers analysis endpoints.

---

## LLM Configuration

| Parameter          | Value                      |
| ------------------ | -------------------------- |
| Model              | Gemini 2.5/3 Flash         |
| SDK                | `google.genai` (new SDK)   |
| Thinking Mode      | HIGH (full reasoning)      |
| API Key            | `GOOGLE_API_KEY` from env  |
| Streaming          | Token-by-token via `stream_gemini_response` |

The LLM client is initialized in `hushh_mcp/operons/kai/llm.py` with graceful fallback if `google.genai` is not available.

---

## Analysis History

Analysis results are stored in the world model under the `kai_decisions` domain.

- **FIFO**: Maximum 3 versions per ticker. Fourth analysis deletes the oldest.
- **Storage**: Encrypted in `world_model_data`, summarized in `world_model_index_v2.domain_summaries.kai_decisions`
- **Access**: `GET /api/kai/decisions/{user_id}` returns the decision summary list

---

## Error Handling

| Error                   | Handling                                           |
| ----------------------- | -------------------------------------------------- |
| LLM rate limit (429)    | Exponential backoff: 1s, 2s, 4s, max 3 retries    |
| LLM timeout             | Graceful degradation -- return partial results     |
| Agent failure           | Skip agent, weight remaining agents higher         |
| Invalid consent token   | 401 response, abort analysis                       |
| External API failure    | Fallback to cached/static data where available     |
| All agents fail         | Return error event with `recoverable: false`       |

The SSE stream always terminates cleanly with either a `decision` event or an `error` event, followed by `done`.

---

## See Also

- [Agent Development](./agent-development.md) -- Building new agents
- [World Model](./world-model.md) -- Encrypted data architecture
- [Consent Protocol](./consent-protocol.md) -- Token lifecycle and validation
- [Environment Variables](./env-vars.md) -- Backend configuration reference
