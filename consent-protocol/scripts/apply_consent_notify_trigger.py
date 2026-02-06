#!/usr/bin/env python3
"""
Apply the NOTIFY trigger on consent_audit to the runtime database.

Uses DB_* from .env (same as the app). Run from consent-protocol:
  python scripts/apply_consent_notify_trigger.py

Requires: DB_USER, DB_PASSWORD, DB_HOST (and optionally DB_PORT, DB_NAME).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


def main() -> int:
    if not all(os.getenv(k) for k in ("DB_USER", "DB_PASSWORD", "DB_HOST")):
        print("DB_USER, DB_PASSWORD, DB_HOST are not set. Set them or use .env.", file=sys.stderr)
        return 1

    try:
        from sqlalchemy import text
        from db.db_client import get_db_connection
    except ImportError as e:
        print("Error: could not import db_client.", e, file=sys.stderr)
        return 1

    migration_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "migrations")
    sql_path = os.path.join(migration_dir, "011_consent_audit_notify_trigger.sql")
    if not os.path.isfile(sql_path):
        print(f"Migration file not found: {sql_path}", file=sys.stderr)
        return 1

    with open(sql_path, "r") as f:
        sql_content = f.read()

    # Remove comments and split into statements (function body has semicolons, so split carefully)
    # Run as one block; PostgreSQL accepts multiple statements in one execute for DDL
    statements = []
    current = []
    in_body = False
    dollar_quote = None
    for line in sql_content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        if "RETURNS TRIGGER AS $$" in line or "LANGUAGE plpgsql" in line:
            in_body = not in_body
        if not in_body and stripped.endswith(";"):
            current.append(line)
            st = "\n".join(current).strip()
            if st:
                statements.append(st)
            current = []
        else:
            current.append(line)
    if current:
        st = "\n".join(current).strip()
        if st:
            statements.append(st)

    # Simpler: execute the whole file in one go (psycopg2 and SQLAlchemy support it for DDL)
    try:
        with get_db_connection() as conn:
            conn.execute(text(sql_content))
        print("Consent NOTIFY trigger applied successfully.")
        return 0
    except Exception as e:
        print(f"Failed to apply trigger: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
