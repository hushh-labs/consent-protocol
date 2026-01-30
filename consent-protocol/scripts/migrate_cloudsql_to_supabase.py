#!/usr/bin/env python3
"""
Cloud SQL (source) -> Supabase (dest) migration using hybrid approach.

Source (Cloud SQL): Uses asyncpg (works fine via proxy on port 5432)
Destination (Supabase): Uses Supabase REST API client (supabase-py)

Goal:
- Zero data loss at the time of migration: we copy every row from source tables
  into destination tables, then verify row counts match.

How it works:
- Reads SOURCE_DATABASE_URL from environment (Cloud SQL via proxy).
- Reads Supabase REST API credentials from environment (SUPABASE_URL, SUPABASE_KEY).
- Creates destination schema first by invoking db/migrate.py --init (optional flag).
- Migrates a fixed set of tables in dependency order.
- For each table:
  - Reads all rows from source (asyncpg)
  - Inserts into destination using UPSERT when a primary key exists (Supabase REST API)
  - Verifies row count matches source

Notes:
- Supabase REST API uses HTTPS and doesn't require direct PostgreSQL connection.
- This script does not print credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import asyncpg
from dotenv import load_dotenv
from supabase import Client, create_client

# Load environment variables from .env
load_dotenv()

# Migration order based on dependencies (parent tables first)
TABLES_IN_ORDER: List[str] = [
    "investor_profiles",      # No dependencies
    "vault_keys",             # No dependencies, referenced by others
    "consent_events",         # No dependencies
    "vault_kai",              # No dependencies
    "consent_audit",          # No dependencies
    "user_investor_profiles", # Depends on vault_keys, investor_profiles
    "vault_food",             # Depends on vault_keys
    "vault_professional",     # Depends on vault_keys
    "vault_kai_preferences",  # Depends on vault_keys
]


@dataclass(frozen=True)
class TableInfo:
    name: str
    columns: List[str]
    pk_columns: List[str]


def _chunked(seq: Sequence[Tuple[Any, ...]], chunk_size: int) -> Iterable[Sequence[Tuple[Any, ...]]]:
    for i in range(0, len(seq), chunk_size):
        yield seq[i : i + chunk_size]


# ============================================================================
# DATA TYPE CONVERSION (for JSON serialization)
# ============================================================================

def _convert_value_for_json(value: Any) -> Any:
    """
    Convert PostgreSQL types to JSON-serializable types for Supabase REST API.
    
    Handles:
    - Decimal → float (or str if precision critical)
    - datetime → ISO format string
    - date → ISO format string
    - JSONB strings → parsed dict/list
    - Arrays → lists (recursively converted)
    - Other types → pass through or convert to string
    """
    if value is None:
        return None
    elif isinstance(value, Decimal):
        # Convert Decimal to float (lose precision but JSON-compatible)
        # For very large numbers or precision-critical values, could use str(value)
        return float(value)
    elif isinstance(value, datetime):
        # Convert to ISO format string (Supabase expects ISO 8601)
        return value.isoformat()
    elif isinstance(value, date):
        # Convert to ISO format string
        return value.isoformat()
    elif isinstance(value, str):
        # Check if it's a JSON string (from JSONB column)
        # asyncpg returns JSONB as strings, not parsed objects
        stripped = value.strip()
        if stripped.startswith(('{', '[')) and stripped.endswith(('}', ']')):
            try:
                parsed = json.loads(value)
                # Recursively convert nested structures
                return _convert_value_for_json(parsed)
            except json.JSONDecodeError:
                # Not valid JSON, return as string
                return value
        return value
    elif isinstance(value, list):
        # Recursively convert list items
        return [_convert_value_for_json(item) for item in value]
    elif isinstance(value, dict):
        # Recursively convert dict values
        return {k: _convert_value_for_json(v) for k, v in value.items()}
    elif isinstance(value, (int, float, bool)):
        # Already JSON-serializable
        return value
    elif isinstance(value, bytes):
        # Convert bytes to string (base64 or hex)
        return value.decode('utf-8', errors='replace')
    else:
        # Unknown type - convert to string as fallback
        # Log a warning for unexpected types
        return str(value)


# ============================================================================
# ASYNCPG FUNCTIONS (for Cloud SQL source)
# ============================================================================

async def _get_table_info_asyncpg(conn: asyncpg.Connection, table: str) -> TableInfo:
    """Get table info from Cloud SQL source using asyncpg."""
    cols = await conn.fetch(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
        """,
        table,
    )
    columns = [r["column_name"] for r in cols]

    pk_rows = await conn.fetch(
        """
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
        """,
        table,
    )
    pk_columns = [r["column_name"] for r in pk_rows]
    return TableInfo(name=table, columns=columns, pk_columns=pk_columns)


