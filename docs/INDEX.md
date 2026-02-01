# Hushh Documentation Index

> **Task-Based Navigation** — Find docs by what you want to do, not by number.  
> **Last Updated**: January 2026

---

## Quick Start

| Task | Document |
|------|----------|
| **Set up environment** | [Getting Started](../getting_started.md) |
| **Understand the system** | [Project Context Map](project_context_map.md) |
| **Make first contribution** | [Contributor Onboarding](guides/contributor_onboarding.md) |

---

## Core Documentation

### Architecture & Security

| Document | Purpose |
|----------|---------|
| [Project Context Map](project_context_map.md) | **Start here** - Repo topology, invariants, tri-flow rules |
| [Architecture](reference/architecture.md) | System design, ADK agents, service layer |
| [Consent Protocol](reference/consent_protocol.md) | VAULT_OWNER tokens, security model, compliance |

### Building Features

| Document | Purpose |
|----------|---------|
| [Feature Checklist](guides/feature_checklist.md) | Step-by-step feature development |
| [Route Contracts](reference/route_contracts.md) | API endpoint specifications |
| [Mobile Development](guides/mobile_development.md) | Capacitor plugins, native code |

### Building Agents

| Document | Purpose |
|----------|---------|
| [Agent Development](agents/agent_development_guidelines.md) | Complete agent guide |
| [ADK Implementation](agents/adk_implementation.md) | Google ADK integration |
| [A2A Protocol](agents/a2a_implementation.md) | Agent-to-Agent communication |

---

## Reference

| Topic | Document |
|-------|----------|
| Database Schema | [database_schema.md](reference/database_schema.md) |
| Service Layer | [database_service_layer.md](reference/database_service_layer.md) |
| Developer API | [developer_api.md](reference/developer_api.md) |
| MCP Integration | [mcp_integration.md](reference/mcp_integration.md) |
| Frontend Design | [frontend_design_system.md](reference/frontend_design_system.md) |
| Agent Kai | [kai.md](reference/kai.md) |

---

## Deployment

| Document | Purpose |
|----------|---------|
| [Deployment Guide](guides/deployment.md) | Production deployment |
| [Deployment Workflows](deployment_workflows.md) | CI/CD pipelines |

---

## Directory Structure

```
docs/
├── index.md                    # This file
├── project_context_map.md      # Canonical repo map (START HERE)
│
├── reference/                  # Technical reference
│   ├── architecture.md         # System architecture
│   ├── consent_protocol.md     # Security & consent
│   ├── database_schema.md      # Database tables
│   ├── route_contracts.md      # API contracts
│   └── kai.md                  # Agent Kai
│
├── guides/                     # How-to guides
│   ├── feature_checklist.md    # Building features
│   ├── mobile_development.md   # Capacitor/native
│   └── deployment.md           # Deployment
│
├── agents/                     # Agent development
│   ├── agent_development_guidelines.md
│   ├── adk_implementation.md
│   └── a2a_implementation.md
│
└── business/                   # Business docs
    └── roadmap.md
```
