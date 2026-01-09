# Agent Kai — Phase 2 Roadmap: Investor Intelligence

> **From Analysis to Personalized Insights** > _Turning users into informed investors through intelligent onboarding and proactive learning_

---

## 🎯 Phase 2 Vision

**Goal**: Transform Kai from a reactive analysis tool into a **proactive investor companion** that:

1. **Pre-creates investor personas** from publicly available data (zero-friction onboarding)
2. **Learns continuously** from user interactions and portfolio understanding
3. **Imports portfolios** through multiple friction-reducing channels
4. **Delivers hyper-personalized Decision Cards** aligned with the user's actual holdings

> **Key Principle**: When Sundar Pichai downloads Kai and enters his phone number, we should already know he's a tech CEO with significant GOOGL holdings. The app should feel like it was built specifically for him—not a blank slate.

---

## 📊 Current State (Phase 1 Complete)

| Feature                       | Status      | Notes                     |
| ----------------------------- | ----------- | ------------------------- |
| VAULT_OWNER consent tokens    | ✅ Complete | Stateless, MCP-style      |
| Fundamental Agent (10-K/10-Q) | ✅ Complete | Real-time SEC fetching    |
| Operons for analysis          | ✅ Complete | Calculator, summarization |
| Gemini-based summarization    | ✅ Complete | **Cloud-based**           |
| KPI charts                    | ✅ Complete | Inline rendering          |
| Web/iOS/Android builds        | ✅ Complete | Capacitor.js              |
| BYOK + E2E encryption         | ✅ Complete | AES-256-GCM               |
| A2A consent protocol with SSE | ✅ Complete | Real-time notifications   |

### Current Architecture Note

> ⚠️ **Cloud-Based**: All AI processing currently runs on cloud (Gemini API). On-device MLX/Gemma integration is planned for Phase 3. This simplifies Phase 2 development and allows us to focus on the investor experience.

---

## 🚀 Phase 2 Milestones

### Milestone 1: Top 1024 Investor Persona Pre-Creation 📈

**Objective**: Pre-create rich investor personas from publicly available data so VIP users experience zero-friction onboarding.

#### The Core Idea

```
Traditional Onboarding:
User signs up → Empty profile → Hours of setup → Maybe useful

Kai VIP Onboarding:
User enters phone/email → We recognize them →
Pre-populated persona appears → "Is this you?" →
Confirm with one tap → Personalized experience instantly
```

#### Data Sources for Pre-Created Personas

| Source            | Data Type             | What We Derive                             |
| ----------------- | --------------------- | ------------------------------------------ |
| SEC 13F filings   | Portfolio holdings    | Top stocks, sector exposure, concentration |
| SEC Form 4        | Insider transactions  | Recent buys/sells, confidence signals      |
| LinkedIn (public) | Career history        | Industry expertise, seniority              |
| News/Interviews   | Investment philosophy | Risk tolerance, time horizon               |
| WhaleWisdom       | Historical positions  | Trading patterns, holding periods          |
| Twitter/X         | Public posts          | Real-time interests, opinions              |
| Board memberships | Corporate connections | Peer network, sector knowledge             |

#### Pre-Created Persona Schema

```typescript
interface PreCreatedPersona {
  // Identity Resolution
  identityConfidence: number; // 0-100% how sure we are
  matchedFrom: "phone" | "email" | "name";

  // Core Profile (from public data)
  name: string;
  title: string;
  company: string;
  photoUrl?: string; // LinkedIn/public

  // Holdings (from SEC filings)
  knownHoldings: {
    ticker: string;
    shares: number;
    source: "13F" | "Form4" | "news";
    asOfDate: string;
  }[];

  // Inferred Preferences
  sectorExposure: Record<string, number>;
  investmentStyle: ("value" | "growth" | "momentum" | "dividend")[];
  riskToleranceInferred: "conservative" | "balanced" | "aggressive";
  timeHorizon: "short" | "medium" | "long";

  // Enrichment for Kai
  relevantTickers: string[]; // Stocks Kai should highlight
  peerInvestors: string[]; // "Investors like you"
  suggestedWatchlist: string[];

  // Content
  publicQuotes: { text: string; source: string; date: string }[];
  recentNews: { headline: string; url: string; date: string }[];
}
```

#### Why This Matters

