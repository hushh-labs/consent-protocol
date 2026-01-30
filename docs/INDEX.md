# Hushh Documentation Index

> **Task-Based Navigation** — Find docs by what you want to do, not by number.  
> **Last Updated**: January 2026 | Version: 8.0 | Task-Based Organization

---

## I Want To...

### 🚀 Get Started

| Task | Document | Description |
|------|----------|-------------|
| **Make my first contribution** | [Contributor Onboarding Guide](guides/contributor_onboarding.md) | Step-by-step contribution walkthrough |
| **Set up my environment** | [Getting Started Guide](../getting_started.md) | Complete setup instructions |
| **Understand the system** | [Project Overview](readme.md) | High-level system overview |
| **See the big picture** | [Project Context Map](project_context_map.md) | Repo topology and tri-flow rules |

### 🛠️ Build Features

| Task | Document | Description |
|------|----------|-------------|
| **Build a new feature** | [Feature Checklist](guides/feature_checklist.md) | Step-by-step feature development |
| **Understand tri-flow** | [Project Context Map](project_context_map.md) | Web + iOS + Android architecture |
| **Define API contracts** | [Route Contracts](reference/route_contracts.md) | Endpoint contracts and enforcement |

### 🤖 Build Agents

| Task | Document | Description |
|------|----------|-------------|
| **Build an agent** | [Agent Development Guidelines](agents/agent_development_guidelines.md) | Complete agent development guide |
| **Use Google ADK** | [ADK Implementation](agents/adk_implementation.md) | Google ADK integration |
| **Follow ADK standards** | [ADK Standards](agents/adk_standards.md) | 3-step agent build process |
| **Enable A2A communication** | [A2A Implementation](agents/a2a_implementation.md) | Agent-to-Agent protocol |

### 📱 Build Mobile Apps

| Task | Document | Description |
|------|----------|-------------|
| **Develop for iOS/Android** | [Mobile Development](guides/mobile_development.md) | Capacitor plugins and native code |
| **Understand platform routing** | [Project Context Map](project_context_map.md) | Web vs native runtime differences |

### 📚 Reference Documentation

| Topic | Document | Description |
|-------|----------|-------------|
| **System Architecture** | [Architecture](reference/architecture.md) | Complete system design |
| **Consent Protocol** | [Consent Implementation](reference/consent_protocol.md) | VAULT_OWNER tokens and consent flow |
| **Database Schema** | [Database Schema](reference/database_schema.md) | PostgreSQL tables and relationships |
| **Service Layer** | [Database Service Layer](reference/database_service_layer.md) | VaultDBService, ConsentDBService |
| **API Reference** | [Developer API](reference/developer_api.md) | External developer API |
| **Route Contracts** | [Route Contracts](reference/route_contracts.md) | Web/native/backend contracts |
| **MCP Integration** | [MCP Integration](reference/mcp_integration.md) | Model Context Protocol |
| **Frontend Design** | [Frontend Design System](reference/frontend_design_system.md) | UI/UX components |
| **User Schema** | [Base User Schema](reference/base_user_schema.md) | User schema definitions |
| **Agent Kai** | [Kai Documentation](reference/kai.md) | Investment analysis agent |

### 🚢 Deploy

| Task | Document | Description |
|------|----------|-------------|
| **Deploy to production** | [Deployment Guide](guides/deployment.md) | Production deployment |
| **Deployment workflows** | [Deployment Workflows](deployment_workflows.md) | CI/CD and workflows |

### 💼 Business & Vision

| Topic | Document | Description |
|-------|----------|-------------|
| **Business Overview** | [Business Overview](business/overview.md) | Product vision |
| **Roadmap** | [Roadmap](business/roadmap.md) | Feature timeline |
| **Vision** | [Vision Overview](vision/readme.md) | Long-term strategy |

---

## Quick Reference by Role

### For Developers

**Starting a new feature:**
1. [Feature Checklist](guides/feature_checklist.md) — Step-by-step guide
2. [Project Context Map](project_context_map.md) — Understand tri-flow
3. [Route Contracts](reference/route_contracts.md) — Define API contracts

**Understanding the system:**
1. [Architecture](reference/architecture.md) — System design
2. [Consent Protocol](reference/consent_protocol.md) — Security model
3. [Database Schema](reference/database_schema.md) — Data structure

**Building agents:**
1. [Agent Development Guidelines](agents/agent_development_guidelines.md) — Complete guide
2. [ADK Implementation](agents/adk_implementation.md) — Google ADK
3. [A2A Implementation](agents/a2a_implementation.md) — Agent communication

### For Mobile Developers

1. [Mobile Development](guides/mobile_development.md) — Capacitor and plugins
2. [Project Context Map](project_context_map.md) — Platform differences
3. [Route Contracts](reference/route_contracts.md) — Native API contracts

### For AI Agents

**Semantic paths that match code references:**
- `docs/technical/architecture.md` → [Architecture](reference/architecture.md)
- `docs/technical/consent-implementation.md` → [Consent Protocol](reference/consent_protocol.md)
- `docs/project_context_map.md` → [Project Context Map](project_context_map.md)
- `docs/guides/feature_checklist.md` → [Feature Checklist](guides/feature_checklist.md)

All code references work via symlinks for backward compatibility.

---

## Directory Structure

```
docs/
├── index.md                    # This file (task-based navigation)
├── readme.md                   # Project overview
├── project_context_map.md      # Canonical repo map
├── deployment_workflows.md     # Deployment workflows
│
├── guides/                     # How-to guides
│   ├── contributor_onboarding.md # First contribution guide
│   ├── feature_checklist.md    # Building features
│   ├── mobile_development.md   # Mobile/Capacitor
│   └── deployment.md           # Deployment guide
│
├── reference/                  # Reference documentation
│   ├── architecture.md         # System architecture
│   ├── consent_protocol.md     # Consent implementation
│   ├── database_schema.md      # Database reference
│   ├── database_service_layer.md
│   ├── route_contracts.md      # API contracts
│   ├── mcp_integration.md      # MCP integration
│   ├── developer_api.md        # External API
│   ├── frontend_design_system.md
│   ├── base_user_schema.md
│   └── kai.md                  # Agent Kai
│
├── agents/                     # Agent development
│   ├── adk_implementation.md
│   ├── adk_standards.md
│   ├── agent_development_guidelines.md
│   └── a2a_implementation.md
│
├── business/                   # Business documentation
│   ├── overview.md
│   ├── roadmap.md
│   ├── launch_strategy.md
│   └── discord_blueprint.md
│
└── vision/                     # Product vision
    ├── readme.md
    ├── agent_nav/readme.md
    ├── food_dining/readme.md
    └── kai/readme.md
```

---

## Backward Compatibility

Old paths may work via symlinks if configured:
- `docs/README.md` → `docs/readme.md`
- `docs/PROJECT_CONTEXT_MAP.md` → `docs/project_context_map.md`
- `docs/technical/architecture.md` → `docs/reference/architecture.md`
- `docs/technical/consent-implementation.md` → `docs/reference/consent_protocol.md`

Note: All files now use snake_case without numbers for consistency.

---

_Last Updated: January 2026 | Version: 8.0 | Task-Based Organization_
