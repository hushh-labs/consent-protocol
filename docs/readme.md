# Hushh Documentation

> Single entry point for all project documentation.

Hushh is a **Personal Data Agent (PDA)** platform where users own their data, agents are bound by consent, and encryption keys never leave the client. The architecture enforces four invariants:

1. **BYOK** -- Bring Your Own Key. Server stores ciphertext only.
2. **Consent-First** -- All data access requires a cryptographic consent token. No bypasses.
3. **Tri-Flow** -- Every feature works on Web, iOS, and Android.
4. **Zero-Storage** -- No `sessionStorage` or `localStorage`. All state in React memory.

For repo-level setup instructions, see the root [`README.md`](../README.md) and [`getting_started.md`](../getting_started.md).

---

## I want to...

| Goal | Document |
| ---- | -------- |
| Understand the system architecture | [reference/architecture.md](./reference/architecture.md) |
| Learn how data is stored and encrypted | [world-model.md](../consent-protocol/docs/reference/world-model.md) |
| See every API endpoint | [reference/api-contracts.md](./reference/api-contracts.md) |
| Understand the consent token model | [consent-protocol.md](../consent-protocol/docs/reference/consent-protocol.md) |
| Learn how Kai agents work | [kai-agents.md](../consent-protocol/docs/reference/kai-agents.md) |
| **Build a new agent or operon** | [agent-development.md](../consent-protocol/docs/reference/agent-development.md) |
| Set up my dev environment | [guides/getting-started.md](./guides/getting-started.md) |
| Add a new feature end-to-end | [guides/new-feature.md](./guides/new-feature.md) |
| Build for iOS or Android | [guides/mobile.md](./guides/mobile.md) |
| Implement native SSE streaming | [guides/native-streaming.md](./guides/native_streaming.md) |
| Check environment variables | [reference/env-and-secrets.md](./reference/env-and-secrets.md) |
| Understand FCM notifications | [fcm-notifications.md](../consent-protocol/docs/reference/fcm-notifications.md) |
| Review the design system | [reference/design-system.md](./reference/design-system.md) |
| Review CI pipeline | [reference/ci.md](./reference/ci.md) |
| Check iOS parity status | [audits/ios-parity.md](./audits/ios-parity.md) |
| Read the product vision | [vision/README.md](./vision/README.md) |
| Deep-dive Agent Kai vision | [vision/kai/README.md](./vision/kai/README.md) |

---

## Sub-Project Documentation

| Location | Purpose | Entry Point |
| -------- | ------- | ----------- |
| `consent-protocol/docs/` | Backend-specific docs | [README.md](../consent-protocol/docs/README.md) |
| `hushh-webapp/docs/` | Frontend-specific docs | [plugin-api-reference.md](../hushh-webapp/docs/plugin-api-reference.md) |

---

## Directory Structure

```
docs/
  README.md                          # This file (entry point)

  reference/                         # What IS the system
    architecture.md                  # System diagram, backend, frontend, DB, security
    api-contracts.md                 # Every endpoint, auth, developer API
    design-system.md                 # Morphy-UX + Shadcn design system
    env-and-secrets.md               # All environment variables and GCP secrets
    ci.md                            # CI/CD pipeline

  guides/                            # How do I DO something
    getting-started.md               # Prerequisites, setup, run, deploy
    new-feature.md                   # Feature checklist (tri-flow)
    mobile.md                        # Capacitor iOS/Android development
    native_streaming.md              # Native SSE streaming implementation

  audits/                            # Living tracking matrices
    ios-parity.md                    # iOS proxy parity matrix

  vision/                            # Where is this going
    README.md                        # Philosophy, roadmap, community strategy
    kai/
      README.md                      # Agent Kai full product vision
      data/
        investor-master-list.md      # Target investor profiles
        investor_profiles_sample.json # Sample data

consent-protocol/docs/
  README.md                          # Backend entry point
  manifesto.md                       # Hushh philosophy (timeless)
  mcp-setup.md                       # MCP server setup for Claude Desktop
  reference/
    agent-development.md             # DNA model, operons, how to build agents
    world-model.md                   # Two-table architecture, BYOK, MCP scoping
    kai-agents.md                    # 3 agents, debate engine, streaming, Renaissance
    consent-protocol.md              # Token model, security layers, compliance
    fcm-notifications.md             # FCM push notification architecture

hushh-webapp/docs/
  plugin-api-reference.md            # Native Capacitor plugin APIs
```

**22 files across two documentation homes. Every file earns its place.**
