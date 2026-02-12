# World Model Dynamic Compliance - Implementation Progress

## Completed Tasks ✅

### 1. Backend Scope Centralization (COMPLETED)
**Status**: ✅ All hardcoded scope maps replaced with dynamic resolution

**Files Updated**:
- ✅ Created `hushh_mcp/consent/scope_helpers.py` - Central scope resolution utilities
- ✅ Updated `api/routes/consent.py` - Using `resolve_scope_to_enum()` and `get_scope_description()`
- ✅ Updated `api/routes/developer.py` - Removed `SCOPE_TO_ENUM`, using centralized helpers
- ✅ Updated `mcp_modules/tools/consent_tools.py` - Removed `SCOPE_ENUM_MAP`
- ✅ Updated `mcp_modules/tools/utility_tools.py` - Replaced 2x `scope_map` with dynamic resolution
- ✅ Updated `handle_list_scopes()` to return dynamic scopes with descriptions

**Key Functions**:
- `resolve_scope_to_enum(scope: str) -> ConsentScope` - Maps any scope to enum
- `get_scope_description(scope: str) -> str` - Dynamic scope descriptions
- `normalize_scope(scope: str) -> str` - Converts legacy to canonical format
- `is_write_scope(scope: str) -> bool` - Determines write access

### 2. Vault DB Deprecation (COMPLETED)
**Status**: ✅ Domain tables marked as deprecated, Literal types replaced

**Files Updated**:
- ✅ Updated `hushh_mcp/services/vault_db.py`
  - Removed `Literal` type constraints (6 occurrences) - now uses `str`
  - Added deprecation notices to `DOMAIN_TABLES`, `DOMAIN_READ_SCOPES`, `DOMAIN_WRITE_SCOPES`
  - Enhanced docstring with migration path to WorldModelService

**Migration Path Documented**:
```python
# DEPRECATED
from hushh_mcp.services.vault_db import VaultDBService

# PREFERRED  
from hushh_mcp.services.world_model_service import get_world_model_service
service = get_world_model_service()
await service.store_attribute(domain="food", ...)
```

---

## Remaining Tasks 📋

### 3. Generic Domain Data Handler (IN PROGRESS)
**Priority**: HIGH
**Files**: `mcp_modules/tools/data_tools.py`

**TODO**:
- Create generic `handle_get_domain_data(domain: str, ...)` function
- Replace `handle_get_food()` and `handle_get_professional()` with dynamic version
- Use `DomainRegistryService` to validate domains
- Update MCP server registration to use generic handler

### 4. World Model API Endpoints (PENDING)
**Priority**: HIGH - Required for frontend
**Files**: New `api/routes/world_model.py`, `hushh-webapp/app/api/world-model/`

**TODO**:
- Backend: Create `GET /api/world-model/domains?include_empty=false`
- Backend: Create `GET /api/world-model/scopes/{userId}`
- Frontend Web Proxy: `app/api/world-model/domains/route.ts`
- Frontend Web Proxy: `app/api/world-model/scopes/[userId]/route.ts`

### 5. Frontend Dynamic Domains (PENDING)
**Priority**: HIGH
**Files**: 
- `hushh-webapp/lib/vault/domains.ts`
- `hushh-webapp/lib/services/world-model-service.ts`

**TODO**:
- Replace `type VaultDomain = "food" | "professional"...` with `DomainInfo` interface
- Add `listDomains()` method to `WorldModelService`
- Add `getScopeDisplayInfo()` for dynamic scope rendering

### 6. UI Component Updates (PENDING)
**Priority**: MEDIUM
**Files**: Multiple frontend components

**TODO**:
- `components/dashboard/domain-nav.tsx` - Fetch domains from API
- `components/consent/consent-dialog.tsx` - Dynamic scope descriptions
- `components/dashboard/user-profile.tsx` - Dynamic domain icons
- `app/consents/page.tsx` - Dynamic scope info

### 7. Portfolio PDF Parser (PENDING)
**Priority**: HIGH - Agent Kai enhancement
**Files**: `consent-protocol/hushh_mcp/services/portfolio_import_service.py`

**TODO**:
- Add `pdfplumber` dependency to `requirements.txt`
- Implement `parse_fidelity_pdf()` for Fidelity statements
- Implement `parse_jpmorgan_pdf()` for JPMorgan statements
- Extract: account summary, asset allocation, holdings tables, income

