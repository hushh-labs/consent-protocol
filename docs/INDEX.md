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
- [Route Contracts](technical/ROUTE_CONTRACTS.md) - Web/native/backend endpoint contracts and enforcement

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

- ✅ **VAULT_OWNER tokens**: Vault owners now use consent tokens for all data access (no bypasses)
- ✅ **Token reuse**: Active tokens are reused while valid (reduces database writes, improves performance)
- ✅ **Unified validation**: Food, Professional, and Kai agents all validate tokens identically
- ✅ **Platform support**: iOS Swift + Android Kotlin + Web all enforce token validation
- ✅ **Audit trail**: Every vault access logged to `consent_audit` table for compliance
- ✅ **Token expiry**: 24-hour VAULT_OWNER tokens, 7-day agent tokens
- ✅ **Compliance-ready**: CCPA/GDPR/SEC audit trail with exportable logs

**Updated Documentation**:

- [Consent Implementation](technical/consent-implementation.md) - Complete VAULT_OWNER token guide
- [Architecture](technical/architecture.md) - Updated security layers
- [Project Context Map (Canonical)](PROJECT_CONTEXT_MAP.md) - Repo topology, consent surfaces, Capacitor-safe development rules

---

## 🔑 Quick Links

### For Developers

| Topic                   | Link                                                             | Description                    |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **Getting Started**     | [README](../README.md)                                           | Setup and installation guide   |
| **System Architecture** | [architecture.md](technical/architecture.md)                     | High-level system overview     |
| **Consent Protocol**    | [consent-implementation.md](technical/consent-implementation.md) | Authentication and token flows |
| **Context Map**         | [PROJECT_CONTEXT_MAP.md](PROJECT_CONTEXT_MAP.md)                 | Canonical repo + flow map      |
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
│  Frontend (Next.js + Capacitor)                          │
│  ├─ React 19 + Morphy-UX Components                     │
│  ├─ Vault Context (Memory-only keys)                     │
│  └─ Platform-aware Services                              │
│                                                           │
│  Native Layer (8 Capacitor Plugins)                      │
│  ├─ HushhAuth, HushhVault, HushhConsent, etc.           │
│  └─ Direct HTTP to Backend (bypasses Next.js proxy)     │
│                                                           │
│  Backend (FastAPI + HushhMCP)                            │
│  ├─ Consent Protocol (VAULT_OWNER tokens)               │
│  ├─ Agent Endpoints (Food, Professional, Kai)           │
│  └─ MCP Server (External AI integration)                │
│                                                           │
│  Storage (PostgreSQL + Cloud SQL)                        │
│  └─ AES-256-GCM Encrypted Vault                         │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Model

### Four-Layer Authentication (Correct Order)

1. **Firebase Auth** - Identity verification (OAuth) - **Always first**
2. **Vault Unlock** - Passphrase or Recovery Key (zero-knowledge)
   - Current: Passphrase-based (PBKDF2) + Recovery key
   - Future: Passkey/FaceID/TouchID (passphrase as fallback)
3. **VAULT_OWNER Token** - Cryptographic consent for data access (24h)
4. **Agent Tokens** - Scoped permissions for AI operations (7 days)

### Key Principles

- ✅ **Consent-First**: All data access requires valid consent tokens (no exceptions)
- ✅ **Zero-Knowledge**: Vault keys never leave device (BYOK)
- ✅ **Memory-Only**: Vault keys stored in React Context (lost on refresh)
- ✅ **Token Reuse**: Active tokens reused to prevent duplicates
- ✅ **Auditable**: Complete logging of all token operations to `consent_audit`
- ✅ **Platform-Agnostic**: Web, iOS, Android all enforce identical validation

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

_Last Updated: January 2026 | Version: 6.1 | Documentation Audit + Accuracy Review_
