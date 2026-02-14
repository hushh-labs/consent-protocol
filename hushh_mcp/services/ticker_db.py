"""
Ticker Database Service
=======================

Simple service to search and upsert public tickers (imported from SEC company_tickers.json).

Public search endpoints should use this service (no consent required).
"""

import logging
import re
from typing import Dict, List

from db.db_client import get_db

logger = logging.getLogger(__name__)


class TickerDBService:
    def __init__(self):
        self._db = None

    def _get_db(self):
        if self._db is None:
            self._db = get_db()
        return self._db

    async def search_tickers(self, q: str, limit: int = 10) -> List[Dict]:
        """
        Search tickers by prefix match on ticker symbol or fuzzy match on company title.

        Args:
            q: query string (ticker or company name)
            limit: max results
        Returns:
            List of tickers: { ticker, title, cik, exchange }
        """
        db = self._get_db()

        q_clean = q.strip()
        if not q_clean:
            return []

        # If looks like a ticker (alphanumeric short), prefer ticker prefix search
        if re.fullmatch(r"[A-Za-z.]{1,8}", q_clean):
            pattern = f"{q_clean}%"
            res = (
                db.table("tickers")
                .select("ticker,title,cik,exchange")
                .ilike("ticker", pattern)
                .order("ticker")
                .limit(limit)
                .execute()
            )
            return res.data or []

        # Fallback: search in title
        pattern = f"%{q_clean}%"
        res = (
            db.table("tickers")
            .select("ticker,title,cik,exchange")
            .ilike("title", pattern)
            .order("title")
            .limit(limit)
            .execute()
        )
        return res.data or []

    async def upsert_tickers_bulk(self, rows: List[Dict]) -> int:
        """Upsert a list of ticker rows. Returns count upserted."""
        if not rows:
            return 0

        db = self._get_db()
        # Ensure keys align: ticker, title, cik, exchange, updated_at
        prepared = []
        for r in rows:
            prepared.append(
                {
                    "ticker": (r.get("ticker") or "").upper(),
                    "title": r.get("title"),
                    "cik": r.get("cik"),
                    "exchange": r.get("exchange"),
                    "updated_at": r.get("updated_at"),
                }
            )

        result = db.table("tickers").upsert(prepared, on_conflict="ticker").execute()
        return result.count or (len(result.data) if result.data else 0)
