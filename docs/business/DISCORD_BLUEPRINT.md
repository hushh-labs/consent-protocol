# Hushh Community Blueprint: Discord

> **Execution Role**: Founding Engineer / Community Architect
> **Objective**: Convert passive traffic into active builders. Focus on simplicity and technical depth.

---

## 🏗️ Channel Architecture

**Category: 🏁 START**

- `#index` (Text) - Read Only. Tech Stack, Links, & Warnings.
- `#rules` (Text) - Read Only. Community Guidelines.
- `#manifesto` (Text) - Read Only. Core Philosophy & Vision.

**Category: 🛠️ ENGINEERING**

- `#builders` (Text) - General dev discussion, Operon building, and tech deep-dives.
- `#compliance` (Text) - Consent Protocol, Token Logic, Legal, and ADK/AP2 standards.
- `#beta-testing` (Text) - TestFlight / APK feedback and bug reports.

**Category: 💬 LABS**

- `#general` (Text) - Main community chat.
- `#conference-1` (Voice) - Open VC for pair programming and meetings.

---

## 📌 Pinned Messages (Copy-Paste Ready)

### 🏁 START

#### #index

**Instruction:** Pin this as the ONLY message in this channel.

```markdown
# Welcome to the Hushh Research Lab.

We are building the **Fiduciary Data Layer** for the AI era.
We don't build "wrappers". We build **Vaults**.

### :mobile_phone: Live Status: Pre-Alpha Preview

- **iOS App**: [Download on App Store](https://apps.apple.com/us/app/hushh-consent-first-agents/id6757718917)
- **Alpha Access (TestFlight)**: Check pinned message in <#alpha-feedback>
- **Web App (Preview)**: [Live Dashboard](https://hushh-webapp-1006304528804.us-central1.run.app/dashboard)
- **Vision**: [Watch the Manifesto](https://youtu.be/sXNiKR7CDtQ?si=M-9ZOZPrsg5Dh3aq)
- **Official Site**: [hushh.ai](https://hushh.ai)

### Founder's Desk

[Manish Sainani](https://www.linkedin.com/in/manishsainani/) (Ex-Google, Microsoft, Splunk)

### The Tech Stack (Read Carefully)

We follow a strict **Tri-Flow Architecture**. This modular approach ensures that our system is scalable, maintainable, and free of "AI slop" or cluttered logic.

**1. Protocol & Backend**

- **[Python 3.13 (FastAPI)](https://fastapi.tiangolo.com/)**: The brain.
- **Agent Discovery**: Powered by [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for interoperability and context sharing.
- **Consent Logic**: Inspired by [Google ADK A2A](https://developers.google.com/assistant/conversational/agent-to-agent) & [AP2](https://github.com/google/android-protection-review) standards for high-trust financial literacy.
- **Docs**: [Consent Protocol Documentation](https://github.com/hushh-labs/hushh-research/tree/main/consent-protocol/docs)

**2. On-Device AI (Priority)**

- **Priority 1**: Apple Silicon ([MLX Framework](https://github.com/ml-explore/mlx)).
- **Priority 2**: Android ([Gemini Nano](https://ai.google.dev/edge/gemini-nano) / LiteRT).

**3. Frontend & Native (Critical Warning)**

- **Stack**: [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/) + [Capacitor 8](https://capacitorjs.com/).
- **🚨 TRI-FLOW RULE**: Next.js API Routes (`/api/...`) are **NOT accessible** to native apps. Feature parity requires implementing native Swift/Kotlin plugins to ensure architectural integrity.
- **Reference**: [Route Contracts & Tri-Flow Guide](https://github.com/hushh-labs/hushh-research/blob/main/docs/reference/route_contracts.md)

### 🗺️ Participation

- **Dev & Operons?** -> Join <#builders>
- **Protocol & Compliance?** -> Join <#compliance>
- **Pre-Alpha Testing?** -> Feedback in <#alpha-feedback>
- **Chat?** -> <#general>

> "Consent is not a checkbox. It's a key."
```

#### #rules

**Instruction:** Pin this message.

