# Database Service Layer Architecture

> **Status**: Active (Supabase REST API Migration Complete)
> **Last Updated**: January 2026

## Overview

Hushh uses a **consent-first service layer architecture** for all database operations. All database access goes through service classes that validate consent tokens before performing any operations.

## Core Principle: Consent-First & Agent-Mediated Access

**MANDATORY:** All database access MUST go through service layer with consent validation.

### Architecture Flow

```
API Route → Service Layer (validates consent) → Supabase Client → Database
```

### Forbidden Pattern (DO NOT DO)

```python
# ❌ WRONG: API route directly accessing Supabase
@router.post("/preferences")
async def get_preferences():
    supabase = get_supabase()  # ❌ Direct access
    response = supabase.table("vault_food").select("*").execute()
```

### Required Pattern

```python
# ✅ CORRECT: API route → Service layer → Supabase
@router.post("/preferences")
async def get_preferences():
    # Service validates consent token internally
    service = VaultDBService()
    data = await service.get_encrypted_fields(
        user_id=user_id,
        domain="food",
        consent_token=consent_token  # Validated inside service
    )
```

## Service Layer Components

### 1. VaultDBService (`hushh_mcp/services/vault_db.py`)

Unified database service for agent-mediated vault access.

**Responsibilities:**

- Validate consent tokens before all operations
- Store and retrieve encrypted vault data
- Handle vault operations for all domains (food, professional, kai_preferences, kai_decisions)
- Log audit events

**Domains Supported:**

- `food` → `vault_food` table
- `professional` → `vault_professional` table
- `kai_preferences` → `vault_kai_preferences` table
- `kai_decisions` → `vault_kai` table

**Key Methods:**

- `get_encrypted_fields()` - Retrieve encrypted fields (requires read consent)
- `store_encrypted_field()` - Store single encrypted field (requires write consent)
- `store_encrypted_fields()` - Batch store encrypted fields (requires write consent)
- `delete_encrypted_fields()` - Delete encrypted fields (requires write consent)
- `check_vault_exists()` - Check if vault has data (no consent required)
- `get_field_names()` - List field names (requires read consent)

### 2. ConsentDBService (`hushh_mcp/services/consent_db.py`)

Service layer for consent-related database operations.

**Responsibilities:**

- Manage pending consent requests
- Track active consent tokens
- Maintain consent audit log
- Insert consent events

**Key Methods:**

- `get_pending_requests()` - Get pending consent requests for a user
- `get_active_tokens()` - Get active (non-expired) consent tokens
- `is_token_active()` - Check if token is active for a scope
- `was_recently_denied()` - Check if consent was recently denied (cooldown)
- `get_audit_log()` - Get paginated audit log
- `insert_event()` - Insert consent event (REQUESTED, GRANTED, DENIED, REVOKED)
- `log_operation()` - Log vault owner operation

### 3. InvestorDBService (`hushh_mcp/services/investor_db.py`)

Service layer for investor profile database operations.

**Responsibilities:**

- Search investor profiles (public data, no consent required)
- Retrieve investor profiles by ID or CIK
- Provide investor statistics

**Key Methods:**

- `search_investors()` - Search investors by name (fuzzy matching)
- `get_investor_by_id()` - Get full investor profile by ID
- `get_investor_by_cik()` - Get investor profile by SEC CIK
- `get_investor_stats()` - Get aggregate statistics
- `upsert_investor()` - Create/update investor profile (admin only)

**Note:** Investor search operations are public (no consent required) as they only access public investor profile data from SEC filings.

### 4. VaultKeysService (`hushh_mcp/services/vault_keys_service.py`)

Service layer for vault key management operations.

**Responsibilities:**

- Check vault existence
- Retrieve vault key data for unlock
- Setup new vault with encryption keys
- Get multi-domain vault status

**Key Methods:**

- `check_vault_exists()` - Check if user has a vault
- `get_vault_key()` - Retrieve vault key data (for unlock flow)
- `setup_vault()` - Create new vault with encrypted keys
- `get_vault_status()` - Get status across all vault domains

### 5. KaiDecisionsService (`hushh_mcp/services/kai_decisions_service.py`)

Service layer for Kai investment decision storage.

**Responsibilities:**

- Store encrypted investment decisions
- Retrieve user's decision history
- Delete decisions

**Key Methods:**

- `store_decision()` - Store encrypted decision (requires VAULT_OWNER)
- `get_decisions()` - Get paginated decisions (requires VAULT_OWNER)
- `get_decision_by_id()` - Get single decision (requires VAULT_OWNER)
- `delete_decision()` - Delete decision (requires VAULT_OWNER)