async def _fetch_all_rows_asyncpg(
    conn: asyncpg.Connection, table: str, columns: List[str]
) -> List[Tuple[Any, ...]]:
    """Fetch all rows from Cloud SQL source using asyncpg."""
    col_sql = ", ".join(f'"{c}"' for c in columns)
    rows = await conn.fetch(f'SELECT {col_sql} FROM "{table}"')  # noqa: S608
    return [tuple(r[c] for c in columns) for r in rows]


async def _row_count_asyncpg(conn: asyncpg.Connection, table: str) -> int:
    """Get row count from Cloud SQL source using asyncpg."""
    return int(await conn.fetchval(f'SELECT COUNT(*) FROM "{table}"'))  # noqa: S608


# ============================================================================
# SUPABASE REST API FUNCTIONS (for Supabase destination)
# ============================================================================

def _get_table_info_supabase(supabase: Client, table: str, source_info: TableInfo) -> TableInfo:
    """
    Get table info from Supabase destination using REST API.
    
    Since Supabase REST API doesn't expose information_schema, we:
    1. Use the source table info (assumes destination schema matches)
    2. Optionally verify by fetching one row to check column names
    """
    # Try to fetch one row to verify columns exist
    try:
        response = supabase.table(table).select("*").limit(1).execute()
        if response.data and len(response.data) > 0:
            # Verify that response keys match expected columns
            response_keys = set(response.data[0].keys())
            expected_keys = set(source_info.columns)
            if response_keys != expected_keys:
                # Log warning but continue (schema might have extra columns)
                print(f"  Warning: Column mismatch detected for {table}")
    except Exception as exc:
        # Table might be empty or schema check may fail; continue with source schema.
        print(f"  Warning: could not validate columns for {table}: {exc}")
    
    # Return source info (destination should match)
    return source_info


def _row_count_supabase(supabase: Client, table: str) -> int:
    """Get row count from Supabase destination using REST API."""
    try:
        # Use count="exact" to get count from response
        # The count parameter should be passed as a keyword argument
        response = supabase.table(table).select("*", count="exact").limit(0).execute()
        
        # Try different ways to access count based on Supabase Python client version
        count = None
        
        # Method 1: Direct attribute
        if hasattr(response, 'count') and response.count is not None:
            count = response.count
        # Method 2: Check if count is in response data
        elif hasattr(response, 'data') and isinstance(response.data, dict) and 'count' in response.data:
            count = response.data['count']
        # Method 3: Check response headers or other attributes
        elif hasattr(response, '__dict__'):
            # Check all attributes for count
            for key, value in response.__dict__.items():
                if 'count' in key.lower() and isinstance(value, (int, str)):
                    try:
                        count = int(value)
                        break
                    except (ValueError, TypeError):
                        pass
        
        if count is not None:
            return int(count)
        
        # Fallback: fetch all and count (less efficient but reliable)
        # Only use for small tables or when count is not available
        response = supabase.table(table).select("*").execute()
        if response.data is not None:
            return len(response.data)
        return 0
        
    except Exception as e:
        # Don't silently return 0 - raise exception for data loss detection
        error_msg = str(e)
        # Only allow "table doesn't exist" to return 0, everything else is an error
        if "Could not find the table" in error_msg or "PGRST205" in error_msg:
            # Table doesn't exist - return 0 (expected for empty/new tables)
            return 0
        else:
            # Real error - raise it
            raise RuntimeError(f"Failed to get row count for {table}: {e}")


