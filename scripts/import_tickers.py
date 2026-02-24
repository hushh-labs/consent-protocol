#!/usr/bin/env python3
"""SEC bulk-first ticker importer (free path, no per-ticker API calls).

Pipeline
--------
1) Download SEC ticker-exchange seed file.
2) Download SEC submissions bulk zip.
3) Merge ticker/cik/exchange with SIC metadata.
4) Map SIC -> sector taxonomy.
5) Batch upsert into `tickers`.

Usage:
  PYTHONPATH=. python scripts/import_tickers.py --batch 2000
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)

logger = logging.getLogger("import_tickers")
logging.basicConfig(level=logging.INFO)

DEFAULT_UA = "Hushh-Research/1.0 (eng@hush1one.com)"
DEFAULT_CACHE_DIR = "/tmp/sec-bulk"  # noqa: S108
SEC_TICKERS_EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SEC_SUBMISSIONS_ZIP_URL = "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip"

_CIK_FILE_RE = re.compile(r"CIK(\d{10})\.json$", re.IGNORECASE)
_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,5}$")
_NON_TRADABLE = {
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
}

_SIC_RANGE_SECTORS: list[tuple[int, int, str]] = [
    (100, 999, "Materials"),
    (1000, 1499, "Energy"),
    (1500, 1799, "Industrials"),
    (2000, 2399, "Consumer Staples"),
    (2400, 2799, "Materials"),
    (2800, 2829, "Materials"),
    (2830, 2836, "Healthcare"),
    (2837, 2899, "Materials"),
    (2900, 2999, "Energy"),
    (3000, 3099, "Materials"),
    (3100, 3569, "Industrials"),
    (3570, 3579, "Technology"),
    (3580, 3699, "Industrials"),
    (3700, 3799, "Industrials"),
    (3800, 3899, "Healthcare"),
    (3900, 3999, "Consumer Discretionary"),
    (4000, 4899, "Industrials"),
    (4900, 4949, "Utilities"),
    (4950, 4999, "Industrials"),
    (5000, 5199, "Industrials"),
    (5200, 5999, "Consumer Discretionary"),
    (6000, 6799, "Financials"),
    (7000, 7999, "Consumer Discretionary"),
    (8000, 8999, "Healthcare"),
    (9100, 9729, "Industrials"),
    (9900, 9999, "Industrials"),
]

_SECTOR_KEYWORDS = {
    "technology": "Technology",
    "semiconductor": "Technology",
    "software": "Technology",
    "internet": "Technology",
    "telecom": "Communication Services",
    "communication": "Communication Services",
    "media": "Communication Services",
    "bank": "Financials",
    "financial": "Financials",
    "insurance": "Financials",
    "investment": "Financials",
    "pharma": "Healthcare",
    "biotech": "Healthcare",
    "medical": "Healthcare",
    "hospital": "Healthcare",
    "oil": "Energy",
    "gas": "Energy",
    "energy": "Energy",
    "retail": "Consumer Discretionary",
    "restaurant": "Consumer Discretionary",
    "apparel": "Consumer Discretionary",
    "motor vehicle": "Consumer Discretionary",
    "automobile": "Consumer Discretionary",
    "utility": "Utilities",
    "electric": "Utilities",
    "water": "Utilities",
    "steel": "Materials",
    "chemical": "Materials",
    "mining": "Materials",
    "transport": "Industrials",
    "aerospace": "Industrials",
    "defense": "Industrials",
    "manufacturing": "Industrials",
}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_cik(value: Any) -> str | None:
    text = _clean_text(value)
    if not text:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return None
    return digits.zfill(10)[:10]


def _normalize_ticker(value: Any) -> str:
    text = _clean_text(value).upper()
    sanitized = "".join(ch for ch in text if ch.isalnum() or ch in ".-")
    if not sanitized:
        return ""
    if sanitized in _NON_TRADABLE:
        return ""
    if not _TICKER_RE.fullmatch(sanitized):
        return ""
    return sanitized


def _is_tradable_ticker(ticker: str) -> bool:
    return bool(ticker and _TICKER_RE.fullmatch(ticker) and ticker not in _NON_TRADABLE)


def _normalize_industry(value: Any) -> str | None:
    text = _clean_text(value)
    return text[:120] if text else None


def _map_sic_to_sector(
    sic_code: str | None, sic_description: str | None, title: str | None
) -> str | None:
    for candidate in (sic_description, title):
        lower = _clean_text(candidate).lower()
        if not lower:
            continue
        for key, mapped in _SECTOR_KEYWORDS.items():
            if key in lower:
                return mapped

    if sic_code:
        try:
            sic_int = int(sic_code)
            for low, high, sector in _SIC_RANGE_SECTORS:
                if low <= sic_int <= high:
                    return sector
        except ValueError:
            pass
    return None


def _build_sector_tags(
    sector: str | None, industry: str | None, sic_description: str | None
) -> list[str]:
    out: list[str] = []
    for raw in (sector, industry, sic_description):
        text = _clean_text(raw)
        if text and text not in out:
            out.append(text)
    return out[:6]


def _confidence(
    *, has_exchange: bool, has_sic: bool, has_sector: bool, has_industry: bool
) -> float:
    score = 0.2
    if has_exchange:
        score += 0.2
    if has_sic:
        score += 0.3
    if has_sector:
        score += 0.2
    if has_industry:
        score += 0.1
    return min(1.0, round(score, 3))


def _ensure_download(url: str, out_path: Path, user_agent: str) -> Path:
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl",
        "-L",
        url,
        "-H",
        f"User-Agent: {user_agent}",
        "-H",
        "Accept: application/json",
        "-o",
        str(out_path),
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)  # noqa: S603
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or result.stdout.strip() or f"curl failed for {url}"
        )
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError(f"Downloaded empty file from {url}")
    return out_path


def _parse_exchange_file(path: Path, *, max_tickers: int = 0) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    fields = payload.get("fields") if isinstance(payload, dict) else None
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(fields, list) or not isinstance(data, list):
        raise RuntimeError("company_tickers_exchange.json format is invalid")

    idx = {str(name): i for i, name in enumerate(fields)}
    out: dict[str, dict[str, Any]] = {}

    for row in data:
        if not isinstance(row, list):
            continue
        ticker = _normalize_ticker(row[idx.get("ticker", -1)] if "ticker" in idx else None)
        if not ticker:
            continue
        cik = _normalize_cik(row[idx.get("cik", -1)] if "cik" in idx else None)
        title = _clean_text(row[idx.get("name", -1)] if "name" in idx else None) or ticker
        exchange = _clean_text(row[idx.get("exchange", -1)] if "exchange" in idx else None) or None
        out[ticker] = {"ticker": ticker, "cik": cik, "title": title, "exchange": exchange}
        if max_tickers > 0 and len(out) >= max_tickers:
            break

    return out


def _parse_submissions_zip(path: Path, *, cik_filter: set[str]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    with zipfile.ZipFile(path, "r") as archive:
        for name in archive.namelist():
            match = _CIK_FILE_RE.search(name)
            if not match:
                continue
            cik = match.group(1)
            if cik_filter and cik not in cik_filter:
                continue
            with archive.open(name, "r") as handle:
                payload = json.loads(handle.read().decode("utf-8", errors="ignore"))

            sic_code = _clean_text(payload.get("sic")) or None
            sic_description = _clean_text(payload.get("sicDescription")) or None
            tickers = payload.get("tickers") if isinstance(payload.get("tickers"), list) else []
            exchanges = (
                payload.get("exchanges") if isinstance(payload.get("exchanges"), list) else []
            )

            out[cik] = {
                "name": _clean_text(payload.get("name")) or None,
                "sic_code": sic_code,
                "sic_description": sic_description,
                "tickers": [t for t in (_normalize_ticker(v) for v in tickers) if t],
                "exchanges": [_clean_text(v) for v in exchanges if _clean_text(v)],
            }
    return out


def _build_rows(
    exchange_rows: dict[str, dict[str, Any]],
    submissions_by_cik: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    by_ticker: dict[str, dict[str, Any]] = {}
    cik_to_tickers: dict[str, set[str]] = {}

    for ticker, row in exchange_rows.items():
        cik = row.get("cik")
        if cik:
            cik_to_tickers.setdefault(cik, set()).add(ticker)
        by_ticker[ticker] = {
            "ticker": ticker,
            "title": row.get("title") or ticker,
            "cik": cik,
            "exchange": row.get("exchange"),
            "sic_code": None,
            "sic_description": None,
            "sector_primary": None,
            "industry_primary": None,
            "sector_tags": [],
            "metadata_confidence": 0.2,
            "tradable": _is_tradable_ticker(ticker),
            "last_enriched_at": None,
            "updated_at": now_iso,
        }

    for cik, sub in submissions_by_cik.items():
        candidate_tickers = set(cik_to_tickers.get(cik, set()))
        candidate_tickers.update(sub.get("tickers", []))

        for ticker in candidate_tickers:
            if ticker not in by_ticker:
                by_ticker[ticker] = {
                    "ticker": ticker,
                    "title": sub.get("name") or ticker,
                    "cik": cik,
                    "exchange": (sub.get("exchanges") or [None])[0],
                    "sic_code": None,
                    "sic_description": None,
                    "sector_primary": None,
                    "industry_primary": None,
                    "sector_tags": [],
                    "metadata_confidence": 0.2,
                    "tradable": _is_tradable_ticker(ticker),
                    "last_enriched_at": None,
                    "updated_at": now_iso,
                }

            row = by_ticker[ticker]
            row["cik"] = row.get("cik") or cik
            row["title"] = row.get("title") or sub.get("name") or ticker
            if not row.get("exchange") and sub.get("exchanges"):
                row["exchange"] = (sub.get("exchanges") or [None])[0]
            row["sic_code"] = sub.get("sic_code") or row.get("sic_code")
            row["sic_description"] = sub.get("sic_description") or row.get("sic_description")

    for row in by_ticker.values():
        sic_code = _clean_text(row.get("sic_code")) or None
        sic_description = _clean_text(row.get("sic_description")) or None
        title = _clean_text(row.get("title")) or None
        sector = _map_sic_to_sector(sic_code, sic_description, title)
        industry = _normalize_industry(sic_description)

        row["sector_primary"] = sector
        row["industry_primary"] = industry
        row["sector_tags"] = _build_sector_tags(sector, industry, sic_description)
        row["metadata_confidence"] = _confidence(
            has_exchange=bool(_clean_text(row.get("exchange"))),
            has_sic=bool(sic_code),
            has_sector=bool(sector),
            has_industry=bool(industry),
        )
        row["last_enriched_at"] = now_iso
        row["updated_at"] = now_iso

    return list(by_ticker.values())


def _connect_db() -> psycopg2.extensions.connection:
    required = ["DB_HOST", "DB_USER", "DB_PASSWORD"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing required DB env vars: {', '.join(missing)}")

    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        dbname=os.getenv("DB_NAME", "postgres"),
        sslmode="require",
    )


def _upsert_rows(
    conn: psycopg2.extensions.connection,
    rows: list[dict[str, Any]],
    *,
    batch_size: int,
    sleep_seconds: float,
    max_retries: int,
) -> int:
    upsert_sql = """
    INSERT INTO tickers (
      ticker, title, cik, exchange, sic_code, sic_description, sector_primary,
      industry_primary, sector_tags, metadata_confidence, tradable, last_enriched_at, updated_at
    )
    VALUES %s
    ON CONFLICT (ticker)
    DO UPDATE SET
      title = EXCLUDED.title,
      cik = EXCLUDED.cik,
      exchange = EXCLUDED.exchange,
      sic_code = COALESCE(EXCLUDED.sic_code, tickers.sic_code),
      sic_description = COALESCE(EXCLUDED.sic_description, tickers.sic_description),
      sector_primary = COALESCE(EXCLUDED.sector_primary, tickers.sector_primary),
      industry_primary = COALESCE(EXCLUDED.industry_primary, tickers.industry_primary),
      sector_tags = CASE
        WHEN EXCLUDED.sector_tags IS NULL OR cardinality(EXCLUDED.sector_tags) = 0 THEN tickers.sector_tags
        ELSE EXCLUDED.sector_tags
      END,
      metadata_confidence = GREATEST(
        COALESCE(tickers.metadata_confidence, 0),
        COALESCE(EXCLUDED.metadata_confidence, 0)
      ),
      tradable = COALESCE(EXCLUDED.tradable, tickers.tradable),
      last_enriched_at = COALESCE(EXCLUDED.last_enriched_at, tickers.last_enriched_at),
      updated_at = EXCLUDED.updated_at
    """

    total = len(rows)
    done = 0

    with conn.cursor() as cur:
        for idx in range(0, total, batch_size):
            batch = rows[idx : idx + batch_size]
            payload = [
                (
                    row.get("ticker"),
                    row.get("title"),
                    row.get("cik"),
                    row.get("exchange"),
                    row.get("sic_code"),
                    row.get("sic_description"),
                    row.get("sector_primary"),
                    row.get("industry_primary"),
                    row.get("sector_tags") or [],
                    float(row.get("metadata_confidence") or 0.0),
                    bool(row.get("tradable", True)),
                    row.get("last_enriched_at"),
                    row.get("updated_at"),
                )
                for row in batch
            ]

            attempt = 0
            while True:
                attempt += 1
                try:
                    execute_values(cur, upsert_sql, payload, page_size=len(payload))
                    conn.commit()
                    done += len(batch)
                    logger.info(
                        "Batch %d: upserted %d (progress %d/%d)",
                        (idx // batch_size) + 1,
                        len(batch),
                        done,
                        total,
                    )
                    break
                except Exception as exc:
                    conn.rollback()
                    if attempt >= max_retries:
                        raise RuntimeError(f"Batch failed after {attempt} attempts: {exc}") from exc
                    backoff = min(8.0, 1.5 * attempt)
                    logger.warning(
                        "Batch retry %d after error: %s (sleep %.1fs)",
                        attempt,
                        exc,
                        backoff,
                    )
                    time.sleep(backoff)

            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

    return done


def _print_post_upsert_summary(conn: psycopg2.extensions.connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              count(*) AS total,
              count(*) FILTER (WHERE exchange IS NOT NULL AND btrim(exchange) <> '') AS exchange_filled,
              count(*) FILTER (WHERE sector_primary IS NOT NULL AND btrim(sector_primary) <> '') AS sector_filled,
              count(*) FILTER (WHERE industry_primary IS NOT NULL AND btrim(industry_primary) <> '') AS industry_filled,
              count(*) FILTER (WHERE sic_code IS NOT NULL AND btrim(sic_code) <> '') AS sic_filled
            FROM tickers
            """
        )
        total, exchange_filled, sector_filled, industry_filled, sic_filled = cur.fetchone()

    total = int(total or 0)
    exchange_filled = int(exchange_filled or 0)
    sector_filled = int(sector_filled or 0)
    industry_filled = int(industry_filled or 0)
    sic_filled = int(sic_filled or 0)

    def pct(value: int) -> float:
        if total <= 0:
            return 0.0
        return round((value / total) * 100.0, 2)

    logger.info(
        "Coverage summary: total=%d exchange=%d(%.2f%%) sic=%d(%.2f%%) sector=%d(%.2f%%) industry=%d(%.2f%%)",
        total,
        exchange_filled,
        pct(exchange_filled),
        sic_filled,
        pct(sic_filled),
        sector_filled,
        pct(sector_filled),
        industry_filled,
        pct(industry_filled),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Import SEC bulk ticker metadata in batches")
    parser.add_argument("--batch", type=int, default=2000, help="DB upsert batch size")
    parser.add_argument("--sleep", type=float, default=0.0, help="Sleep between DB batches")
    parser.add_argument("--max-retries", type=int, default=3, help="Retries per failed DB batch")
    parser.add_argument("--user-agent", type=str, default=DEFAULT_UA)
    parser.add_argument("--cache-dir", type=str, default=DEFAULT_CACHE_DIR)
    parser.add_argument(
        "--exchange-file", type=str, default="", help="Optional local company_tickers_exchange.json"
    )
    parser.add_argument(
        "--submissions-zip", type=str, default="", help="Optional local submissions.zip"
    )
    parser.add_argument("--max-tickers", type=int, default=0, help="Optional debug limiter")
    args = parser.parse_args()

    cache_dir = Path(args.cache_dir).expanduser().resolve()
    exchange_path = (
        Path(args.exchange_file).expanduser().resolve()
        if args.exchange_file.strip()
        else cache_dir / "company_tickers_exchange.json"
    )
    submissions_path = (
        Path(args.submissions_zip).expanduser().resolve()
        if args.submissions_zip.strip()
        else cache_dir / "submissions.zip"
    )

    try:
        exchange_path = _ensure_download(SEC_TICKERS_EXCHANGE_URL, exchange_path, args.user_agent)
        submissions_path = _ensure_download(
            SEC_SUBMISSIONS_ZIP_URL, submissions_path, args.user_agent
        )
    except Exception as exc:
        logger.error("SEC download failed: %s", exc)
        return 1

    try:
        exchange_rows = _parse_exchange_file(
            exchange_path, max_tickers=max(0, int(args.max_tickers))
        )
        cik_filter = {row.get("cik") for row in exchange_rows.values() if row.get("cik")}
        submissions_by_cik = _parse_submissions_zip(submissions_path, cik_filter=cik_filter)
        merged_rows = _build_rows(exchange_rows, submissions_by_cik)
    except Exception as exc:
        logger.error("SEC parse/merge failed: %s", exc)
        return 1

    if not merged_rows:
        logger.error("No rows built from SEC payloads")
        return 1

    logger.info(
        "Prepared %d rows from exchange seeds=%d and submissions=%d",
        len(merged_rows),
        len(exchange_rows),
        len(submissions_by_cik),
    )

    conn = None
    try:
        conn = _connect_db()
        conn.autocommit = False
        processed = _upsert_rows(
            conn,
            merged_rows,
            batch_size=max(1, int(args.batch)),
            sleep_seconds=max(0.0, float(args.sleep)),
            max_retries=max(1, int(args.max_retries)),
        )
        logger.info("Import complete: %d rows upserted", processed)
        _print_post_upsert_summary(conn)
        return 0
    except Exception as exc:
        logger.error("Import failed: %s", exc)
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
