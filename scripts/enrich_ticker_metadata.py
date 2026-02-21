#!/usr/bin/env python3
"""Enrich ticker metadata with SEC + provider sector intelligence.

Usage:
  PYTHONPATH=. ./.venv/bin/python scripts/enrich_ticker_metadata.py --limit 500
"""

from __future__ import annotations

import argparse
import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

load_dotenv()

SEC_HEADERS = {"User-Agent": "Hushh-Research/1.0 (eng@hush1one.com)"}

NON_TRADABLE_SYMBOLS = {
    "BUY",
    "SELL",
    "REINVEST",
    "DIVIDEND",
    "INTEREST",
    "TRANSFER",
    "WITHDRAWAL",
    "DEPOSIT",
}

SECTOR_KEYWORDS = {
    "technology": "Technology",
    "semiconductor": "Technology",
    "software": "Technology",
    "bank": "Financials",
    "insurance": "Financials",
    "health": "Healthcare",
    "pharma": "Healthcare",
    "energy": "Energy",
    "oil": "Energy",
    "consumer": "Consumer Discretionary",
    "retail": "Consumer Discretionary",
    "telecom": "Communication Services",
    "communication": "Communication Services",
    "industrial": "Industrials",
    "real estate": "Real Estate",
    "utility": "Utilities",
    "material": "Materials",
}


@dataclass
class TickerSeed:
    ticker: str
    cik: Optional[str]


@dataclass
class TickerEnriched:
    ticker: str
    sic_code: Optional[str]
    sic_description: Optional[str]
    sector_primary: Optional[str]
    industry_primary: Optional[str]
    sector_tags: list[str]
    metadata_confidence: float
    tradable: bool
    last_enriched_at: str
    exchange: Optional[str]


def normalize_sector(value: Optional[str]) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    lower = text.lower()
    for key, normalized in SECTOR_KEYWORDS.items():
        if key in lower:
            return normalized
    return text[:80]


def confidence_score(*, has_sic: bool, has_sector: bool, has_industry: bool) -> float:
    score = 0.2
    if has_sic:
        score += 0.25
    if has_sector:
        score += 0.35
    if has_industry:
        score += 0.2
    return min(1.0, round(score, 3))


async def fetch_sec_submission(client: httpx.AsyncClient, cik: Optional[str]) -> dict[str, Any]:
    if not cik:
        return {}
    padded = str(cik).zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded}.json"
    res = await client.get(url, headers=SEC_HEADERS)
    if not res.is_success:
        return {}
    return res.json() or {}


async def fetch_finnhub_profile(
    client: httpx.AsyncClient, ticker: str, finnhub_key: str
) -> dict[str, Any]:
    if not finnhub_key:
        return {}
    res = await client.get(
        "https://finnhub.io/api/v1/stock/profile2",
        params={"symbol": ticker, "token": finnhub_key},
    )
    if not res.is_success:
        return {}
    return res.json() or {}


async def fetch_fmp_profile(client: httpx.AsyncClient, ticker: str, pmp_key: str) -> dict[str, Any]:
    if not pmp_key:
        return {}
    res = await client.get(
        "https://financialmodelingprep.com/stable/profile",
        params={"symbol": ticker, "apikey": pmp_key},
    )
    if not res.is_success:
        return {}
    payload = res.json() or []
    if isinstance(payload, list) and payload:
        return payload[0] or {}
    return {}


def build_sector_tags(
    *,
    sector_primary: Optional[str],
    industry_primary: Optional[str],
    sic_description: Optional[str],
) -> list[str]:
    out: list[str] = []
    for raw in (sector_primary, industry_primary, sic_description):
        text = str(raw or "").strip()
        if not text:
            continue
        if text not in out:
            out.append(text)
    return out[:6]


