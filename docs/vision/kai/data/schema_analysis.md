# Investor Profile Schema Analysis

## Based on Real Data Collected

After analyzing real 13F filings and public data for 20+ top investors, here's the recommended schema structure.

---

## Two-Table Architecture

### Table 1: `investor_profiles` (Public Discovery Layer)

**Purpose**: Store publicly available investor information for identity resolution.
**Encrypted**: NO (server can read - public data only)
**Usage**: Search, discovery, pre-population during onboarding

```sql
CREATE TABLE investor_profiles (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Identity (for name-based matching)
  name TEXT NOT NULL,
  name_normalized TEXT GENERATED ALWAYS AS (lower(regexp_replace(name, '\s+', '', 'g'))) STORED,
  cik TEXT UNIQUE,                    -- SEC identifier (if applicable)

  -- Profile
  firm TEXT,
  title TEXT,
  investor_type TEXT,                 -- 'fund_manager', 'tech_insider', 'vc', 'founder'
  photo_url TEXT,

  -- Holdings Summary (from 13F/Form4)
  aum_billions NUMERIC,
  top_holdings JSONB,                 -- [{ticker, name, shares, value_billions, portfolio_pct}]
  sector_exposure JSONB,              -- {technology: 40.5, healthcare: 25.0}

  -- Inferred Profile
  investment_style TEXT[],            -- ['value', 'growth', 'macro', 'activist']
  risk_tolerance TEXT,                -- 'conservative', 'balanced', 'aggressive'
  time_horizon TEXT,                  -- 'short', 'medium', 'long', 'very_long'
  portfolio_turnover TEXT,            -- 'low', 'medium', 'high'

  -- Activity Signals
  recent_buys TEXT[],                 -- ['AAPL', 'NVDA']
  recent_sells TEXT[],                -- ['GOOGL']

  -- Enrichment
  public_quotes JSONB,                -- [{quote, source, year}]
  biography TEXT,
  education TEXT[],
  board_memberships TEXT[],

  -- Peer Network
  peer_investors TEXT[],              -- Names of similar investors

  -- Insider-specific (Form 4)
  is_insider BOOLEAN DEFAULT FALSE,
  insider_company_ticker TEXT,

  -- Data Source Tracking
  data_sources TEXT[],                -- ['13f', 'form4', 'linkedin', 'news']
  last_13f_date DATE,
  last_form4_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient searching
CREATE INDEX idx_investor_name_trgm ON investor_profiles USING GIN (name gin_trgm_ops);
CREATE INDEX idx_investor_firm ON investor_profiles(firm);
CREATE INDEX idx_investor_type ON investor_profiles(investor_type);
CREATE INDEX idx_investor_style ON investor_profiles USING GIN (investment_style);
```

### Table 2: `user_investor_profiles` (Private Vault Layer)

**Purpose**: Store user-confirmed investor profile data (encrypted copy)
**Encrypted**: YES (E2E encrypted, server cannot read)
**Usage**: Agents use this for personalization

```sql
CREATE TABLE user_investor_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,              -- Firebase UID

  -- Copied from public profile (encrypted)
  confirmed_investor_id INTEGER REFERENCES investor_profiles(id),
  profile_data_encrypted BYTEA,       -- E2E encrypted copy

  -- User modifications (encrypted)
  custom_holdings_encrypted BYTEA,    -- User's actual holdings
  custom_preferences_encrypted BYTEA, -- User's adjusted preferences

  -- Consent tracking
  confirmed_at TIMESTAMPTZ,
  consent_scope TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_investor_user ON user_investor_profiles(user_id);
```

---

## JSONB Field Structures

### top_holdings

```json
[
  {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "shares": 300000000,
    "value_billions": 56.0,
    "portfolio_pct": 21.0,
    "change_qoq": -25,
    "source": "13F"
  }
]
```

### sector_exposure

```json
{
  "technology": 45.5,
  "financials": 25.0,
  "consumer_staples": 15.0,
  "energy": 10.0,
  "healthcare": 4.5
}
```

### public_quotes

```json
[
  {
    "quote": "Be fearful when others are greedy...",
    "source": "Berkshire annual letter",
    "year": 2008
  }
]
```

### investment_style (enum values)

```
value, growth, macro, activist, contrarian, distressed,
momentum, dividend, quant, factor, event_driven,
tech_focused, concentrated, diversified

# For insiders
tech_founder, tech_executive, insider
```

---

## Data Categories & Sources

| Field             | Source            | Update Frequency  |
| ----------------- | ----------------- | ----------------- |
| name, firm, title | LinkedIn, SEC     | Static            |
| cik               | SEC EDGAR         | Static            |
| top_holdings      | 13F filings       | Quarterly         |
| insider activity  | Form 4            | Real-time (daily) |
| aum               | 13F/news          | Quarterly         |
| investment_style  | Manual curation   | Annual            |
| quotes            | Interviews, books | Ongoing           |
| biography         | Wikipedia, news   | Static            |
| peer_investors    | Manual curation   | Annual            |

---

## Identity Resolution Flow

```
1. User enters name: "Warren Buffett"

2. Query:
   SELECT * FROM investor_profiles
   WHERE name_normalized ILIKE '%warrenbuffett%'
   OR name % 'Warren Buffett'  -- trigram similarity
   ORDER BY similarity(name, 'Warren Buffett') DESC
   LIMIT 5;

3. Return matches with confidence scores

4. User confirms: "This is me"

5. Copy to user_investor_profiles:
   - Encrypt profile_data
   - Store in user's vault
   - Agents only access vault copy
```

---

## Kai Operon Integration

### 1. Identity Resolution Operon

- Input: user name
- Output: matched investor profiles with confidence
- Source: `investor_profiles` table

### 2. Personalization Operon

- Input: confirmed user profile
- Output: relevant tickers, watchlist suggestions, peer investors
- Source: `user_investor_profiles` (encrypted)

### 3. Decision Card Context Operon

- Input: ticker, user profile
- Output: "Based on your profile as a Value investor..."
- Source: `user_investor_profiles` (encrypted)

### 4. "Investors Like You" Operon

- Input: user investment style
- Output: Similar investors and their holdings
- Source: Cross-reference `investor_profiles`

---

## Next Steps

1. Create `investor_profiles` table (migration)
2. Build 13F parser to populate data
3. Create identity search API
4. Build consent + vault copy flow
5. Integrate with Kai operons
