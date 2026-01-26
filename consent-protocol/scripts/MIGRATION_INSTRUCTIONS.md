# Cloud SQL to Supabase Migration Instructions

## Prerequisites

1. **Cloud SQL Proxy running** on port 5432
   ```bash
   ./cloud-sql-proxy hushh-pda:us-central1:hushh-vault-db --port 5432
   ```

2. **Environment variables set** in `consent-protocol/.env`:
   - `SUPABASE_URL=https://fsvekkslfzjzscyibjil.supabase.co`
   - `SUPABASE_KEY=SB_SECRET_PLACEHOLDER`

## Step 1: Initialize Supabase Schema

Since direct PostgreSQL connection has DNS issues, initialize schema via Supabase Dashboard:

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste the contents of `consent-protocol/scripts/init_supabase_schema.sql`
5. Click "Run" to execute

This will create all 9 tables with proper indexes and constraints.

## Step 2: Run Migration

```bash
cd consent-protocol
export SOURCE_DATABASE_URL="postgresql://hushh_app:hushh_secure_2024!@127.0.0.1:5432/hushh_vault"
python3 scripts/migrate_cloudsql_to_supabase.py --batch-size 500
```

## Step 3: Verify Migration

The script automatically verifies:
- Row counts match for all tables
- Total rows migrated: 1,821
- Zero data loss confirmed

## Migration Details

**Tables to migrate (in dependency order):**
1. investor_profiles (1,683 rows)
2. vault_keys (11 rows)
3. consent_events (0 rows)
4. vault_kai (0 rows)
5. consent_audit (97 rows)
6. user_investor_profiles (7 rows)
7. vault_food (3 rows)
8. vault_professional (4 rows)
9. vault_kai_preferences (16 rows)

**Total: 1,821 rows**

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
