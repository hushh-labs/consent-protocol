#!/usr/bin/env python3
"""
Admin cleanup for legacy self/internal consent rows.

Usage:
  python scripts/cleanup_consent_audit_noise.py
  python scripts/cleanup_consent_audit_noise.py --apply
  python scripts/cleanup_consent_audit_noise.py --user-id <firebase_uid>
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.db_client import get_db  # noqa: E402


def _where_clause(user_id: str | None) -> tuple[str, dict[str, object]]:
    clauses = [
        "(",
        "action = 'OPERATION_PERFORMED'",
        "OR (agent_id = 'self' AND scope = 'vault.owner')",
        ")",
    ]
    params: dict[str, object] = {}
    if user_id:
        clauses.append("AND user_id = :user_id")
        params["user_id"] = user_id
    return " ".join(clauses), params


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean legacy self/internal consent audit rows.")
    parser.add_argument(
        "--apply", action="store_true", help="Perform the delete instead of dry-run"
    )
    parser.add_argument("--user-id", help="Limit cleanup to a single user")
    args = parser.parse_args()

    where_sql, params = _where_clause(args.user_id)
    db = get_db()

    summary = db.execute_raw(
        f"""
        SELECT action, agent_id, user_id, COUNT(*) AS row_count
        FROM consent_audit
        WHERE {where_sql}
        GROUP BY action, agent_id, user_id
        ORDER BY row_count DESC, user_id ASC
        """,
        params,
    )

    overall = db.execute_raw(
        f"""
        SELECT COUNT(*) AS row_count
        FROM consent_audit
        WHERE {where_sql}
        """,
        params,
    )
    total = int((overall.data or [{"row_count": 0}])[0]["row_count"])

    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "total_rows": total}, indent=2))
    print()
    print("Rows by action / agent / user:")
    print(json.dumps(summary.data or [], indent=2))

    if not args.apply:
        print()
        print(
            "Dry run only. Re-run with --apply after verifying the new internal ledger writes are live."
        )
        return 0

    deleted = db.execute_raw(
        f"""
        DELETE FROM consent_audit
        WHERE {where_sql}
        """,
        params,
    )
    print()
    print(json.dumps({"deleted_rows": deleted.count or 0}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
