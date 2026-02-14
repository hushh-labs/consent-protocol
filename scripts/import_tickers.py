#!/usr/bin/env python3
"""consent-protocol/scripts/import_tickers.py

SEC Tickers Importer (batch upsert)
==================================

Downloads https://www.sec.gov/files/company_tickers.json (preferably via curl)
and upserts into the Postgres/Supabase `tickers` table in batches.

Why this exists:
- The SEC dataset is large; doing one giant upsert can be slow/fragile.
- Mobile UX needs fast ticker search backed by Supabase.

Usage:
  # 1) (recommended) download with curl
  curl -L "https://www.sec.gov/files/company_tickers.json" \
    -H "User-Agent: Hushh-Research/1.0 (eng@hush1one.com)" \
    -o /tmp/company_tickers.json

  # 2) import in batches of 500
  PYTHONPATH=. ./.venv/bin/python scripts/import_tickers.py --file /tmp/company_tickers.json --batch 500

If --file is omitted, the script will try to curl download into /tmp automatically.

Requires DB_* env vars in consent-protocol/.env.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

# NOTE:
# The Supabase Session Pooler can be slow for very large multi-value UPSERTs.
# We therefore stream inserts via psycopg2 (already in requirements) with
# execute_values for robust batching.
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

load_dotenv()

logger = logging.getLogger("import_tickers")
logging.basicConfig(level=logging.INFO)

SEC_URL = "https://www.sec.gov/files/company_tickers.json"
DEFAULT_OUTFILE = "/tmp/company_tickers.json"  # noqa: S108
DEFAULT_UA = "Hushh-Research/1.0 (eng@hush1one.com)"


def chunked(items: List[Dict[str, Any]], size: int) -> Iterable[List[Dict[str, Any]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def ensure_file(path: str, user_agent: str) -> str:
    """Ensure we have a local JSON file, downloading via curl if needed."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path

    logger.info("Downloading SEC tickers via curl → %s", path)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    cmd = [
        "curl",
        "-L",
        SEC_URL,
        "-H",
        f"User-Agent: {user_agent}",
        "-H",
        "Accept: application/json",
        "-o",
        path,
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)  # noqa: S603
    if result.returncode != 0:
        raise RuntimeError(
            f"curl failed (code={result.returncode}): {result.stderr.strip() or result.stdout.strip()}"
        )
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        raise RuntimeError("Downloaded file is missing/empty")
    return path


def parse_rows(data: Any) -> List[Dict[str, Any]]:
    """Transform SEC JSON into DB rows."""
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected SEC tickers format (expected dict)")

    rows: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for v in data.values():
        try:
            ticker = (v.get("ticker") or "").upper().strip()
            if not ticker:
                continue
            title = v.get("title")
            cik = v.get("cik_str")
            if cik is not None and cik != "":
                cik = str(cik).zfill(10)
            rows.append(
                {
                    "ticker": ticker,
                    "title": title,
                    "cik": cik,
                    "exchange": None,
                    "updated_at": now_iso,
                }
            )
        except Exception:
            continue

    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="", help="Path to downloaded company_tickers.json")
    parser.add_argument(
        "--out", default=DEFAULT_OUTFILE, help="Download path when --file not provided"
    )
    parser.add_argument("--batch", type=int, default=500, help="Batch size for upserts")
    parser.add_argument("--user-agent", default=DEFAULT_UA, help="SEC-compliant User-Agent")
    parser.add_argument("--sleep", type=float, default=0.0, help="Sleep seconds between batches")
    parser.add_argument("--max-retries", type=int, default=3, help="Retries per batch")
    args = parser.parse_args()

    path = args.file.strip() or args.out
    try:
        path = ensure_file(path, args.user_agent)
    except Exception as e:
        logger.error("Failed to get SEC file: %s", e)
        return 1

    logger.info("Loading JSON from %s", path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = parse_rows(data)
    logger.info("Prepared %d ticker rows", len(rows))
    if not rows:
        logger.error("No rows parsed; aborting")
        return 1

    # Connect directly to Postgres for fast batch upserts.
    # This uses the same DB_* env vars as runtime.
    db_host = os.environ.get("DB_HOST")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get("DB_PASSWORD")
    db_name = os.environ.get("DB_NAME", "postgres")
    db_port = int(os.environ.get("DB_PORT", "5432"))

    missing = [k for k in ["DB_HOST", "DB_USER", "DB_PASSWORD"] if not os.environ.get(k)]
    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        return 1

    logger.info("Connecting to Postgres %s:%s/%s (sslmode=require)", db_host, db_port, db_name)
    conn = None
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            dbname=db_name,
            sslmode="require",
        )
        conn.autocommit = False
    except Exception as e:
        logger.error("Failed to connect to Postgres: %s", e)
        return 1

    total = len(rows)
    done = 0
    batch_size = max(1, int(args.batch))

    upsert_sql = """
    INSERT INTO tickers (ticker, title, cik, exchange, updated_at)
    VALUES %s
    ON CONFLICT (ticker)
    DO UPDATE SET
      title = EXCLUDED.title,
      cik = EXCLUDED.cik,
      exchange = EXCLUDED.exchange,
      updated_at = EXCLUDED.updated_at
    """

    try:
        with conn.cursor() as cur:
            for idx, batch in enumerate(chunked(rows, batch_size), start=1):
                attempt = 0
                while True:
                    attempt += 1
                    try:
                        values = [
                            (
                                r.get("ticker"),
                                r.get("title"),
                                r.get("cik"),
                                r.get("exchange"),
                                r.get("updated_at"),
                            )
                            for r in batch
                        ]
                        execute_values(cur, upsert_sql, values, page_size=len(values))
                        conn.commit()
                        done += len(batch)
                        logger.info(
                            "Batch %d: upserted %d (progress %d/%d)", idx, len(batch), done, total
                        )
                        break
                    except Exception as e:
                        conn.rollback()
                        if attempt >= args.max_retries:
                            logger.error("Batch %d failed after %d attempts: %s", idx, attempt, e)
                            return 1
                        backoff = 1.5 * attempt
                        logger.warning(
                            "Batch %d failed (attempt %d): %s; retrying in %.1fs",
                            idx,
                            attempt,
                            e,
                            backoff,
                        )
                        time.sleep(backoff)

                if args.sleep and args.sleep > 0:
                    time.sleep(args.sleep)

        logger.info("Import complete: %d rows processed", done)
        return 0
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