### 6. UserInvestorProfileService (`hushh_mcp/services/user_investor_profile_db.py`)

Service layer for user identity profiles (encrypted investor identity).

**Responsibilities:**

- Create/update encrypted user profiles
- Retrieve profile status
- Delete profiles

**Key Methods:**

- `create_or_update_profile()` - Store encrypted identity
- `get_status()` - Check if profile exists
- `get_profile()` - Retrieve encrypted profile
- `delete_profile()` - Delete user profile

## Supabase Client Access

### Private Module: `db/supabase_client.py`

The Supabase client is a **PRIVATE MODULE** that should ONLY be imported by service layer files.

**Access Rules:**

- ✅ Service classes (`VaultDBService`, `ConsentDBService`, `InvestorDBService`)
- ❌ API routes (forbidden - use service layer instead)
- ❌ Direct imports in route files (forbidden)

**Initialization:**

```python
from db.supabase_client import get_supabase

# Singleton pattern - initialized once
supabase = get_supabase()
```

**Environment Variables Required:**

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service role key (secret)

## Migration from asyncpg

### What Changed

**Before (asyncpg):**

```python
from db.connection import get_pool

pool = await get_pool()
async with pool.acquire() as conn:
    rows = await conn.fetch("SELECT * FROM table WHERE user_id = $1", user_id)
```

**After (Supabase REST API):**

```python
from hushh_mcp.services.vault_db import VaultDBService

service = VaultDBService()
data = await service.get_encrypted_fields(
    user_id=user_id,
    domain="food",
    consent_token=consent_token
)
```

### Key Differences

1. **No Direct SQL**: Supabase REST API doesn't support raw SQL queries
2. **Query Builder**: Use Supabase's query builder (`.select()`, `.eq()`, `.insert()`, etc.)
3. **No Transactions**: Supabase REST API doesn't support transactions - use batch operations
4. **Post-Processing**: Complex queries (CTEs, DISTINCT ON) require Python post-processing
5. **JSON Handling**: JSONB fields are automatically handled as JSON

### Complex Query Handling

For queries that used PostgreSQL-specific features (CTEs, DISTINCT ON, window functions), we:

1. Fetch broader results using Supabase filters
2. Post-process in Python to achieve the same result
3. Example: `get_pending_requests()` fetches all relevant rows and filters in Python

## Service Layer Responsibilities

1. **Consent Validation**: All service methods validate consent tokens before database access
2. **Database Operations**: Perform all database operations via Supabase client
3. **Audit Logging**: Log operations to consent_audit table
4. **Error Handling**: Handle errors appropriately and return meaningful exceptions

## API Route Pattern

All API routes should follow this pattern:

```python
from hushh_mcp.services.vault_db import VaultDBService, ConsentValidationError
from fastapi import HTTPException

@router.post("/preferences")
async def get_preferences(request: Request):
    body = await request.json()
    user_id = body.get("userId")
    consent_token = body.get("consentToken")

    # Use service layer (validates consent internally)
    service = VaultDBService()
    try:
        data = await service.get_encrypted_fields(
            user_id=user_id,
            domain="food",
            consent_token=consent_token
        )
    except ConsentValidationError as e:
        raise HTTPException(
            status_code=401 if e.reason in ["missing_token", "invalid_token"] else 403,
            detail=str(e)
        )

    return {"preferences": data}
```

## Deprecated: `db/connection.py`

The `db/connection.py` module (asyncpg) is **deprecated** and will be removed in a future version.

**Current Status:**

- Marked as deprecated with warnings
- Kept temporarily for schema creation scripts (`db/migrate.py`) which need asyncpg for DDL
- **DO NOT use** in:
  - API routes (use service layer instead)
  - Service layer (use `db.supabase_client` instead)

## Verification Checklist

After implementing database operations, verify:

- [ ] No API routes directly import `db.supabase_client`
- [ ] All API routes use service layer methods
- [ ] All service layer methods validate consent tokens
- [ ] No direct database access in API routes
- [ ] Service layer is the only place with Supabase client access

## Security Audit Commands

```bash
# Verify no direct Supabase access in API routes
grep -r "from db.supabase_client import\|from db import supabase_client\|get_supabase()" consent-protocol/api/routes/

# Should return ZERO results (or only in service layer files)

# Verify service layer files have Supabase access
grep -r "from db.supabase_client import\|get_supabase()" consent-protocol/hushh_mcp/services/

# Should return results (service layer should have access)
```
