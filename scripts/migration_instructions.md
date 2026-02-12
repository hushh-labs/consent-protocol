# Cloud SQL to Supabase Migration Instructions

> **Status**: Migration Complete (January 2026)
> **Current schema**: DB_* only (no DATABASE_URL). App uses **consent_audit** for consent; no consent_events. This doc is for **one-time data migration** from an existing Cloud SQL instance.

## Migration Complete

The migration from asyncpg (Cloud SQL) to Supabase has been completed. All API routes use the service layer (DB_* connection):

- **VaultDBService** - Vault operations
- **ConsentDBService** - Consent management (consent_audit table)
- **WorldModelService** - World model data and attributes

See `docs/reference/database_service_layer.md` for architecture details.

## Prerequisites (For Data Migration Only)

Only needed when migrating data from an existing Cloud SQL database:

1. **Cloud SQL Proxy** (only if source is Cloud SQL): run on port 5432, then set `DB_*` in `.env` to point at that source.
   ```bash
   ./cloud-sql-proxy YOUR_GCP_PROJECT:us-central1:hushh-vault-db --port 5432
   ```

2. **Environment variables** in `consent-protocol/.env`: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` (see `.env.example`). For source migration, set `DB_*` to the source instance for the migration run.

## Step 1: Initialize Supabase Schema

Since direct PostgreSQL connection has DNS issues, initialize schema via Supabase Dashboard:

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste the contents of `consent-protocol/scripts/init_supabase_schema.sql`
5. Click "Run" to execute

This will create all 8 tables with proper indexes and constraints (mirrors db/migrate.py; prefer `python db/migrate.py --init` for programmatic setup).

## Step 2: Run Migration

```bash
cd consent-protocol
# Use DB_* in .env (same as runtime). For source DB, set DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME to source.
python3 scripts/migrate_cloudsql_to_supabase.py --batch-size 500
```

## Step 3: Verify Migration

The script automatically verifies:
- Row counts match for all tables
- Total rows migrated: 1,821
- Zero data loss confirmed

## Migration Details

**Tables to migrate (in dependency order); app uses consent_audit (not consent_events):**
1. vault_keys (11 rows)
2. consent_audit (97 rows)

> **Note:** The following tables existed in the original Cloud SQL database but have since been dropped and replaced by the unified `world_model_data` architecture: `investor_profiles`, `vault_kai`, `user_investor_profiles`, `vault_food`, `vault_professional`, `vault_kai_preferences`. They are listed here only for historical reference.

**Total: ~108 rows (core tables)**

## Data Type Handling

The migration script automatically handles:
- Decimal → float
- datetime → ISO format string
- date → ISO format string
- JSONB strings → parsed dict/list
- Arrays → lists
- All other types → JSON-serializable format

## Troubleshooting

- **"Table does not exist"**: Run Step 1 to initialize schema
- **"JSON serialization error"**: Check data type conversion (should be automatic)
- **"Row count mismatch"**: Migration stops immediately to prevent data loss
