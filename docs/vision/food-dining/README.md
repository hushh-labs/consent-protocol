# Food & Dining — Agentic Commerce Vision

> **Location-Aware, Consent-First Food Discovery & Ordering via MCP + AP2 + A2A**

---

<p align="center">
  <img src="https://img.shields.io/badge/Domain-Food_&_Dining-orange?style=for-the-badge" alt="Food"/>
  <img src="https://img.shields.io/badge/Protocol-AP2+A2A+MCP-blue?style=for-the-badge" alt="Protocols"/>
  <img src="https://img.shields.io/badge/Status-VISION-yellow?style=for-the-badge" alt="Vision"/>
</p>

---

## 🎯 The Vision

Transform food discovery and ordering into a **seamless, voice-first experience** where users simply say:

> _"I want the best food near me."_

And the entire flow — from location consent to preference matching to order placement — happens through **conversational AI with cryptographic consent at every step**, powered by **on-device AI** for maximum privacy.

---

## 📍 Location Favorites System (NEW)

A core enhancement: users can save and manage multiple favorite locations for seamless food ordering:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCATION FAVORITES                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐                                              │
│   │ 📍 Current       │  GPS-based, real-time location               │
│   │    Location      │  "Order food near me now"                    │
│   │    (live GPS)    │  Requires one-time consent                   │
│   └──────────────────┘                                              │
│                                                                      │
│   ┌──────────────────┐                                              │
│   │ 🏠 Home          │  Saved delivery address                      │
│   │                  │  "Dinner delivery tonight"                   │
│   │    123 Main St   │  Encrypted in local vault                    │
│   └──────────────────┘                                              │
│                                                                      │
│   ┌──────────────────┐                                              │
│   │ 🏢 Work          │  Office location                             │
│   │                  │  "Lunch near the office"                     │
│   │    456 Market St │  Encrypted in local vault                    │
│   └──────────────────┘                                              │
│                                                                      │
│   ┌──────────────────┐                                              │
│   │ ⭐ Custom        │  User-defined favorites                      │
│   │   "Mom's House"  │  "Order to Mom's address"                    │
│   │   "Gym"          │  Encrypted in local vault                    │
│   │   "Beach House"  │                                              │
│   └──────────────────┘                                              │
│                                                                      │
│   [+ Add New Location]                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Location Data Schema

```typescript
interface LocationFavorite {
  id: string;
  label: string; // "Home", "Work", "Mom's House"
  type: "current" | "saved";
  icon?: string; // Emoji or icon identifier
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isDefault: boolean;
  deliveryInstructions?: string; // "Gate code 1234"
  createdAt: Date;
  updatedAt: Date;
}
```

### Location Privacy

| Storage Mode             | Location Data                       |
| ------------------------ | ----------------------------------- |
| **Local-Only** (Default) | Stored encrypted on-device only     |
| **Cloud Sync** (Opt-in)  | E2E encrypted sync for multi-device |

---

## 🌍 The Scenario

