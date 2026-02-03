# Kai Financial Agent (v2.0)

> **Role**: Coordinator / Orchestrator
> **Model**: `gemini-3-flash-preview` (via Vertex AI)
> **Scopes**: `vault.read.finance`

## Overview

Kai is an advanced financial analyst agent. Unlike simple chatbots, Kai acts as a **Coordinator** that manages a team of specialized "Analysis Engines" to produce extensive investment reports.

## LLM Configuration

Kai uses **Gemini 3 Flash Preview** via Vertex AI. The SDK auto-configures from environment variables:

```bash
# Required in consent-protocol/.env
GOOGLE_API_KEY=your-service-account-bound-api-key
GOOGLE_GENAI_USE_VERTEXAI=True
```

### Thinking Mode

Gemini 3 supports configurable thinking levels for reasoning tasks:

| Level | Description | Use Case |
|-------|-------------|----------|
| `MINIMAL` | Near-zero thinking budget | High-throughput, simple tasks |
| `LOW` | Fewer tokens for thinking | Speed-critical operations |
| `MEDIUM` | Balanced approach | Moderate complexity |
| `HIGH` | Full reasoning (default) | Complex analysis, document parsing |

Kai uses `HIGH` thinking level by default for portfolio analysis and document parsing to ensure thorough reasoning.

## Architecture

```mermaid
graph TD
    User[User] -->|Chat| Orchestrator
    Orchestrator -->|Delegates| Kai[Kai Agent (Coordinator)]

    Kai -->|Tool Call| Fund[Fundamental Tool]
    Kai -->|Tool Call| Sent[Sentiment Tool]
    Kai -->|Tool Call| Val[Valuation Tool]

    Fund -->|Read| SEC[SEC Filings]
    Sent -->|Read| News[Market News]
    Val -->|Read| Prices[Market Data]

    Kai -->|Synthesize| Report[Buy/Sell Recommendation]
```

## The 3 Pillars

1.  **Fundamental Analysis**: Accesses SEC 10-K/Q filings to assess business health, moats, and risks.
2.  **Sentiment Analysis**: Scans news and social signals to gauge market momentum.
3.  **Valuation Analysis**: Runs quantitative models (DCF, Peer Comps) to determine fair price.

## Agentic Flow

1.  **Planning**: Kai receives a ticker ("Analyze NVDA") and plans which tools to call.
2.  **Execution**: Calls tools in parallel (ADK capability).
3.  **Thinking**: Kai (Gemini 3) reflects on the raw data returned by tools.
4.  **Debate (Internal)**: Kai weighs conflicting signals (e.g., "Good Fundamentals" vs "Bad Sentiment").
5.  **Output**: Generates a structured `DecisionCard`.

## Data Sources

- **Real Data**: Tools fetch from `sec_payload_*.json` (simulated real/static) or live APIs if configured.
- **User Context**: Kai reads `vault.read.finance` to tailor advice to the user's risk profile (Balanced, Aggressive, Conservative).
