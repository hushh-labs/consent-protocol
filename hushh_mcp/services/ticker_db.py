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

_ENRICHED_COLUMNS = (
    "ticker,title,cik,exchange,sic_code,sic_description,"
    "sector_primary,industry_primary,sector_tags,metadata_confidence,tradable"
)
_LEGACY_COLUMNS = "ticker,title,cik,exchange"


def _normalize_ticker_row(row: Dict) -> Dict:
    return {
        "ticker": row.get("ticker"),
        "title": row.get("title"),
        "cik": row.get("cik"),
        "exchange": row.get("exchange"),
        "sic_code": row.get("sic_code"),
        "sic_description": row.get("sic_description"),
        "sector_primary": row.get("sector_primary"),
        "industry_primary": row.get("industry_primary"),
        "sector_tags": row.get("sector_tags") if isinstance(row.get("sector_tags"), list) else [],
        "metadata_confidence": row.get("metadata_confidence"),
        "tradable": row.get("tradable", True),
    }


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
        ticker_like = bool(re.fullmatch(r"[A-Za-z.]{1,8}", q_clean))
        pattern = f"{q_clean}%" if ticker_like else f"%{q_clean}%"
        field = "ticker" if ticker_like else "title"
        order_field = "ticker" if ticker_like else "title"

        try:
            res = (
                db.table("tickers")
                .select(_ENRICHED_COLUMNS)
                .ilike(field, pattern)
                .order(order_field)
                .limit(limit)
                .execute()
            )
            return [_normalize_ticker_row(row) for row in (res.data or [])]
        except Exception as exc:
            logger.warning(
                "[TickerDB] Enriched ticker columns unavailable, falling back to legacy columns: %s",
                exc,
            )
            legacy_res = (
                db.table("tickers")
                .select(_LEGACY_COLUMNS)
                .ilike(field, pattern)
                .order(order_field)
                .limit(limit)
                .execute()
            )
            return [_normalize_ticker_row(row) for row in (legacy_res.data or [])]

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
                    "sic_code": r.get("sic_code"),
                    "sic_description": r.get("sic_description"),
                    "sector_primary": r.get("sector_primary"),
                    "industry_primary": r.get("industry_primary"),
                    "sector_tags": r.get("sector_tags") or [],
                    "metadata_confidence": r.get("metadata_confidence") or 0.0,
                    "tradable": r.get("tradable", True),
                    "last_enriched_at": r.get("last_enriched_at"),
                    "updated_at": r.get("updated_at"),
                }
            )

        result = db.table("tickers").upsert(prepared, on_conflict="ticker").execute()
        return result.count or (len(result.data) if result.data else 0)