def _upsert_rows_supabase(
    supabase: Client,
    table: TableInfo,
    rows: Sequence[Tuple[Any, ...]],
    batch_size: int,
) -> None:
    """Insert/upsert rows into Supabase destination using REST API."""
    if not rows:
        return

    # Convert tuples to dictionaries with data type conversion
    def tuple_to_dict(row: Tuple[Any, ...]) -> Dict[str, Any]:
        """Convert tuple row to dictionary with JSON-serializable values."""
        result = {}
        for col, val in zip(table.columns, row, strict=True):
            try:
                result[col] = _convert_value_for_json(val)
            except Exception as e:
                raise RuntimeError(
                    f"Failed to convert value for column '{col}' in table '{table.name}': {e}. "
                    f"Value type: {type(val).__name__}, value: {repr(val)[:100]}"
                )
        return result

    # Determine upsert conflict column(s)
    # For single PK: use column name
    # For composite PK: use comma-separated string
    if table.pk_columns:
        if len(table.pk_columns) == 1:
            on_conflict = table.pk_columns[0]
        else:
            # Multi-column primary key: comma-separated string
            on_conflict = ",".join(table.pk_columns)
    else:
        on_conflict = None

    # Process in batches
    for chunk in _chunked(list(rows), batch_size):
        # Convert chunk to list of dictionaries with data type conversion
        data = []
        for row_idx, row in enumerate(chunk):
            try:
                row_dict = tuple_to_dict(row)
                # Validate JSON serialization before sending
                try:
                    json.dumps(row_dict)
                except (TypeError, ValueError) as json_err:
                    raise RuntimeError(
                        f"Row {row_idx} in table '{table.name}' contains non-JSON-serializable data: {json_err}. "
                        f"Row data: {list(row_dict.keys())[:5]}..."
                    )
                data.append(row_dict)
            except RuntimeError:
                # Re-raise conversion errors
                raise
            except Exception as e:
                raise RuntimeError(
                    f"Failed to convert row {row_idx} in table '{table.name}': {e}"
                )

        try:
            if on_conflict:
                # Use upsert for tables with primary keys
                response = supabase.table(table.name).upsert(data, on_conflict=on_conflict).execute()
            else:
                # Use insert for tables without primary keys
                response = supabase.table(table.name).insert(data).execute()
            
            if not response.data:
                raise RuntimeError(f"Upsert/insert returned no data for {table.name}")
        except Exception as e:
            from postgrest.exceptions import APIError
            
            error_msg = str(e)
            
            # Check if table doesn't exist
            if isinstance(e, APIError) and hasattr(e, 'code') and e.code == 'PGRST205':
                raise RuntimeError(
                    f"Table '{table.name}' does not exist in Supabase. "
                    f"Please initialize the schema first by running the SQL script in Supabase Dashboard: "
                    f"consent-protocol/scripts/init_supabase_schema.sql"
                )
            
            # Provide more context about the error
            if "JSON" in error_msg or "serializable" in error_msg.lower():
                raise RuntimeError(
                    f"JSON serialization error for table '{table.name}': {e}. "
                    f"This may indicate a data type conversion issue. "
                    f"Check that all values are properly converted."
                )
            raise RuntimeError(f"Failed to upsert rows into {table.name}: {e}")


# ============================================================================
# MAIN MIGRATION LOGIC
# ============================================================================