```markdown
# 📜 Code of Conduct

**1. Be Respectful**
We are a diverse community of builders. Harassment, hate speech, or trolling will result in an immediate ban. Treat everyone with professional courtesy.

**2. No Spam or Self-Promotion**
Do not DM members with unsolicited offers. Do not shill unrelated tokens or projects.
_Exception:_ You may share tools relevant to the Hushh ecosystem in <#builders>.

**3. Stay on Topic**

- **<#builders>**: Engineering, code, ML models.
- **<#compliance>**: Legal, governance, protocol specs.
- **<#general>**: Casual chat and welcomes.

**4. Protect Privacy**
Do not doxx yourself or others. Never share private keys or `.env` files.

**5. Open Source First**
We encourage public building. If you find a bug, please report it in <#alpha-feedback> or open a GitHub Issue.

> _Violation of these rules may lead to a warning or ban at the discretion of the Maintainers._
```

#### #manifesto

**Instruction:** Pin this message.

```markdown
# The Hushh Doctrine

> 1. **Consent-First**: No token? No access. Even the user needs a token to open their own vault.
> 2. **Zero-Knowledge**: Keys never leave your device. The server only sees ciphertext.
> 3. **Local Intelligence**: AI should run where the data is (On-Device whenever possible).
> 4. **Open Source Audit**: Trust requires transparency. Our protocol is open.

### 🤖 Agent Kai: The Future of Financial Literacy

We are moving towards a world where a motivated student (Middle School and up) can learn and a professional can make informed decisions. Agent Kai is your **Explainable Investing Copilot**.

- **Source of Truth**: [Kai: Your Investing Copilot](https://gamma.app/docs/Kai-Your-Explainable-Investing-Copilot-fa72hb57f4dsoi5?mode=doc)
- **Framework**: Powered by [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for secure context sharing.

### 📚 Official Knowledge Base

Start here to understand the "Why" and the "How".

- **The Grand Plan**: [readme.md - Vision & Roadmap](https://github.com/hushh-labs/hushh-research/blob/main/readme.md)
- **Agents & Operons**: [ADK A2A & AP2 Implementation](https://github.com/hushh-labs/hushh-research/blob/main/consent-protocol/docs/agents.md)
- **MCP Standards**: [Model Context Protocol Official Site](https://modelcontextprotocol.io/)
- **Architecture**: [System Map](https://github.com/hushh-labs/hushh-research/blob/main/docs/reference/architecture.md)
```

---

### 🛠️ ENGINEERING

#### #builders

**Instruction:** Channel Topic.

```markdown
**Development Hub.**
Propose new Operons, discuss Tri-Flow implementation, and share code snippets.
Tags: [Python], [MLX], [Native], [Frontend]
```

#### #compliance

**Instruction:** Channel Topic.

```markdown
**Privacy & Protocol Governance.**
Deep dives into Consent Tokens, Google ADK/AP2 standards, Audit Logs, and Global Regulations (GDPR/CCPA).
```

#### #alpha-feedback

**Instruction:** Channel Topic.

```markdown
**Pre-Alpha Feedback Zone.**
Found a bug in the latest build? Post screenshots here.
Current Build: v0.9.x
```

---

### 💬 LABS

#### #general

**Instruction:** Channel Topic.

```markdown
**The Town Square.**
Say hello, share news, or ask for help. Keep deep technical specs in <#builders>.
```

#### #conference-1 (Voice)

**Instruction:** Initial message in the associated text chat.

```markdown
**Open Voice Channel.**
Feel free to jump in for pair programming or casual hangs.
```

---

## 🛠️ Operational Guide (Grouping & Tags)

### 📂 Grouping Channels (Categories)

Discord allows you to group channels under **Categories**. This keeps the server organized and allows you to sync permissions across all channels in that group.

**Recommended Setup:**

1. **🏁 START** (Category)
   - `#index`
   - `#rules`
   - `#manifesto`
2. **🛠️ ENGINEERING** (Category)
   - `#builders`
   - `#compliance`
   - `#alpha-feedback`
3. **💬 LABS** (Category)
   - `#general`
   - `#conference-1` (Voice)

### 🏷️ Adding Tags

Since we are using standard **Text Channels** instead of Forums, "Tags" are implemented in two ways:

1. **Channel Topics (Static Tags)**:
   - In each channel's settings, add "Tags" to the **Channel Topic**.
   - _Example for #builders_: `Tags: [Python], [MLX], [Native], [Frontend]`
   - This helps users understand what to post at a glance.

2. **Discord Roles (People Tags)**:
   - Create roles like `@Architect`, `@Builder`, and `@Maintainer`.
   - Users can "tag" these roles in conversations to get attention from specific groups.
