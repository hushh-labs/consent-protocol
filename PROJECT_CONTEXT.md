# HUSHH-KAI-DEMO - PROJECT CONTEXT

> Comprehensive context for AI agents and developers.
> This file documents the ENTIRE monorepo - both frontend and backend.

---

## 🎯 PROJECT OVERVIEW

**Repository:** hushh-kai-demo
**Type:** Full-Stack AI Agent Platform (Monorepo)
**Purpose:** Consent-first personal AI with live agents

### What Hushh Does

Hushh is a **consent-first personal AI platform** where users own their data and control what AI agents can access.

> **"Your Data. Your Business."**

### The Five Pillars

| Pillar          | Purpose                                         |
| --------------- | ----------------------------------------------- |
| **Hushh Agent** | AI companion that acts with context and consent |
| **Hushh Vault** | Encrypted personal data storage                 |
| **Hushh Link**  | Identity and permissions layer                  |
| **Hushh Flow**  | APIs and monetization for brands                |
| **Hushh Grid**  | Compute engine for agentic AI                   |

---

## 📁 MONOREPO STRUCTURE

```
hushh-kai-demo/
├── PROJECT_CONTEXT.md      ← YOU ARE HERE
├── README.md               ← Project overview
│
├── hushh-adk-agents/       ← BACKEND: Google ADK Agents (Python)
│   ├── agent.py            ← Root agent entry point
│   ├── kai_agent/          ← Hustler/Optimizer agent
│   ├── kushal_agent/       ← Professional/Digital Twin agent
│   ├── nav_agent/          ← Creator/Data Sovereignty agent
│   ├── tech_fusion_agent/  ← Orchestrator agent
│   ├── ._mcp_kai/          ← MCP tools (to be built)
│   ├── pyproject.toml      ← Python dependencies
│   └── Dockerfile          ← Cloud Run deployment
│
└── hushh-experimental/     ← FRONTEND: Next.js Application
    ├── app/                ← Next.js App Router
    ├── components/ui/      ← 45 reusable UI components
    ├── lib/morphy-ux/      ← Ripple effects system
    ├── globals.css         ← Design system
    ├── README.md           ← Frontend docs
    └── .agent/workflows/   ← AI agent workflows
```

---

## 🤖 BACKEND: ADK AGENTS

### Agent Architecture

Each agent is a **specialized AI persona** with unique capabilities:

| Agent           | File                 | Codename     | Purpose                                |
| --------------- | -------------------- | ------------ | -------------------------------------- |
| **Kai**         | `kai_agent/`         | HUSTLER      | Time/money optimization, deals, resale |
| **Kushal**      | `kushal_agent/`      | PROFESSIONAL | Digital twin, career context, resume   |
| **Nav**         | `nav_agent/`         | CREATOR      | Data sovereignty, monetization         |
| **Tech Fusion** | `tech_fusion_agent/` | ORCHESTRATOR | Multi-agent coordination               |

### Technology Stack

- **Framework:** Google ADK (Agent Development Kit)
- **Model:** Gemini 2.5 Flash (1M token context)
- **Protocol:** A2A (Agent-to-Agent)
- **Deployment:** Google Cloud Run
- **Tools:** MCP (Model Context Protocol)

### Live Deployment

**Base URL:** `https://hushh-kai-demo-832747646411.us-central1.run.app`

```bash
# Health check
curl https://hushh-kai-demo-832747646411.us-central1.run.app/

# Chat with agent
curl -X POST .../run \
  -H "Content-Type: application/json" \
  -d '{"app_name":"hushh_agent","user_id":"u1","session_id":"s1","new_message":{"role":"user","parts":[{"text":"Hello"}]}}'
```

### MCP Tools (To Be Built)

Location: `._mcp_kai/`

Tools to implement:

- Device valuation
- Market price comparison
- Consent-based data sharing
- Brand negotiation

---

## 🎨 FRONTEND: NEXT.JS

### Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + Custom Design System
- **Animation:** Framer Motion
- **Theme:** iOS Liquid Glass + Iron Man Colors

