# 🤫 Hushh Kai Demo - Deal Optimizer Agent

> **MVP Demo**: Demonstrating Hushh's vision using ADK + MCP protocols

This is a proof-of-concept implementation of Hushh's **Kai persona** - the "hustler" personal agent that helps users optimize deals, specifically for device resale.

## 🎯 What This Demonstrates

| Hushh Concept          | Implementation                              |
| ---------------------- | ------------------------------------------- |
| Kai "hustler" persona  | Agent personality that maximizes user value |
| MCP consent pattern    | Asks permission before accessing data       |
| ADK + MCP integration  | MCPToolset connecting to FastMCP server     |
| Personal financial CFO | Specific $ recommendations for resale       |
| Actionable advice      | Platform comparisons with real numbers      |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 KAI AGENT (ADK)                              │
│           Gemini 2.5 Flash + Hustler Persona                 │
│                    Port: 8000                                │
└─────────────────────────────┬───────────────────────────────┘
                              │ MCP Protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                MCP SERVER (FastMCP)                          │
│              Consent-Aware Tools                             │
│                    Port: 8080                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Consent   │ │   Resale    │ │   Timing    │            │
│  │   Request   │ │    Value    │ │   Advice    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) package manager
- Google API Key (from [AI Studio](https://aistudio.google.com/apikey))

### Setup

```bash
# 1. Navigate to demo folder
cd hushh-kai-demo

# 2. Copy environment file and add your API key
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# 3. Install dependencies
uv sync
```

### Running the Demo

**Terminal 1 - Start MCP Server:**

```bash
uv run mcp-server/server.py
# Expected: 🚀 Hushh Kai MCP Server starting on port 8080
```

**Terminal 2 - Start Kai Agent:**

```bash
adk web kai_agent
# Expected: Web UI at http://localhost:8000
```

### Demo Conversation

Open http://localhost:8000 and try:

```
You: I want to sell my iPhone 15 Pro 256GB

Kai: [Asks for consent first - MCP pattern]
     [Then provides market analysis with $ amounts]
     [Gives specific platform recommendation]
```

## 📁 Project Structure

```
hushh-kai-demo/
├── .env.example          # Environment template
├── .gitignore
├── pyproject.toml        # Dependencies
├── README.md             # This file
├── kai_agent/            # ADK Agent
│   ├── __init__.py
│   └── agent.py          # Kai persona + MCPToolset
└── mcp-server/           # MCP Server
    └── server.py         # FastMCP with consent tools
```

## 🔧 MCP Tools Available

| Tool                       | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `request_data_consent`     | Ask user permission (Hushh consent pattern) |
| `get_device_resale_value`  | Get prices across eBay, Swappa, Apple, etc. |
| `get_market_timing_advice` | When to sell for max value                  |
| `compare_upgrade_options`  | What to buy with resale money               |

## 🎭 About Kai Persona

From hushh.md:

> **Kai (Boy)** – Hustler on a mission
>
> - Sells his old iPhone to fund a gaming laptop
> - Wants to optimize everything: his data, his cash, his time

This demo embodies that personality with an agent that:

- Speaks directly and confidently
- Always gives specific $ amounts
- Focuses on maximizing user value
- Asks for consent before accessing data

## 📚 Learn More

- [Hushh.ai](https://www.hushh.ai/) - Company website
- [ADK Documentation](https://google.github.io/adk-docs/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Currency Agent Sample](../adk-samples-main/python/agents/currency-agent/) - Pattern reference

---

Built with ❤️ to demonstrate Hushh's vision of consent-first, personality-driven AI agents.