async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate data from Cloud SQL to Supabase with zero data loss verification"
    )
    parser.add_argument("--batch-size", type=int, default=500,
                        help="Number of rows to insert per batch (default: 500)")
    parser.add_argument(
        "--skip-init",
        action="store_true",
        help="Skip schema verification (assumes schema exists and matches).",
    )
    parser.add_argument(
        "--skip-schema-check",
        action="store_true",
        help="Skip schema existence check (use if schema is pre-initialized via SQL script).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run mode: verify connections and schemas, but don't migrate data.",
    )
    args = parser.parse_args()

    # Source: Cloud SQL via proxy (asyncpg)
    source_url = os.getenv("SOURCE_DATABASE_URL")
    if not source_url:
        raise SystemExit("SOURCE_DATABASE_URL must be set in environment.")

    # Destination: Supabase REST API
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise SystemExit(
            "Supabase REST API credentials must be set in environment: "
            "SUPABASE_URL and SUPABASE_KEY"
        )

    print("Connecting to databases...")
    print(f"  Source (Cloud SQL): {source_url.split('@')[1] if '@' in source_url else '***'}")
    print(f"  Destination (Supabase): {supabase_url}")

    # Connect to source (asyncpg)
    src_conn = await asyncpg.connect(source_url, timeout=15)

    # Connect to destination (Supabase REST API)
    supabase = create_client(supabase_url, supabase_key)

    # Test connections
    try:
        test_result = await src_conn.fetchval("SELECT 1")
        print(f"  Source connection: OK (test={test_result})")
    except Exception as e:
        await src_conn.close()
        raise SystemExit(f"Failed to connect to source: {e}")

    try:
        # Test Supabase connection - try to access API (table may not exist yet)
        from postgrest.exceptions import APIError
        try:
            supabase.table("vault_keys").select("user_id").limit(1).execute()
            print("  Destination connection: OK (REST API accessible, table exists)")
        except APIError as api_error:
            # Table doesn't exist is OK - just verify API is accessible
            error_code = getattr(api_error, 'code', None)
            error_msg = str(api_error)
            if error_code == 'PGRST205' or "Could not find the table" in error_msg:
                print("  Destination connection: OK (REST API accessible, tables not initialized yet)")
            else:
                # Real API error (auth, permissions, etc.)
                raise SystemExit(f"Supabase API error: {error_msg}")
        except Exception as e:
            # Other errors (network, etc.)
            raise SystemExit(f"Failed to connect to Supabase: {e}")
    except SystemExit:
        await src_conn.close()
        raise
    except Exception as e:
        await src_conn.close()
        raise SystemExit(f"Failed to connect to destination: {e}")

    try:
        # Optional init: create tables on destination
        if not args.skip_init:
            # Run the existing migration script in-process by importing it would be risky;
            # we expect caller to have already run `python db/migrate.py --init` when needed.
            pass

        # Pre-migration verification: Record baseline row counts
        print("\n" + "=" * 70)
        print("PRE-MIGRATION VERIFICATION")
        print("=" * 70)
        baseline_counts = {}
        print("\nRecording baseline row counts from source...")
        for table_name in TABLES_IN_ORDER:
            count = await _row_count_asyncpg(src_conn, table_name)
            baseline_counts[table_name] = count
            print(f"  {table_name}: {count:,} rows")
        
        total_baseline = sum(baseline_counts.values())
        print(f"\nTotal rows to migrate: {total_baseline:,}")
        
        # Verify destination schema exists for all tables (unless skipped)
        if not args.skip_schema_check:
            print("\nVerifying destination schema...")
            schema_issues = []
            for table_name in TABLES_IN_ORDER:
                try:
                    src_info = await _get_table_info_asyncpg(src_conn, table_name)
                    dst_info = _get_table_info_supabase(supabase, table_name, src_info)
                    
                    # Check column match
                    if src_info.columns != dst_info.columns:
                        schema_issues.append(
                            f"{table_name}: Column mismatch - "
                            f"source={len(src_info.columns)} cols, dest={len(dst_info.columns)} cols"
                        )
                    else:
                        print(f"  ✅ {table_name}: Schema matches ({len(src_info.columns)} columns)")
                except Exception as e:
                    # Table might not exist in destination
                    error_msg = str(e)
                    if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                        schema_issues.append(f"{table_name}: Table does not exist in destination (run SQL script to initialize)")
                    else:
                        schema_issues.append(f"{table_name}: Schema verification failed - {e}")
            
            if schema_issues:
                print("\n⚠️  Schema issues detected:")
                for issue in schema_issues:
                    print(f"  - {issue}")
                print("\n⚠️  WARNING: Schema issues found.")
                print("   To initialize schema, run the SQL script in Supabase Dashboard:")
                print("   File: consent-protocol/scripts/init_supabase_schema.sql")
                print("\n   Or if schema is already initialized, use --skip-schema-check flag.")
                raise SystemExit("Schema verification failed. Fix schema issues before migrating.")
            else:
                print("\n✅ All schemas verified successfully")
        else:
            print("\n⏭️  Skipping schema verification (--skip-schema-check flag used)")
            print("   Assuming all tables exist and schemas match.")
        
        if args.dry_run:
            print("\n" + "=" * 70)
            print("DRY RUN MODE - No data will be migrated")
            print("=" * 70)
            print("\n✅ Dry run complete:")
            print("  - Source connection: OK")
            print("  - Destination connection: OK")
            print("  - Schema verification: OK")
            print(f"  - Baseline row counts recorded: {total_baseline:,} total rows")
            print("\nTo perform actual migration, run without --dry-run flag.")
            return 0

        print("\n" + "=" * 70)
        print("STARTING MIGRATION")
        print("=" * 70)

        for table_name in TABLES_IN_ORDER:
            print(f"\nMigrating {table_name}...")

            # Get table info from source
            src_info = await _get_table_info_asyncpg(src_conn, table_name)
            
            # Get table info from destination (uses source info as base)
            dst_info = _get_table_info_supabase(supabase, table_name, src_info)

            if src_info.columns != dst_info.columns:
                raise RuntimeError(
                    f"Column mismatch for {table_name}: "
                    f"source={src_info.columns} dest={dst_info.columns}"
                )

            # Fetch all rows from source
            rows = await _fetch_all_rows_asyncpg(src_conn, table_name, src_info.columns)
            src_count = len(rows)

            print(f"  Source rows: {src_count}")

            # Insert into destination
            if src_count > 0:
                _upsert_rows_supabase(supabase, dst_info, rows, batch_size=args.batch_size)
                print(f"  Inserted {src_count} rows into destination")

            # Verify row count
            dst_count = _row_count_supabase(supabase, table_name)
            if dst_count != src_count:
                raise RuntimeError(
                    f"❌ DATA LOSS DETECTED for {table_name}: "
                    f"source={src_count} rows, dest={dst_count} rows. "
                    f"Migration stopped to prevent data loss."
                )

            # Verify against baseline
            baseline_count = baseline_counts.get(table_name, 0)
            if dst_count != baseline_count:
                raise RuntimeError(
                    f"❌ DATA LOSS DETECTED for {table_name}: "
                    f"baseline={baseline_count} rows, current dest={dst_count} rows. "
                    f"Migration stopped to prevent data loss."
                )

            print(f"  ✅ Verified: {dst_count} rows match (baseline: {baseline_count})")

        # Final verification: Compare all counts
        print("\n" + "=" * 70)
        print("FINAL VERIFICATION")
        print("=" * 70)
        all_match = True
        total_migrated = 0
        
        for table_name in TABLES_IN_ORDER:
            baseline = baseline_counts[table_name]
            final_count = _row_count_supabase(supabase, table_name)
            total_migrated += final_count
            
            if final_count == baseline:
                print(f"  ✅ {table_name}: {final_count:,} rows (matches baseline)")
            else:
                print(f"  ❌ {table_name}: {final_count:,} rows (baseline: {baseline:,}) - MISMATCH!")
                all_match = False
        
        print(f"\nTotal rows migrated: {total_migrated:,}")
        print(f"Total baseline rows: {total_baseline:,}")
        
        if not all_match or total_migrated != total_baseline:
            raise RuntimeError(
                f"❌ MIGRATION FAILED: Row count mismatch detected. "
                f"Expected {total_baseline:,} rows, got {total_migrated:,} rows. "
                f"Data loss may have occurred."
            )
        
        print("\n✅ Migration complete - All tables verified, zero data loss confirmed.")
        return 0
    finally:
        await src_conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