### Pages

| Route       | File                | Purpose                           |
| ----------- | ------------------- | --------------------------------- |
| `/`         | `page.tsx`          | Landing page                      |
| `/jarvis`   | `jarvis/page.tsx`   | Chat interface (connected to ADK) |
| `/consent`  | `consent/page.tsx`  | Data permissions dashboard        |
| `/personas` | `personas/page.tsx` | Agent persona gallery             |
| `/docs`     | `docs/page.tsx`     | Documentation                     |

### API Routes

| Endpoint         | Purpose             |
| ---------------- | ------------------- |
| `POST /api/chat` | Proxy to ADK agents |

### Design System

**Colors:**

- Primary: `#DC143C` (Crimson Red)
- Secondary: `#C7A035` (Gold)
- Background: `#FAFAFA`

**Key Classes:**

```css
.glass              /* Frosted glass effect */
/* Frosted glass effect */
.text-headline      /* 2.5rem heading */
.card-glass         /* Glass card */
.nav-glass; /* Navigation bar */
```

**Component Pattern:**

```tsx
// Use Button with showRipple (NOT RippleButton)
<Button variant="gradient" effect="glass" showRipple>
  Click
</Button>

// Use Card with showRipple for clickable items
<Card variant="none" effect="glass" showRipple onClick={}>
  ...
</Card>
```

### Frontend Workflows

See `.agent/workflows/`:

- `/add-new-page` - Page creation template
- `/add-new-component` - Component creation template
- `/design-system` - Quick reference

---

## 🔌 API FLOW

```
User → Next.js Frontend → /api/chat → Google ADK (Cloud Run) → Gemini 2.5
                              ↓
                        Agent Response
                              ↓
                      Frontend Display
```

### Request Format

```json
{
  "message": "Check my spending",
  "mode": "curator",
  "sessionId": "user-123"
}
```

### Response Format

```json
{
  "response": "Based on your financial data...",
  "mode": "curator",
  "dataUsed": ["Financial"],
  "sessionId": "user-123"
}
```

---

## 📊 DATA CATEGORIES

| Category     | Icon | ID             | Examples                       |
| ------------ | ---- | -------------- | ------------------------------ |
| Financial    | 💰   | `financial`    | Spending, budgets, investments |
| Calendar     | 📅   | `calendar`     | Events, meetings, reminders    |
| Professional | 💼   | `professional` | Skills, projects, resume       |
| Health       | ❤️   | `health`       | Fitness, wellness, medications |
| Preferences  | ⚙️   | `preferences`  | Likes, style, settings         |
| Network      | 👥   | `network`      | Contacts, relationships        |

---

## ⚠️ KEY RULES

### Backend (ADK)

1. Each agent is a separate Python module
2. A2A protocol for agent communication
3. MCP for external tool integration
4. Consent-aware data access

### Frontend (Next.js)

1. **ALWAYS** use `Button showRipple` (not RippleButton)
2. **NEVER** use `transform: scale()` on hover
3. **ALWAYS** use CSS variables for colors
4. **ALWAYS** use `Card` component for content blocks

---

## 🚀 QUICK START

### Backend

```bash
cd hushh-adk-agents
uv sync
uv run adk api_server
```

### Frontend

```bash
cd hushh-experimental
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📋 FOR AI AGENTS

When working on this project:

1. **Check which part** - Backend (`hushh-adk-agents`) or Frontend (`hushh-experimental`)
2. **Use existing patterns** - Don't reinvent components or agent structures
3. **Follow workflows** - See `.agent/workflows/` for templates
4. **Respect consent** - Every data access needs user permission

### Backend Tasks

- Adding new agents → Follow `kai_agent/` pattern
- Adding MCP tools → Use `._mcp_kai/` directory
- Deploying → Use `Dockerfile` and Cloud Run

### Frontend Tasks

- Adding pages → Use `/add-new-page` workflow
- Adding components → Use `/add-new-component` workflow
- Styling → Use design system classes from `globals.css`

---

_This context file enables any AI or developer to contribute effectively to either frontend or backend._
