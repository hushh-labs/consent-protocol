# Hushh Vision: Adaptive Attention Marketplace

> Beyond v0 — The full vision of Kai as an attention concierge.

---

## The Core Idea

**Your attention is your most valuable asset.**

Companies spend billions to grab it. Hushh flips this: instead of YOU being sold to advertisers, **agents must BID for your attention** and prove value.

---

## Key Concepts (Plain English)

### What is an "Attention Bid"?

When any service wants your time, it's making a bid:

| Traditional Model          | Hushh Model                                              |
| -------------------------- | -------------------------------------------------------- |
| Netflix autoplay grabs you | Netflix bids: "2hr movie, high Aloha, family-safe"       |
| Goldman calls you          | Goldman bids: "10min briefing, high Alpha, data-minimal" |
| Ads interrupt you          | Ads must prove value or get rejected                     |

YOU decide what earns your time.

### Alpha vs Aloha

These are the two "currencies" of value:

| Metric    | What It Means                             | Examples                                                |
| --------- | ----------------------------------------- | ------------------------------------------------------- |
| **Alpha** | Wealth, performance, returns, compounding | Investment briefings, portfolio reviews, business calls |
| **Aloha** | Joy, trust, relationships, wellbeing      | Family time, meditation, movie night, health            |

Every bid has both. You control the balance with a slider.

### Trust Score

Not all agents are equal. Trust score measures:

- Data practices (do they respect consent?)
- Track record (have they delivered value?)
- Transparency (do they explain what they want?)

**Low-trust bids get demoted or hidden.**

### The Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  Manish's Adaptive Attention Dashboard                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Alpha ◀━━━━━━●━━━━━━▶ Aloha]   [Strict Consent: ON]              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tabs: All | Work/Wealth | Entertainment | Wellness | Travel │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │ Goldman Sachs Agent │  │ Peloton Coach       │                  │
│  │ 10-min Alpha Brief  │  │ 20-min HIIT Boost   │                  │
│  │ Alpha: 95  Aloha: 45│  │ Alpha: 55  Aloha: 93│                  │
│  │ Trust: 92           │  │ Trust: 88           │                  │
│  │ [Approve] [Snooze]  │  │ [Approve] [Snooze]  │                  │
│  └─────────────────────┘  └─────────────────────┘                  │
│                                                                      │
│  RIGHT PANEL: "Plan for Today"                                      │
│  - Approved bids become your schedule                               │
│  - Time budget: 8 hours visible                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How Bids Are Ranked

```
Composite Score = (Alpha × weight) + (Aloha × weight) + (Trust × 0.05)
```

- User controls Alpha/Aloha weight with a slider
- Trust always matters (strict consent demotes low-trust)
- **Ad spend does NOT affect ranking**

---

## Sample Bids

| Agent         | Bid                       | Duration | Alpha | Aloha | Trust |
| ------------- | ------------------------- | -------- | ----- | ----- | ----- |
| Goldman Sachs | 10-min Alpha Briefing     | 10m      | 95    | 45    | 92    |
| Peloton       | 20-min HIIT Energy Boost  | 20m      | 55    | 93    | 88    |
| Disney+       | Family Movie Night        | 120m     | 35    | 96    | 90    |
| Headspace     | 10-min Sleep Meditation   | 10m      | 30    | 80    | 94    |
| Four Seasons  | Suite Upgrade Negotiation | 6m       | 62    | 82    | 91    |
| Agent Hushh   | Private Family Time Block | 45m      | 40    | 92    | 99    |

---

## Life Domains

Bids are categorized:

| Domain        | Icon | Examples                             |
| ------------- | ---- | ------------------------------------ |
| Work/Wealth   | 💼   | Investment briefings, business calls |
| Entertainment | 🎬   | Movies, games, content               |
| Wellness      | 🏋️   | Fitness, meditation, health          |
| Travel        | ✈️   | Flights, hotels, experiences         |
| Relationships | 👥   | Family time, social                  |

---

## Consent Policy (MCP)

Every bid must respect:

```yaml
protocol: Consent-AI-MCP-v1.0
owner: Manish Sainani
consent:
  explicit: true # Must ask before accessing
  revocable: true # User can withdraw anytime
  purpose_bound: true # Only for stated purpose
prohibited_contexts:
  - unauthorized resale
  - manipulative targeting
  - non-transparent model training
```

---

## How This Relates to Kai v0

| Phase   | Focus                                       |
| ------- | ------------------------------------------- |
| **v0**  | Investor onboarding (one specific bid type) |
| **v1**  | Investment analysis (another bid type)      |
| **v2+** | Full Attention Marketplace (all bid types)  |

The onboarding flow you're building is the **first bid type**. The architecture should support future expansion.

---

## Key Takeaways

1. **Attention is scarce** — Kai protects it
2. **Alpha + Aloha** — Every decision has both wealth and wellbeing value
3. **Trust matters** — Low-trust agents get demoted
4. **User approves** — No algorithms deciding for you
5. **Consent enforced** — MCP protocol on every interaction

---

## Reference Files

- `test.tsx` — Sample dashboard implementation (founder's example)
- `v0-onboarding.md` — Current v0 spec (investor onboarding)
- `readme.md` — Investment analysis vision (3 agents, decision cards)