### 8. Enhanced Financial KPIs (PENDING)
**Priority**: HIGH - Agent Kai enhancement
**Files**: `consent-protocol/hushh_mcp/services/portfolio_import_service.py`

**TODO**:
- Create `EnhancedHolding` and `EnhancedPortfolio` dataclasses
- Implement `_derive_enhanced_kpis()` with 15+ KPIs:
  - Asset allocation breakdown (`allocation_domestic_stock`, etc.)
  - Income metrics (`annual_dividend_income`, `portfolio_yield`)
  - Tax efficiency (`tax_loss_harvesting_candidates`, `long_term_gain_positions`)
  - Concentration (`top_5_concentration`, `top_holding_symbol`)
  - Sector exposure (`sector_technology`, `sector_financial`, etc.)
  - Risk indicators (`margin_exposure`, `short_positions_count`)
  - Performance (`ytd_return_pct`, `total_unrealized_gain_loss`)

### 9. Kai Data Completeness Check (PENDING)
**Priority**: MEDIUM
**Files**: `consent-protocol/hushh_mcp/services/kai_chat_service.py`

**TODO**:
- Add `_check_data_completeness()` method
- Check for missing attributes: `portfolio_imported`, `risk_tolerance`, `investment_horizon`, `income_bracket`
- Return completeness score and missing attributes list
- Integrate into chat flow for proactive prompts

### 10. Native Plugins for World Model (PENDING)
**Priority**: MEDIUM - Required for mobile
**Files**: iOS and Android plugins

**TODO**:
- iOS: `hushh-webapp/ios/App/App/Plugins/WorldModelPlugin.swift`
  - Add `listDomains(includeEmpty: Bool) -> [DomainInfo]`
  - Add `getAvailableScopes(userId: String) -> [String]`
- Android: `hushh-webapp/android/.../WorldModelPlugin.kt`
  - Add same methods as iOS

### 11. Architecture Compliance Tests (PENDING)
**Priority**: HIGH - Prevent regressions
**Files**: `consent-protocol/tests/quality/test_architecture_compliance.py`

**TODO**:
- Add test: Verify no hardcoded domain strings outside `DEFAULT_DOMAIN_METADATA`
- Add test: Verify all scope resolution uses `DynamicScopeGenerator`
- Add test: Verify `VaultDBService` methods log deprecation warnings
- Add test: Verify `world_model_attributes.domain` column is TEXT not ENUM

### 12. Documentation Updates (PENDING)
**Priority**: MEDIUM
**Files**: `docs/project_context_map.md`

**TODO**:
- Document dynamic domain architecture
- Document scope generation pattern: `attr.{domain}.{attribute_key}`
- Document new financial KPIs (15+ metrics)
- Update World Model tri-flow table
- Add migration guide from legacy vault_* to world_model_data

---

## Architecture Highlights

### Dynamic Scope Resolution Flow
```
User Request (attr.food.*)
  ↓
resolve_scope_to_enum() → ConsentScope.WORLD_MODEL_READ
  ↓
DynamicScopeGenerator.parse_scope() → (domain="food", wildcard=True)
  ↓
Token Validation
  ↓
WorldModelService.get_domain_attributes(domain="food")
```

### Domain Discovery Flow
```
Attribute Stored → domain="netflix_subscription"
  ↓
DomainInferrer.infer() → "subscriptions"
  ↓
DomainRegistryService.register_domain("subscriptions")
  ↓
Auto-creates in domain_registry table
  ↓
ScopeGenerator.generate_scope("subscriptions", "netflix_subscription")
  ↓
Returns: "attr.subscriptions.netflix_subscription"
```

---

## Next Steps

1. **Complete backend data_tools generic handler** (Task #3)
2. **Create World Model API endpoints** (Task #4)
3. **Implement PDF parser and enhanced KPIs** (Tasks #7-8)
4. **Update frontend for dynamic domains** (Tasks #5-6)
5. **Add architecture compliance tests** (Task #11)
6. **Update documentation** (Task #12)

---

**Estimated Remaining Work**: ~300-400 lines of new code, ~500-600 lines of modifications
**Critical Path**: Backend API endpoints → Frontend services → UI components