### User Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       SEAMLESS FOOD ORDERING EXPERIENCE                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. USER SPEAKS TO AI ASSISTANT (Siri, Gemini, Claude, etc.)                 │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  User: "I want the best food for my current location"              │  │
│     │  OR: "Order dinner to my home"                                      │  │
│     │  OR: "What's good near work?"                                       │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  2. ON-DEVICE PROCESSING (No network required for saved locations)           │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  Local LLM (MLX/Gemma) → Detects food intent                        │  │
│     │  Local MCP → Retrieves location favorites from encrypted vault     │  │
│     │  If "current location": Request GPS consent                         │  │
│     │  If "home/work": Use saved address (no consent needed)              │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  3. CONSENT PROMPT (Only for Current Location or External APIs)              │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  🔒 Location Consent Request                                        │  │
│     │                                                                      │  │
│     │  "Food Agent wants access to your current GPS location"             │  │
│     │                                                                      │  │
│     │  Scope: location.current (one-time)                                 │  │
│     │  Purpose: Find restaurants near you                                 │  │
│     │                                                                      │  │
│     │  [Deny]                              [Approve with FaceID 👆]       │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  4. CONTEXT ASSEMBLY (On-Device)                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  • Location: (lat, lng) or saved address                           │  │
│     │  • Food preferences from vault (dietary, cuisine, budget)          │  │
│     │  • Order history (if available locally)                            │  │
│     │  • Combined context for recommendations                             │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  5. RESTAURANT QUERY (Hybrid - with consent)                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  A2A: Food Agent → DoorDash MCP → Restaurant results               │  │
│     │  A2A: Food Agent → Uber Eats MCP → Restaurant results              │  │
│     │  Merge + Rank based on user preferences + ratings + ETA            │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  6. USER SELECTS + CONFIRMS ORDER (VOICE OR UI)                              │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  User: "Order the butter chicken from Taj Palace"                  │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  7. AP2 PROTOCOL INITIATES PAYMENT MANDATE FLOW                              │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  Intent Mandate → Cart Mandate → Payment Mandate                    │  │
│     │  Each mandate cryptographically signed                              │  │
│     │  User approves final payment with biometric                         │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  8. ORDER CONFIRMED + TRACKING BEGINS                                        │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  "Your order from Taj Palace is confirmed!                         │  │
│     │   Estimated delivery: 35 minutes                                    │  │
│     │   Delivering to: Home (123 Main St)"                                │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 On-Device vs Hybrid Mode

### On-Device (Default)

| Feature                | On-Device Capability              |
| ---------------------- | --------------------------------- |
| **Location Favorites** | ✅ Stored locally, instant access |
| **Food Preferences**   | ✅ Encrypted in local vault       |
| **Reorder Favorites**  | ✅ Cached order history           |
| **Restaurant Search**  | ⚠️ Cached/offline data only       |
| **Live Ordering**      | ❌ Requires network (Hybrid mode) |

### Hybrid Mode (With Consent)

| Feature             | Consent Required              |
| ------------------- | ----------------------------- |
| **Current GPS**     | ✅ One-time location.current  |
| **Restaurant APIs** | ✅ external.restaurant.search |
| **Live Ordering**   | ✅ agent.food.order           |
| **Payment**         | ✅ agent.food.pay (biometric) |

---

## 🔗 Protocol Stack

### How MCP + A2A + AP2 Work Together

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        PROTOCOL STACK                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 0: ON-DEVICE AI (MLX / Gemma)                                │ │
│  │  Purpose: Local inference, privacy-first processing                 │ │
│  │                                                                      │ │
│  │  • Intent classification (food order, search, reorder)             │ │
│  │  • Natural language understanding                                   │ │
│  │  • Context assembly from local vault                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: MCP (Model Context Protocol)                              │ │
│  │  Purpose: Agent ↔ Tool communication                                │ │
│  │                                                                      │ │
│  │  • hushh-connector: Exposes user data with consent                  │ │
│  │  • doordash-connector: Queries restaurants, creates orders          │ │
│  │  • ubereats-connector: Alternative vendor integration               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: A2A (Agent-to-Agent Protocol)                             │ │
│  │  Purpose: Agent ↔ Agent interoperability                            │ │
│  │                                                                      │ │
│  │  • Food Agent discovers Vendor Agents via Agent Cards               │ │
│  │  • Capability negotiation (what can each agent do?)                 │ │
│  │  • Task delegation with TrustLinks                                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: AP2 (Agent Payments Protocol)                             │ │
│  │  Purpose: Secure payment flow for AI agents                         │ │
│  │                                                                      │ │
│  │  • Intent Mandate: "User wants food under $30"                      │ │
│  │  • Cart Mandate: "User approved this exact order: $24.50"           │ │
│  │  • Payment Mandate: "Execute payment via stored card"               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Consent Scopes for Food & Location

### Consent Scope Definitions

