---
name: Agent Kai Revamp v3
overview: Transform Hushh into Agent Kai-centric app with granular consent scopes, Renaissance research integration, persistent chat, iOS crystal glass design, and comprehensive test coverage.
todos:
  - id: branch
    content: Create feature branch kushaltrivedi/feat/agent-kai-revamp
    status: completed
  - id: cleanup-backend
    content: Remove deprecated backend files (food, professional agents/routes)
    status: completed
  - id: cleanup-frontend
    content: Remove deprecated frontend directories (food, professional, fashion, etc.)
    status: completed
  - id: db-migration
    content: Create world model + chat tables migration with pgvector
    status: completed
  - id: granular-scopes
    content: Implement granular consent scopes in constants.py
    status: completed
  - id: renaissance-agent
    content: Build RenaissanceAgent with CSV data integration
    status: completed
  - id: world-model-service
    content: Create WorldModelService for attribute storage
    status: completed
  - id: chat-service
    content: Create ChatDBService for persistent history
    status: completed
  - id: portfolio-parser
    content: Build portfolio parser (PDF/CSV)
    status: completed
  - id: design-system
    content: Update to Crystal Gold theme with iOS radius
    status: completed
  - id: dashboard-ui
    content: Build new dashboard with 4 action cards + consent button
    status: completed
  - id: kai-chat
    content: Create unified Kai chat with insertable components
    status: completed
  - id: check-in-placeholder
    content: Add Check-In coming soon placeholder
    status: completed
  - id: test-backend
    content: Add pytest tests for new services and agents
    status: completed
  - id: test-frontend
    content: Setup Vitest and add frontend tests
    status: completed
  - id: ci-update
    content: Update CI workflow with test coverage
    status: completed
  - id: e2e-verify
    content: Run end-to-end verification checklist
    status: in_progress
isProject: false
---

# Agent Kai Revamp v3 - Final Architecture Plan

## 1. Granular Consent Scopes (MCP Compliant)

Replace broad `world_model.*` scopes with attribute-level granularity:

```python
class ConsentScope(str, Enum):
    # Vault Owner (full access - user's own)
    VAULT_OWNER = "vault.owner"
    
    # Financial Attributes (granular)
    FINANCIAL_RISK_PROFILE = "attr.financial.risk_profile"
    FINANCIAL_HOLDINGS = "attr.financial.holdings"
    FINANCIAL_PERFORMANCE = "attr.financial.performance"
    FINANCIAL_DECISIONS = "attr.financial.decisions"
    
    # Lifestyle Attributes
    LIFESTYLE_INTERESTS = "attr.lifestyle.interests"
    LIFESTYLE_SPENDING = "attr.lifestyle.spending"
    
    # Portfolio Operations
    PORTFOLIO_IMPORT = "portfolio.import"
    PORTFOLIO_ANALYZE = "portfolio.analyze"
    
    # Chat
    CHAT_HISTORY = "chat.history"
    
    # Embeddings (for similarity matching)
    EMBEDDING_PROFILE = "embedding.profile"
```

