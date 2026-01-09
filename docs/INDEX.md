# Hushh Documentation - Quick Reference

Welcome to the Hushh Research documentation! This index provides a comprehensive guide to all documentation resources.

---

## 📚 Documentation Structure

### Technical Documentation

**Core Architecture**:

- [**Architecture Overview**](technical/architecture.md) - Complete system architecture with on-device AI, consent protocol, and security design
- [**Consent Implementation**](technical/consent-implementation.md) - ✨ **UPDATED!** Detailed VAULT_OWNER token architecture and consent flow

**Implementation Guides**:

- [Database Schema](technical/database-schema.md) - PostgreSQL tables and relationships
- [Mobile Architecture](technical/mobile.md) - iOS/Android native implementations
- [MCP Integration](technical/mcp-integration.md) - Model Context Protocol for AI agents
- [Deployment Guide](technical/deployment.md) - Production deployment instructions

**Feature Documentation**:

- [Agent Kai](technical/kai.md) - Investment analysis agent with SEC compliance
- [Developer API](technical/developer-api.md) - External developer integration
- [Frontend Design System](technical/frontend-design-system.md) - UI/UX components

### Business Documentation

- [Business Overview](business/overview.md) - Product vision and market positioning
- [Roadmap](business/roadmap.md) - Feature timeline and milestones

### Vision & Planning

- [Vision Overview](vision/README.md) - Long-term product vision
- [Agent Navigation](vision/agent-nav/README.md) - Multi-agent navigation design
- [Food & Dining Agent](vision/food-dining/README.md) - Food recommendation system
- [Agent Kai Vision](vision/kai/README.md) - Investment agent vision and preparation

---

## 🆕 Recent Updates (January 2026)

### VAULT_OWNER Token Architecture ✨

The consent protocol has been significantly enhanced with a **consent-first architecture** that eliminates all authentication bypasses:

**Key Changes**:

- ✅ **VAULT_OWNER tokens**: Vault owners now use consent tokens instead of bypasses
- ✅ **Token reuse**: Tokens are reused while valid (reduces database writes)
- ✅ **Modular agents**: New Food and Professional agents with uniform validation
- ✅ **Platform support**: iOS Swift + Android Kotlin plugins implemented
- ✅ **Audit trail**: All vault access logged for compliance

**Updated Documentation**:

- [Consent Implementation](technical/consent-implementation.md) - Complete VAULT_OWNER token guide
- [Architecture](technical/architecture.md) - Updated security layers

**See Also**:

- Implementation Plan: `.gemini/antigravity/brain/.../implementation_plan.md`
- Walkthrough: `.gemini/antigravity/brain/.../walkthrough.md`

---

## 🔑 Quick Links

### For Developers

| Topic                   | Link                                                             | Description                    |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **Getting Started**     | [README](../README.md)                                           | Setup and installation guide   |
| **System Architecture** | [architecture.md](technical/architecture.md)                     | High-level system overview     |
| **Consent Protocol**    | [consent-implementation.md](technical/consent-implementation.md) | Authentication and token flows |
| **Database**            | [database-schema.md](technical/database-schema.md)               | Schema and queries             |
| **API Reference**       | [developer-api.md](technical/developer-api.md)                   | REST API documentation         |

### For Product & Business

| Topic               | Link                                 | Description        |
| ------------------- | ------------------------------------ | ------------------ |
| **Business Case**   | [overview.md](business/overview.md)  | Value proposition  |
| **Product Roadmap** | [roadmap.md](business/roadmap.md)    | Feature timeline   |
| **Vision**          | [vision/README.md](vision/README.md) | Long-term strategy |

### For Mobile Development

| Topic                   | Link                                     | Description                |
| ----------------------- | ---------------------------------------- | -------------------------- |
| **Mobile Architecture** | [mobile.md](technical/mobile.md)         | iOS/Android implementation |
| **Capacitor Plugins**   | [mobile.md#plugins](technical/mobile.md) | Native plugin guide        |

---

## 🏗️ Architecture at a Glance

```
┌──────────────────────────────────────────────────────────┐
│              Hushh System Architecture                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  On-Device AI (iOS/Android)                              │
│  ├─ MLX (iOS) / Gemma (Android)                          │
│  └─ Local MCP Server → SQLite Vault                      │
│                                                           │
│  Frontend (Next.js + Capacitor)                          │
│  ├─ React Components                                     │
│  ├─ Vault Context (Memory-only)                          │
│  └─ Platform-aware Services                              │
│                                                           │
│  Backend (FastAPI + HushhMCP)                            │
│  ├─ Consent Protocol (VAULT_OWNER tokens)               │
│  ├─ Agent Endpoints (Food, Professional, Kai)           │
│  └─ MCP Server (External AI integration)                │
│                                                           │
│  Storage (PostgreSQL + Cloud SQL)                        │
│  └─ E2E Encrypted Vault                                  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Model

### Four-Layer Authentication

1. **Firebase Auth** - Identity verification
2. **Passphrase** - Zero-knowledge vault unlock
3. **Firebase ID Token** - Backend identity validation
4. **VAULT_OWNER Token** - Master consent token (NEW!)

### Key Principles

- ✅ **Consent-First**: All data access requires consent tokens
- ✅ **Zero-Knowledge**: Passcodes never leave device
- ✅ **Memory-Only**: Vault keys stored in React Context
- ✅ **Auditable**: Complete logging of all token operations

---

## 📖 Documentation Conventions

### File Organization

```
docs/
├── INDEX.md                 # This file
├── README.md                # Main project README
├── technical/               # Developer documentation
├── business/                # Business documentation
└── vision/                  # Product vision
```

### Document Status

- ✅ **Updated** - Reflects current implementation
- 🚧 **In Progress** - Being actively updated
- ⚠️ **Outdated** - Needs review
- 📝 **Planned** - Future documentation

---

## 🤝 Contributing to Documentation

When updating documentation:

1. **Be Specific**: Include code examples and diagrams
2. **Version Updates**: Note version and date at bottom
3. **Cross-Reference**: Link to related docs
4. **Keep Current**: Update when implementation changes

---

_Last Updated: January 2026 | Version: 5.0 | VAULT_OWNER Token Release_