| Without Pre-Creation                                | With Pre-Creation                                            |
| --------------------------------------------------- | ------------------------------------------------------------ |
| "What stocks interest you?" → User types 10 tickers | "We see you hold GOOGL, MSFT, AAPL. Correct?" → One tap      |
| "What's your risk tolerance?" → User guesses        | "Based on your holdings, you seem balanced" → Confirm/adjust |
| "Connect your broker?" → Friction                   | "We found your 13F holdings" → Already populated             |
| Generic recommendations                             | Personalized from second 1                                   |

---

### Milestone 2: VIP Onboarding Flow (The Sundar Pichai Experience)

**Objective**: Create the most frictionless onboarding in finance by leveraging pre-created personas.

#### Complete Onboarding Flow (17 Steps, ~4 Minutes)

Aligned with [hushhtech.com/investor-guide](https://hushhtech.com) flow structure:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   KAI INVESTOR ONBOARDING (17 Steps)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: ACCOUNT SELECTION (Steps 1-2)                       ~30 sec  │
│  ══════════════════════════════════════                                 │
│                                                                          │
│  Step 1: Welcome + Legal Acknowledgment                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  👋 Welcome to Kai                                                 │ │
│  │                                                                    │ │
│  │  Your AI-Powered Investment Committee                             │ │
│  │  "Decide like Buffett, carry it in your pocket"                   │ │
│  │                                                                    │ │
│  │  ⚠️ Kai provides EDUCATIONAL analysis, not investment advice.    │ │
│  │                                                                    │ │
│  │  ☑ I understand this is not investment advice                     │ │
│  │  ☑ I will consult professionals before investing                  │ │
│  │                                                                    │ │
│  │  [Continue →]                                                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Step 2: Account Type Selection                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  How will you be investing?                                        │ │
│  │                                                                    │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                        │ │
│  │  │ 👤 Individual   │  │ 🏢 Entity       │                        │ │
│  │  │ Personal        │  │ Trust, LLC, etc │                        │ │
│  │  │ investments     │  │                 │                        │ │
│  │  └─────────────────┘  └─────────────────┘                        │ │
│  │                                                                    │ │
│  │  📍 Select your jurisdiction: [United States ▼]                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│                                                                          │
│  PHASE 2: IDENTITY + PERSONA (Steps 3-8)                      ~1 min   │
│  ═══════════════════════════════════════                                │
│                                                                          │
│  Step 3: Phone/Email Entry + VIP Detection                              │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Let's set up your account                                         │ │
│  │                                                                    │ │
│  │  📱 Phone: [+1-XXX-XXX-XXXX        ]                              │ │
│  │     — or —                                                         │ │
│  │  📧 Email: [sundar@google.com      ]                              │ │
│  │                                                                    │ │
│  │  [Continue →]                                                      │ │
│  │                                                                    │ │
│  │  🔍 Checking if we can personalize your experience...             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                          │                                               │
│                          ▼ VIP DETECTED                                  │
│                                                                          │
│  Step 4: Pre-Created Persona Preview (VIP PATH)                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  ✨ Welcome, Sundar!                                               │ │
│  │                                                                    │ │
│  │  Based on publicly available information, we've pre-configured    │ │
│  │  Kai for you:                                                      │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  👤 CEO, Google / Alphabet                                   │ │ │
│  │  │  📍 Mountain View, CA                                        │ │ │
│  │  │                                                              │ │ │
│  │  │  📈 KNOWN HOLDINGS (from SEC Form 4)                         │ │ │
│  │  │  ┌────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ GOOGL  110,000 shares   (CEO grants)                   │ │ │ │
│  │  │  │ Last activity: No sales in 6 months                    │ │ │ │
│  │  │  └────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                              │ │ │
│  │  │  🎯 INFERRED PREFERENCES                                     │ │ │
│  │  │  • Investment Style: Growth, Tech-focused                    │ │ │
│  │  │  • Time Horizon: Long-term (10+ years)                       │ │ │
│  │  │  • Risk Tolerance: Balanced (concentrated position)          │ │ │
│  │  │  • Sector Interest: AI/ML, Cloud, Consumer Tech             │ │ │
│  │  │                                                              │ │ │
│  │  │  👥 INVESTORS LIKE YOU                                       │ │ │
│  │  │  Eric Schmidt • Satya Nadella • Jensen Huang                 │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  [✅ This looks right]  [✏️ Customize]  [❌ Start fresh]          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Step 5-6: Additional Details (if needed)                               │
│  • Date of birth (for compliance)                                       │
│  • Address confirmation                                                  │
│  • SSN/Tax ID (for fund access, optional)                               │
│                                                                          │
│  Step 7-8: Risk Profile Confirmation                                    │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  We've inferred your risk profile. Adjust if needed:              │ │
│  │                                                                    │ │
│  │  ○ Conservative - Protect what I have                             │ │
│  │  ● Balanced - Growth with protection (suggested for you)          │ │
│  │  ○ Aggressive - Maximize growth                                   │ │
│  │                                                                    │ │
│  │  [Confirm →]                                                       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│                                                                          │
│  PHASE 3: PORTFOLIO IMPORT (Steps 9-13)                       ~1 min   │
│  ═══════════════════════════════════════                                │
│                                                                          │
│  Step 9: Import Method Selection                                        │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Add your portfolio for personalized analysis                      │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ 📸 Screenshot        │ Take a photo of your broker app      │ │ │
│  │  │     EASIEST         │ Works with any broker • 30 seconds    │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ 🔗 Connect via Plaid │ Secure bank-grade connection         │ │ │
│  │  │     AUTOMATIC        │ Auto-syncs holdings • Most accurate  │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ 📄 Upload Statement  │ PDF from your broker                 │ │ │
│  │  │     MODERATE         │ Monthly/quarterly statements         │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  [Skip for now →]                                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Steps 10-12: Selected import method flow                               │
│  Step 13: Confirm imported holdings                                     │
│                                                                          │
│                                                                          │
│  PHASE 4: VERIFICATION & WELCOME (Steps 14-17)                ~1 min   │
│  ═════════════════════════════════════════════                          │
│                                                                          │
│  Step 14: ID Verification (for Fund A access)                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  📋 Requirements                                                   │ │
│  │                                                                    │ │
│  │  🪪 VALID ID — Passport or Driver's License                       │ │
│  │  🏦 FUNDING — US Bank Account (via Plaid)                         │ │
│  │  🔐 IDENTITY — SSN or TIN                                         │ │
│  │  🌎 RESIDENCY — US Resident                                       │ │
│  │                                                                    │ │
│  │  [Upload ID →]  or  [Skip - Kai only, no Fund access]             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Step 15: E-Sign Agreements (if Fund access)                            │
│  Step 16: Select Investment Tier (if Fund access)                       │
│                                                                          │
│  Step 17: Welcome Dashboard                                             │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  🎉 You're all set, Sundar!                                        │ │
│  │                                                                    │ │
│  │  ⭐ Benefits Unlocked:                                             │ │
│  │  ✓ AI-Powered Insights — Data-driven analysis                     │ │
│  │  ✓ Personalized for YOU — 110K GOOGL shares reflected             │ │
│  │  ✓ Bank-Grade Security — 256-bit encryption                       │ │
│  │                                                                    │ │
│  │  Ask Kai anything:                                                 │ │
│  │  💬 "Should I buy more Google?" ← personalized to your holding    │ │
│  │  💬 "How does NVDA look for my portfolio?"                         │ │
│  │  💬 "Compare MSFT vs AMZN for growth"                              │ │
│  │                                                                    │ │
│  │  [Start Analyzing →]                                               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### VIP vs Standard Onboarding Path

| Step                   | VIP User              | Standard User      |
| ---------------------- | --------------------- | ------------------ |
| Phone/Email entry      | Auto-detected as VIP  | Proceeds normally  |
| Persona                | Pre-populated preview | Manual preferences |
| Holdings               | SEC filings shown     | Manual import only |
| Risk profile           | Inferred + confirm    | Full questionnaire |
| Peer investors         | Auto-suggested        | Build over time    |
| Time to first analysis | **~2 minutes**        | ~5 minutes         |

---

### Milestone 3: Multi-Channel Portfolio Import 📲

**Objective**: Reduce friction to import existing portfolio holdings using multiple channels.

#### Import Channels (Cloud-Based Processing)

| Channel           | Friction Level | Tech Approach     | Privacy          |
| ----------------- | -------------- | ----------------- | ---------------- |
| Screenshot OCR    | 🟢 Very Low    | Cloud Vision API  | Encrypted upload |
| Plaid Connect     | 🟡 Low         | Plaid API         | Bank-grade       |
| PDF Statement     | 🟡 Medium      | Cloud PDF parse   | Encrypted upload |
| Downloads Monitor | 🟢 Very Low    | iOS File Provider | On-device detect |
| Manual Entry      | 🔴 High        | N/A               | N/A              |

> **Note**: While MLX on-device processing is planned for Phase 3, current portfolio import uses cloud-based OCR/parsing with encrypted uploads. User data is encrypted before upload and deleted after processing.

#### Screenshot Portfolio Import Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              SCREENSHOT PORTFOLIO IMPORT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User takes screenshot of broker app                             │
│     ┌─────────────────────────────────┐                            │
│     │  📱 Robinhood Portfolio          │                            │
│     │  ─────────────────────────       │                            │
│     │  AAPL    50 shares   $9,250      │                            │
│     │  GOOGL   10 shares   $1,760      │                            │
│     │  NVDA    25 shares   $2,875      │                            │
│     └─────────────────────────────────┘                            │
│                                                                      │
│  2. Kai processes via Cloud Vision API                              │
│     ┌─────────────────────────────────┐                            │
│     │  🔐 Encrypting screenshot...     │                            │
│     │  ☁️ Processing (deleted after)   │                            │
│     │  ✓ Detected: Robinhood format   │                            │
│     │  ✓ Found 3 positions            │                            │
│     └─────────────────────────────────┘                            │
│                                                                      │
│  3. User confirms extracted data                                    │
│     ┌─────────────────────────────────┐                            │
│     │  📋 Confirm Your Holdings:       │                            │
│     │                                  │                            │
│     │  ☑ AAPL - 50 shares             │                            │
│     │  ☑ GOOGL - 10 shares            │                            │
│     │  ☑ NVDA - 25 shares             │                            │
│     │                                  │                            │
│     │  [Edit] [Confirm & Save 🔐]     │                            │
│     └─────────────────────────────────┘                            │
│                                                                      │
│  ⚠️ Currently: Cloud processing (encrypted)                        │
│  🔮 Phase 3: On-device MLX Vision (no upload)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Milestone 4: AlphaAgents Debate & Decision Cards 🎭

**Objective**: Implement full debate engine with personalized recommendations based on user's actual portfolio.

#### Enhanced Decision Card (Personalized)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        🎯 DECISION CARD: AAPL                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  CONSENSUS: 📈 BUY  (87% confidence)                                     │
│                                                                           │
│  🎯 PERSONALIZED FOR SUNDAR:                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Your current: 0 AAPL shares                                        │ │
│  │  Your tech exposure: 95% (GOOGL concentrated)                       │ │
│  │  Adding AAPL would: Diversify within tech ✓                         │ │
│  │  Risk alignment: Matches "Balanced" profile ✓                       │ │
│  │                                                                      │ │
│  │  💡 "You hold competitor GOOGL heavily. AAPL adds ecosystem         │ │
│  │     diversification while staying in tech."                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      THE DEBATE                                      │ │
│  │                                                                      │ │
│  │  🔍 FUNDAMENTAL AGENT                      VOTE: BUY ✅             │ │
│  │  "iPhone revenue stable. Services growth 18% YoY.                   │ │
│  │   Cash position $162B provides acquisition optionality."            │ │
│  │  📄 Source: 10-K FY2025, Page 42                                    │ │
│  │                                                                      │ │
│  │  📰 SENTIMENT AGENT                        VOTE: HOLD ⏸️            │ │
│  │  "Positive press sentiment but China headwinds persist.             │ │
│  │   Recent Tim Cook interview suggests cautious Q2 guidance."         │ │
│  │  📄 Source: Reuters Jan 2026, Cook Interview                        │ │
│  │                                                                      │ │
│  │  🧮 VALUATION AGENT                        VOTE: BUY ✅             │ │
│  │  "P/E of 28.5 below 5-year avg (32.1). Dividend yield 0.5%         │ │
│  │   with 7 years of consecutive increases."                           │ │
│  │  📄 Source: Live market data, FactSet estimates                     │ │
│  │                                                                      │ │
│  │  ⚔️ DISSENT CAPTURED:                                               │ │
│  │  "Sentiment Agent notes China regulatory risk not fully             │ │
│  │   priced in. Minority view: Wait for Q1 earnings clarity."          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  👥 INVESTORS LIKE YOU WHO HOLD AAPL:                                    │
│  Warren Buffett (38% of BRK portfolio) • Tim Cook (CEO)                  │
│                                                                           │
│  ⚠️ EDUCATIONAL ONLY. NOT INVESTMENT ADVICE.                            │
│  Always consult a licensed financial professional.                       │
│                                                                           │
│  [Save to Vault 🔐]  [Share with Manager]  [Compare with GOOGL]          │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Milestone 5: Realtime Learning Engine 🧠

**Objective**: Continuously learn from user behavior to improve personalization.

As users interact with Kai, we collect signals (with consent) to improve their experience:

| Signal              | What We Learn        | How It Improves Kai                      |
| ------------------- | -------------------- | ---------------------------------------- |
| Queries             | Sector interests     | Proactive stock suggestions              |
| Decision Card saves | What matters to them | Highlight similar analysis               |
| Time-of-day usage   | Active hours         | Notification timing                      |
| Comparative queries | Peer preferences     | "Others who compared X also looked at Y" |
| Feedback (👍/👎)    | Analysis quality     | Improve agent outputs                    |

---

## 👤 The Sundar Pichai Blueprint

**The VIP onboarding should feel like this:**

> "I downloaded Kai, entered my phone number, and within seconds it showed me my GOOGL position from SEC filings. It knew I'm a tech-focused, long-term investor. It suggested I might want to compare GOOGL with MSFT and AAPL. It felt like the app was built specifically for me."

### Pre-List Data We Aggregate

| Data Point       | Source                | Auto-Derived |
| ---------------- | --------------------- | ------------ |
| Full name        | Clearbit/Apollo       | ✓            |
| Title + Company  | LinkedIn API          | ✓            |
| Stock holdings   | SEC Form 4            | ✓            |
| Sector expertise | Career history        | ✓            |
| Investment style | Portfolio composition | ✓            |
| Risk tolerance   | Holding concentration | ✓            |
| Peer network     | Board connections     | ✓            |
| Recent interests | News mentions         | ✓            |

### What Gets Saved to Kai Vault

After VIP confirmation, we store:

1. Confirmed holdings (as user's portfolio)
2. Risk profile (confirmed or adjusted)
3. Sector preferences
4. Watchlist (from our suggestions + their picks)
5. **All query/analysis history going forward**

This creates a flywheel: the more they use Kai, the better personalization becomes.

---

## 📅 Phase 2 Timeline

| Milestone             | Duration     | Key Deliverables                     |
| --------------------- | ------------ | ------------------------------------ |
| M1: Investor Profiles | 3 weeks      | 1024 profiles, enrichment pipeline   |
| M2: VIP Onboarding    | 2 weeks      | Identity resolution, persona preview |
| M3: Portfolio Import  | 3 weeks      | Screenshot, Plaid, PDF               |
| M4: Debate Engine     | 3 weeks      | AlphaAgents, Decision Cards          |
| M5: Learning Pipeline | 2 weeks      | Preference tracking, suggestions     |
| **Total**             | **10 weeks** | (Parallel UI/UX track)               |

---

## 🔧 Technical Notes

### Architecture (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 2 ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FRONTEND (Next.js + Capacitor)                                     │
│  └─ Web / iOS / Android                                              │
│                                                                      │
│            │ REST API + SSE                                          │
│            ▼                                                         │
│                                                                      │
│  BACKEND (FastAPI)                                                   │
│  ├─ VIP Identity Resolution (Clearbit/Apollo)                       │
│  ├─ Investor Profile DB (Top 1024)                                  │
│  ├─ Portfolio Import (Cloud Vision, Plaid)                          │
│  ├─ Debate Engine (Gemini Cloud)                                    │
│  └─ Learning Pipeline (Postgres)                                    │
│                                                                      │
│            │                                                         │
│            ▼                                                         │
│                                                                      │
│  AI LAYER (Cloud-Based)                                              │
│  ├─ Gemini API (summarization, debate)                              │
│  ├─ Cloud Vision (screenshot OCR)                                   │
│  └─ SEC EDGAR API (filings)                                         │
│                                                                      │
│  ⚠️ On-Device (MLX/Gemma) = Phase 3                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

_Phase 2: From blank slate to personalized from second one_