**Key Design**: `VAULT_OWNER` scope grants full world model access (user's own data). External MCP requests must specify granular `attr.*` scopes.

---

## 2. Renaissance Research Integration

Add new agent that incorporates the Renaissance Investable Universe data (152 stocks with tiers: ACE, KING, QUEEN, JACK).

**New file**: `consent-protocol/hushh_mcp/agents/kai/renaissance_agent.py`

```python
class RenaissanceAgent:
    """Incorporates Renaissance AI Fund research into Kai analysis."""
    
    TIERS = {
        "ACE": {"weight": 1.0, "description": "Highest conviction"},
        "KING": {"weight": 0.8, "description": "Strong conviction"},
        "QUEEN": {"weight": 0.6, "description": "Moderate conviction"},
        "JACK": {"weight": 0.4, "description": "Speculative"},
    }
    
    async def get_renaissance_rating(self, ticker: str) -> RenaissanceRating | None
    async def enhance_analysis(self, kai_decision: KaiDecision) -> EnhancedDecision
    async def identify_portfolio_alignment(self, holdings: list[Holding]) -> AlignmentReport
```

**Data storage**: `consent-protocol/data/renaissance_universe.json` (converted from CSV)

**Integration point**: `KaiOrchestrator.analyze()` calls `RenaissanceAgent.enhance_analysis()` to add tier rating and FCF data.

---

## 3. Files to Remove (Cleanup)

### Backend (consent-protocol/)

- `api/routes/food.py` - Migrate to world model
- `api/routes/professional.py` - Migrate to world model  
- `hushh_mcp/agents/food_dining/` - Entire directory
- `hushh_mcp/agents/professional_profile/` - Entire directory
- `hushh_mcp/operons/food/` - Entire directory

### Frontend (hushh-webapp/)

- `app/dashboard/food/` - Entire directory
- `app/dashboard/professional/` - Entire directory
- `app/dashboard/fashion/` - Entire directory (placeholder)
- `app/dashboard/fitness/` - Entire directory (placeholder)
- `app/dashboard/travel/` - Entire directory (placeholder)
- `app/dashboard/social/` - Entire directory (placeholder)
- `app/dashboard/transactions/` - Entire directory
- `components/food/` - Entire directory
- `components/professional/` - Entire directory

### Tests to Remove

- `__tests__/api/vault/food.test.ts`
- `tests/test_professional_operon.py`

---

## 4. Dashboard with Consent Management

New dashboard layout based on mockup with consent button:

```
┌─────────────────────────────────────────┐
│         Your Personal Data Agent         │
│                                          │
│              [Hushh Logo]                │
│                                          │
│     ┌─────────────────────────────┐     │
│     │     Ask Agent Kai...        │     │
│     └─────────────────────────────┘     │
│                                          │
│     ┌─────────────────────────────┐     │
│     │     View your profile       │     │
│     └─────────────────────────────┘     │
│                                          │
│     ┌─────────────────────────────┐     │
│     │ 🔐 Manage Consents          │     │
│     └─────────────────────────────┘     │
│                                          │
│     ┌─────────────────────────────┐     │
│     │ 📍 Check-In (Coming Soon)   │     │
│     └─────────────────────────────┘     │
│                                          │
└─────────────────────────────────────────┘
```

---

## 5. Check-In Feature (Coming Soon)

**New file**: `hushh-webapp/components/kai/check-in-placeholder.tsx`

```typescript
export function CheckInPlaceholder() {
  return (
    <Card className="crystal-glass opacity-60">
      <CardContent className="flex items-center gap-3 p-4">
        <MapPin className="h-5 w-5 text-crystal-gold-400" />
        <div>
          <p className="font-medium">Check-In</p>
          <p className="text-sm text-muted-foreground">Coming Soon</p>
        </div>
        <Badge variant="outline" className="ml-auto">Soon</Badge>
      </CardContent>
    </Card>
  );
}
```

**Future implementation notes** (stored in code comments):

- Request location permission via Capacitor Geolocation
- Reverse geocode to get place name
- Ask user "What is this location?" (home, work, gym, etc.)
- Store in world model as `attr.lifestyle.locations`

---

## 6. Navigation Experience (iOS-Inspired)

Keep existing floating bottom nav pattern, update for new structure:

**Nav Items** (4 max for iOS feel):

1. **Home** - Dashboard with 4 action cards
2. **Chat** - Unified Kai chat interface
3. **Profile** - World model visualization
4. **Settings** - Consents + app settings

**Navigation Flow**:

```
Home (Dashboard)
├── Ask Agent Kai → /chat
├── View Profile → /profile/world-model
├── Manage Consents → /consents
└── Check-In → Coming Soon modal

Chat (/chat)
├── Conversation list
├── Active chat with insertable components
└── Voice input toggle

Profile (/profile)
├── World model KPIs
├── Attribute categories (expandable)
└── Confidence scores
```

**Key patterns to maintain**:

- Floating pill navbar with backdrop blur
- TopAppBar with smart back navigation
- Safe area insets for iOS
- Edge swipe gesture for back (iOS)

---

## 7. Test Cases and CI Updates

### New Backend Tests

```
consent-protocol/tests/
├── agents/kai/
│   ├── test_orchestrator.py
│   ├── test_renaissance_agent.py      # NEW
│   ├── test_portfolio_analyzer.py     # NEW
│   └── test_inference_engine.py       # NEW
├── services/
│   ├── test_world_model_service.py    # NEW
│   ├── test_chat_db_service.py        # NEW
│   └── test_portfolio_parser.py       # NEW
└── test_granular_scopes.py            # NEW - scope validation
```

### Frontend Test Setup

Add to `hushh-webapp/package.json`:

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### CI Updates (`.github/workflows/ci.yml`)

```yaml
web-check:
  steps:
    # ... existing
    - name: Run frontend tests
      run: npm test -- --coverage
      
protocol-check:
  steps:
    # ... existing  
    - name: Run tests with coverage
      run: pytest tests/ -v --cov=hushh_mcp --cov-report=xml
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## 8. End-to-End Verification Checklist

After implementation, run this verification:

### Phase 1: Database

- pgvector extension enabled on Supabase
- world_model_* tables created
- chat_* tables created
- RPC functions deployed

### Phase 2: Backend

- All new services pass unit tests
- Granular scopes work in MCP flow
- Renaissance data loads correctly
- Portfolio parser handles PDF/CSV

### Phase 3: Frontend

- Crystal glass theme renders correctly
- Dashboard shows 4 action cards
- Chat interface works with insertable components
- Navigation flows correctly

### Phase 4: Integration

- MCP consent request with granular scope works
- Chat history persists across sessions
- World model updates from portfolio import
- CI passes all checks

### Phase 5: Cleanup Verification

- Removed files no longer referenced
- No broken imports
- No orphaned routes

---

## 9. Design System Updates

### Crystal Gold Theme (globals.css)

```css
:root {
  --crystal-gold-400: #D4AF37;
  --crystal-gold-600: #B8860B;
  --app-bg: linear-gradient(180deg, #FFFDF7 0%, #FDF8E7 50%, #F9EDCC 100%);
  --crystal-glass-bg: rgba(255, 255, 255, 0.12);
  --crystal-glass-border: rgba(212, 175, 55, 0.2);
  --radius: 1rem;
}

.dark {
  --app-bg: linear-gradient(180deg, #0A0A0C 0%, #12100D 50%, #1A1510 100%);
  --crystal-glass-bg: rgba(212, 175, 55, 0.06);
}
```

---

## Key Files Summary

### Create

- `consent-protocol/db/migrations/003_world_model.sql`
- `consent-protocol/hushh_mcp/agents/kai/renaissance_agent.py`
- `consent-protocol/hushh_mcp/agents/kai/portfolio_analyzer.py`
- `consent-protocol/hushh_mcp/services/world_model_service.py`
- `consent-protocol/hushh_mcp/services/chat_db_service.py`
- `consent-protocol/data/renaissance_universe.json`
- `hushh-webapp/app/chat/page.tsx`
- `hushh-webapp/components/kai/kai-chat.tsx`
- `hushh-webapp/components/kai/check-in-placeholder.tsx`

### Update

- `consent-protocol/hushh_mcp/constants.py` - Granular scopes
- `consent-protocol/hushh_mcp/agents/kai/orchestrator.py` - Renaissance integration
- `hushh-webapp/app/globals.css` - Crystal gold theme
- `hushh-webapp/app/page.tsx` - New dashboard
- `.github/workflows/ci.yml` - Test coverage

### Remove

- 7 frontend dashboard directories
- 2 frontend component directories
- 3 backend agent/operon directories
- 2 backend route files