```python
class FoodLocationConsentScope:
    # Location scopes (granular)
    LOCATION_CURRENT = "location.current"       # One-time current GPS
    LOCATION_HISTORY = "location.history"       # Past locations (rare)
    LOCATION_SUBSCRIBE = "location.subscribe"   # Real-time tracking (delivery)

    # Location favorites (no consent needed - user's own saved data)
    # Stored in encrypted vault, accessed locally

    # Food preference scopes (existing + extended)
    VAULT_READ_FOOD = "vault.read.food"         # Dietary, cuisine, budget
    VAULT_WRITE_FOOD = "vault.write.food"       # Update preferences
    VAULT_READ_LOCATIONS = "vault.read.locations"  # Saved favorites

    # Order execution scopes (Hybrid mode)
    AGENT_FOOD_SEARCH = "agent.food.search"     # Query vendor APIs
    AGENT_FOOD_ORDER = "agent.food.order"       # Create order
    AGENT_FOOD_PAY = "agent.food.pay"           # Execute payment (AP2)

    # External data (Hybrid mode)
    EXTERNAL_RESTAURANT_API = "external.restaurant.api"
```

### Onboarding: Location Favorites Setup

During app onboarding:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCATION FAVORITES SETUP                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📍 Save Your Favorite Locations                                    │
│                                                                      │
│  Add locations for quick food ordering.                             │
│  All addresses are encrypted and stored on your device only.        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🏠 Home                                                     │   │
│  │  [Enter your home address...]                               │   │
│  │                                                              │   │
│  │  Delivery instructions (optional):                          │   │
│  │  [Gate code, apartment number, etc.]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🏢 Work                                                     │   │
│  │  [Enter your work address...]                               │   │
│  │                                                              │   │
│  │  Delivery instructions (optional):                          │   │
│  │  [Lobby pickup, floor number, etc.]                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [+ Add Another Location]                                           │
│                                                                      │
│  ⚠️ Your addresses are encrypted locally and NEVER sent to our    │
│  servers unless you enable cloud sync.                              │
│                                                                      │
│  [Skip for Now]                  [Save & Continue]                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### GPS Consent (Only for Current Location)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GPS LOCATION CONSENT                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🌍 Current Location Access                                         │
│                                                                      │
│  Food Agent wants to use your current GPS location.                 │
│                                                                      │
│  ✓ Find restaurants near you right now                             │
│  ✓ One-time access only                                            │
│  ✓ Location not stored or shared                                   │
│                                                                      │
│  ⚠️ Alternative: Use a saved location instead                      │
│     [🏠 Home] [🏢 Work] [📍 Other]                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ○ Never (use saved locations only)                          │   │
│  │  ○ Only when using the app                                   │   │
│  │  ● Only with explicit consent each time (Recommended)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Deny]                              [Approve with FaceID 👆]       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛒 Vendor MCP Architecture

### The Challenge

DoorDash and Uber Eats APIs require:

- Partnership agreements
- NDA + API licensing
- Production access approval
- Not designed for direct consumer ordering via third parties

### The Solution: Dedicated Vendor MCPs

We need to build **Hushh's own vendor-facing MCPs** that:

1. **Aggregate restaurant data** from public sources initially
2. **Partner with delivery platforms** for order execution
3. **Create a unified interface** for food agents

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     VENDOR MCP ARCHITECTURE                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     HUSHH FOOD AGENT                                 │ │
│  │  (On-Device LLM + Orchestration)                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                             │ A2A Protocol                               │
│           ┌─────────────────┼─────────────────┐                          │
│           │                 │                 │                          │
│           ▼                 ▼                 ▼                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│  │ DoorDash MCP    │ │ Uber Eats MCP   │ │ Local/Direct    │            │
│  │                 │ │                 │ │ MCP             │            │
│  │ • Drive API     │ │ • Store API     │ │ • Restaurant    │            │
│  │ • Menu Sync     │ │ • Menu Sync     │ │   Direct Orders │            │
│  │ • Order Create  │ │ • Order Create  │ │ • No middleman  │            │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│           │                   │                   │                      │
│           ▼                   ▼                   ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    DELIVERY FULFILLMENT                              │ │
│  │  (Partner APIs with production access)                              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🗣️ Voice-First Ordering with AP2

### The Seamless Conversation

