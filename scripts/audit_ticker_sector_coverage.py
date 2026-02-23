#!/usr/bin/env python3
"""One-shot audit for ticker sector/industry metadata coverage.

Usage:
  python3 consent-protocol/scripts/audit_ticker_sector_coverage.py
  python3 consent-protocol/scripts/audit_ticker_sector_coverage.py --json-out temp/ticker-sector-audit.json
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv

NON_TRADABLE_TOKENS = (
    "BUY",
    "SELL",
    "REINVEST",
    "DIVIDEND",
    "INTEREST",
    "TRANSFER",
    "WITHDRAWAL",
    "DEPOSIT",
    "CASH",
    "QACDS",
    "MMF",
    "SWEEP",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit ticker sector metadata coverage")
    parser.add_argument("--json-out", default="", help="Optional path to save JSON report")
    return parser.parse_args()


def get_conn():
    load_dotenv("consent-protocol/.env")
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        dbname=os.environ.get("DB_NAME", "postgres"),
        sslmode="require",
    )


def fetch_one(cur, query: str, params: tuple[Any, ...] = ()) -> tuple[Any, ...]:
    cur.execute(query, params)
    row = cur.fetchone()
    return row or tuple()


def fetch_all(cur, query: str, params: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
    cur.execute(query, params)
    return cur.fetchall() or []


def build_report() -> dict[str, Any]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            total, sector_filled, industry_filled, both_filled, tradable_true, non_tradable = (
                fetch_one(
                    cur,
                    """
                SELECT
                  count(*) AS total,
                  count(*) FILTER (WHERE sector_primary IS NOT NULL AND btrim(sector_primary) <> '') AS sector_filled,
                  count(*) FILTER (WHERE industry_primary IS NOT NULL AND btrim(industry_primary) <> '') AS industry_filled,
                  count(*) FILTER (
                    WHERE sector_primary IS NOT NULL AND btrim(sector_primary) <> ''
                      AND industry_primary IS NOT NULL AND btrim(industry_primary) <> ''
                  ) AS both_filled,
                  count(*) FILTER (WHERE tradable IS TRUE) AS tradable_true,
                  count(*) FILTER (WHERE tradable IS FALSE) AS non_tradable
                FROM public.tickers
                """,
                )
            )

            missing_sector = total - sector_filled
            missing_industry = total - industry_filled

            null_reason_counts = fetch_one(
                cur,
                """
                SELECT
                  count(*) FILTER (
                    WHERE (sector_primary IS NULL OR btrim(sector_primary) = '')
                      AND (exchange IS NULL OR btrim(exchange) = '')
                  ) AS missing_sector_and_exchange,
                  count(*) FILTER (
                    WHERE (sector_primary IS NULL OR btrim(sector_primary) = '')
                      AND (sic_code IS NULL OR btrim(sic_code) = '')
                  ) AS missing_sector_and_sic,
                  count(*) FILTER (
                    WHERE (sector_primary IS NULL OR btrim(sector_primary) = '')
                      AND (metadata_confidence IS NULL OR metadata_confidence <= 0.0)
                  ) AS missing_sector_low_confidence,
                  count(*) FILTER (
                    WHERE (sector_primary IS NULL OR btrim(sector_primary) = '')
                      AND tradable IS FALSE
                  ) AS missing_sector_non_tradable
                FROM public.tickers
                """,
            )

            exchange_missing = fetch_all(
                cur,
                """
                SELECT COALESCE(NULLIF(btrim(exchange), ''), '(null)') AS exchange_bucket, count(*) AS cnt
                FROM public.tickers
                WHERE sector_primary IS NULL OR btrim(sector_primary) = ''
                GROUP BY 1
                ORDER BY cnt DESC
                LIMIT 12
                """,
            )

            top_sector = fetch_all(
                cur,
                """
                SELECT COALESCE(NULLIF(btrim(sector_primary), ''), 'Unclassified') AS sector_bucket, count(*) AS cnt
                FROM public.tickers
                GROUP BY 1
                ORDER BY cnt DESC
                LIMIT 12
                """,
            )

            action_like_count = fetch_one(
                cur,
                """
                SELECT count(*) FROM public.tickers
                WHERE ticker = ANY(%s)
                """,
                (list(NON_TRADABLE_TOKENS),),
            )[0]

            non_standard_pattern_count = fetch_one(
                cur,
                """
                SELECT count(*) FROM public.tickers
                WHERE ticker !~ '^[A-Z][A-Z0-9.\\-]{0,5}$'
                """,
            )[0]

            missing_sector_examples = fetch_all(
                cur,
                """
                SELECT ticker, title, exchange, tradable, metadata_confidence
                FROM public.tickers
                WHERE sector_primary IS NULL OR btrim(sector_primary) = ''
                ORDER BY ticker
                LIMIT 30
                """,
            )

            return {
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "table": "public.tickers",
                "summary": {
                    "total_tickers": int(total),
                    "sector_filled": int(sector_filled),
                    "industry_filled": int(industry_filled),
                    "both_filled": int(both_filled),
                    "sector_coverage_pct": round((sector_filled / total) * 100, 2)
                    if total
                    else 0.0,
                    "industry_coverage_pct": round((industry_filled / total) * 100, 2)
                    if total
                    else 0.0,
                    "missing_sector_count": int(missing_sector),
                    "missing_industry_count": int(missing_industry),
                    "tradable_true_count": int(tradable_true),
                    "non_tradable_count": int(non_tradable),
                },
                "null_reason_counts": {
                    "missing_sector_and_exchange": int(null_reason_counts[0]),
                    "missing_sector_and_sic": int(null_reason_counts[1]),
                    "missing_sector_low_confidence": int(null_reason_counts[2]),
                    "missing_sector_non_tradable": int(null_reason_counts[3]),
                },
                "non_tradable_signal_counts": {
                    "action_like_token_rows": int(action_like_count),
                    "non_standard_ticker_pattern_rows": int(non_standard_pattern_count),
                },
                "top_exchange_buckets_for_missing_sector": [
                    {"exchange": str(row[0]), "count": int(row[1])} for row in exchange_missing
                ],
                "top_sector_buckets": [
                    {"sector": str(row[0]), "count": int(row[1])} for row in top_sector
                ],
                "missing_sector_examples": [
                    {
                        "ticker": str(row[0]),
                        "title": str(row[1] or ""),
                        "exchange": str(row[2] or ""),
                        "tradable": bool(row[3]) if row[3] is not None else None,
                        "metadata_confidence": float(row[4] or 0.0),
                    }
                    for row in missing_sector_examples
                ],
            }
    finally:
        conn.close()


def main() -> int:
    args = parse_args()
    report = build_report()
    text = json.dumps(report, indent=2)
    print(text)

    if args.json_out:
        out = Path(args.json_out).expanduser().resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