async def enrich_one(
    seed: TickerSeed,
    *,
    client: httpx.AsyncClient,
    finnhub_key: str,
    pmp_key: str,
    semaphore: asyncio.Semaphore,
) -> TickerEnriched:
    async with semaphore:
        sec_payload, finnhub_profile, fmp_profile = await asyncio.gather(
            fetch_sec_submission(client, seed.cik),
            fetch_finnhub_profile(client, seed.ticker, finnhub_key),
            fetch_fmp_profile(client, seed.ticker, pmp_key),
        )

    sic_code = str(sec_payload.get("sic") or "").strip() or None
    sic_description = str(sec_payload.get("sicDescription") or "").strip() or None
    sector_raw = (
        str(fmp_profile.get("sector") or "").strip()
        or str(finnhub_profile.get("finnhubIndustry") or "").strip()
        or sic_description
    )
    industry_raw = (
        str(fmp_profile.get("industry") or "").strip()
        or str(finnhub_profile.get("finnhubIndustry") or "").strip()
    )
    sector_primary = normalize_sector(sector_raw)
    industry_primary = industry_raw[:120] if industry_raw else None
    sector_tags = build_sector_tags(
        sector_primary=sector_primary,
        industry_primary=industry_primary,
        sic_description=sic_description,
    )
    confidence = confidence_score(
        has_sic=bool(sic_code or sic_description),
        has_sector=bool(sector_primary),
        has_industry=bool(industry_primary),
    )
    tradable = seed.ticker not in NON_TRADABLE_SYMBOLS
    exchange = (
        str(fmp_profile.get("exchangeShortName") or "").strip()
        or str(finnhub_profile.get("exchange") or "").strip()
        or None
    )

    return TickerEnriched(
        ticker=seed.ticker,
        sic_code=sic_code,
        sic_description=sic_description,
        sector_primary=sector_primary,
        industry_primary=industry_primary,
        sector_tags=sector_tags,
        metadata_confidence=confidence,
        tradable=tradable,
        last_enriched_at=datetime.now(timezone.utc).isoformat(),
        exchange=exchange,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--symbols", type=str, default="")
    parser.add_argument("--concurrency", type=int, default=6)
    return parser.parse_args()


def get_db_conn():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        dbname=os.environ.get("DB_NAME", "postgres"),
        sslmode="require",
    )


def read_seed_rows(conn, *, limit: int, symbols: list[str]) -> list[TickerSeed]:
    with conn.cursor() as cur:
        if symbols:
            cur.execute(
                """
                SELECT ticker, cik
                FROM tickers
                WHERE ticker = ANY(%s)
                ORDER BY ticker
                """,
                (symbols,),
            )
        else:
            cur.execute(
                """
                SELECT ticker, cik
                FROM tickers
                ORDER BY COALESCE(last_enriched_at, to_timestamp(0)) ASC, ticker
                LIMIT %s
                """,
                (max(1, limit),),
            )
        rows = cur.fetchall()

    out = []
    for ticker, cik in rows:
        text = str(ticker or "").strip().upper()
        if not text:
            continue
        out.append(TickerSeed(ticker=text, cik=str(cik).strip() if cik else None))
    return out


def upsert_enriched_rows(conn, rows: list[TickerEnriched]) -> int:
    if not rows:
        return 0
    payload = [
        (
            r.ticker,
            r.sic_code,
            r.sic_description,
            r.sector_primary,
            r.industry_primary,
            r.sector_tags,
            r.metadata_confidence,
            r.tradable,
            r.last_enriched_at,
            r.exchange,
        )
        for r in rows
    ]
    sql = """
    UPDATE tickers AS t
    SET
      sic_code = v.sic_code,
      sic_description = v.sic_description,
      sector_primary = v.sector_primary,
      industry_primary = v.industry_primary,
      sector_tags = v.sector_tags,
      metadata_confidence = v.metadata_confidence,
      tradable = v.tradable,
      last_enriched_at = v.last_enriched_at::timestamptz,
      exchange = COALESCE(v.exchange, t.exchange),
      updated_at = NOW()
    FROM (VALUES %s) AS v(
      ticker, sic_code, sic_description, sector_primary, industry_primary,
      sector_tags, metadata_confidence, tradable, last_enriched_at, exchange
    )
    WHERE t.ticker = v.ticker
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, payload, page_size=200)
    conn.commit()
    return len(rows)


async def run() -> int:
    args = parse_args()
    finnhub_key = (os.getenv("FINNHUB_API_KEY") or "").strip()
    pmp_key = (os.getenv("PMP_API_KEY") or os.getenv("FMP_API_KEY") or "").strip()
    symbols = [s.strip().upper() for s in (args.symbols or "").split(",") if s.strip()]

    conn = get_db_conn()
    try:
        seeds = read_seed_rows(conn, limit=args.limit, symbols=symbols)
        if not seeds:
            print("No ticker rows selected.")
            return 0

        timeout = httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=4.0)
        semaphore = asyncio.Semaphore(max(1, args.concurrency))
        async with httpx.AsyncClient(timeout=timeout) as client:
            results = await asyncio.gather(
                *[
                    enrich_one(
                        seed,
                        client=client,
                        finnhub_key=finnhub_key,
                        pmp_key=pmp_key,
                        semaphore=semaphore,
                    )
                    for seed in seeds
                ]
            )
        updated = upsert_enriched_rows(conn, results)
        print(f"Enriched ticker rows: {updated}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
