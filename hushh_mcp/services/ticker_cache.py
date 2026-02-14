"""In-memory ticker cache (server-side)

Goal
----
Avoid hitting Supabase/Postgres for every keystroke in the ticker dropdown.
We preload tickers into memory on FastAPI startup and serve searches from RAM.

Design
------
- Cache is process-local (per worker). This is fine for API latency + cost.
- On cold start, load from DB once.
- Provide a cheap search:
  - ticker prefix search for ticker-like inputs
  - substring search for title inputs
  - results capped by limit

If cache is empty (startup race), routes can fall back to DB.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

from hushh_mcp.services.ticker_db import TickerDBService

logger = logging.getLogger(__name__)


@dataclass
class TickerRow:
    ticker: str
    title: str
    cik: Optional[str] = None
    exchange: Optional[str] = None


class TickerCache:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._loaded_at: float = 0.0
        self._rows: List[TickerRow] = []

    def all(self) -> List[dict]:
        """Return all cached tickers as plain dicts."""
        with self._lock:
            return [
                {
                    "ticker": row.ticker,
                    "title": row.title,
                    "cik": row.cik,
                    "exchange": row.exchange,
                }
                for row in self._rows
            ]

    @property
    def loaded(self) -> bool:
        return bool(self._rows)

    @property
    def loaded_at(self) -> float:
        return self._loaded_at

    def size(self) -> int:
        return len(self._rows)

    def load_from_db(self) -> int:
        """Load all tickers from DB into memory."""
        t0 = time.time()
        svc = TickerDBService()
        db = svc._get_db()

        res = (
            db.table("tickers")
            .select("ticker,title,cik,exchange")
            .order("ticker")
            .execute()
        )
        data = res.data or []

        rows: List[TickerRow] = []
        for r in data:
            try:
                ticker = (r.get("ticker") or "").upper().strip()
                if not ticker:
                    continue
                rows.append(
                    TickerRow(
                        ticker=ticker,
                        title=(r.get("title") or ""),
                        cik=r.get("cik"),
                        exchange=r.get("exchange"),
                    )
                )
            except Exception:
                continue

        with self._lock:
            self._rows = rows
            self._loaded_at = time.time()

        logger.info("[TickerCache] Loaded %d tickers in %.2fs", len(rows), time.time() - t0)
        return len(rows)

    def search(self, q: str, limit: int = 10) -> List[dict]:
        q_clean = (q or "").strip()
        if not q_clean:
            return []

        limit = max(1, min(int(limit), 100))
        q_upper = q_clean.upper()

        # Heuristic: ticker-like => prefix match on ticker
        if re.fullmatch(r"[A-Za-z.]{1,8}", q_clean):
            out: List[dict] = []
            with self._lock:
                for row in self._rows:
                    if row.ticker.startswith(q_upper):
                        out.append(
                            {
                                "ticker": row.ticker,
                                "title": row.title,
                                "cik": row.cik,
                                "exchange": row.exchange,
                            }
                        )
                        if len(out) >= limit:
                            break
            return out

        # Otherwise: substring match in title (case-insensitive)
        q_lower = q_clean.lower()
        out = []
        with self._lock:
            for row in self._rows:
                if q_lower in (row.title or "").lower():
                    out.append(
                        {
                            "ticker": row.ticker,
                            "title": row.title,
                            "cik": row.cik,
                            "exchange": row.exchange,
                        }
                    )
                    if len(out) >= limit:
                        break
        return out


# Singleton per-process cache
ticker_cache = TickerCache()