```
User: "Order my usual to home"

AI: "I found your usual order at the Chipotle near your home:
     • Burrito Bowl, brown rice, chicken, black beans
     • Chips and guac

     Delivering to: 🏠 Home (123 Main St)
     Total: $18.45 with delivery

     Should I place this order?"

User: "Yes, go ahead"

AI: "I'm sending a payment approval to your Hushh app.
     Please confirm with your fingerprint."

     ┌────────────────────────────────────────┐
     │  💳 Payment Approval                   │
     │                                         │
     │  Chipotle - Market Street               │
     │  $18.45                                 │
     │                                         │
     │  Deliver to: 🏠 Home                   │
     │  123 Main St, Apt 4B                   │
     │                                         │
     │  [Cancel]           [Pay with Touch ID] │
     └────────────────────────────────────────┘

User: *Places finger on sensor*

AI: "Order confirmed! Arriving in about 25 minutes.
     I'll let you know when the driver is nearby."
```

---

## ⚖️ Regulatory & Privacy Compliance

### Consumer Protection (USA)

| Requirement             | Implementation                          |
| ----------------------- | --------------------------------------- |
| **Clear Pricing**       | Total shown before payment approval     |
| **Order Confirmation**  | Written confirmation stored in vault    |
| **Cancellation Rights** | Cancel button until restaurant confirms |
| **Receipt Storage**     | All receipts encrypted in local vault   |

### Payment Security (PCI DSS Alignment)

| Layer                     | Protection                             |
| ------------------------- | -------------------------------------- |
| **AP2 Mandates**          | Cryptographically signed, tamper-proof |
| **Biometric gate**        | Payment requires FaceID/TouchID        |
| **Amount limits**         | User-defined spending caps             |
| **Merchant verification** | Only approved vendors                  |
| **Audit trail**           | Complete transaction history in vault  |

### CCPA/CPRA Compliance

| Requirement           | Implementation                             |
| --------------------- | ------------------------------------------ |
| **Right to Know**     | User can view all location and order data  |
| **Right to Delete**   | One-tap deletion of all food/location data |
| **Data Minimization** | Only collect data needed for ordering      |
| **No Sale**           | Location data never sold or shared         |
| **Opt-Out**           | GPS access is always consent-based         |

### Location Privacy

| Principle                  | Implementation                                  |
| -------------------------- | ----------------------------------------------- |
| **Minimal collection**     | Only request GPS when needed                    |
| **Local-first storage**    | Favorites encrypted on-device                   |
| **Time-limited**           | GPS consent expires after use                   |
| **No persistent tracking** | No background location unless delivery tracking |
| **Deletion on request**    | Location favorites deletable from vault         |

---

## 📱 Implementation Phases

### Phase 1: Foundation

- [ ] Add `LOCATION_CURRENT` consent scope to HushhMCP
- [ ] Build location favorites management UI
- [ ] Implement encrypted local storage for addresses
- [ ] Extend Food Agent with location-aware recommendations
- [ ] Create restaurant discovery using public APIs (Google Places)

### Phase 2: Agent Network

- [ ] Build DoorDash MCP (Drive API for delivery fulfillment)
- [ ] Implement A2A protocol for Food Agent ↔ Vendor Agent
- [ ] Create unified restaurant data layer
- [ ] Add real-time delivery tracking consent flow

### Phase 3: Voice Commerce

- [ ] Integrate AP2 Protocol for payment mandates
- [ ] Build voice-first ordering flow
- [ ] Implement biometric payment approval
- [ ] Add "reorder favorites" with one-tap consent

### Phase 4: Full Ecosystem

- [ ] Uber Eats partnership + MCP
- [ ] Direct restaurant integrations
- [ ] Multi-restaurant cart (order from multiple places)
- [ ] Subscription/scheduled orders

---

## 📊 Success Metrics

| Metric                       | Target   | Description                        |
| ---------------------------- | -------- | ---------------------------------- |
| **Time to Order**            | < 2 min  | From "I want food" to order placed |
| **Consent Friction**         | < 10 sec | Time for biometric approval        |
| **Recommendation Accuracy**  | > 85%    | User satisfaction with suggestions |
| **Repeat Usage**             | > 60%    | Users who reorder within 30 days   |
| **Location Favorites Added** | > 2 avg  | Saved locations per user           |

---

## 🎯 The North Star

> _"Ordering food should be as natural as asking a friend for a recommendation — except this friend knows your preferences perfectly, never forgets your favorites, and always asks before sharing anything about you."_

---

_Food & Dining — Consent-first commerce for the agentic era._
