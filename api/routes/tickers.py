"""
Ticker search routes (public)

GET /api/tickers/search?q=...&limit=10
"""

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query

from hushh_mcp.services.ticker_db import TickerDBService
from hushh_mcp.services.ticker_cache import ticker_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tickers", tags=["Tickers (Public)"])


@router.get("/search", response_model=List[dict])
async def search_tickers(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=100)):
    """Search for tickers by symbol prefix or company name."""
    try:
        # Serve from memory when available.
        if ticker_cache.loaded:
            return ticker_cache.search(q, limit=limit)

        # Startup race fallback: hit DB directly.
        service = TickerDBService()
        results = await service.search_tickers(q, limit=limit)
        return results
    except Exception as e:
        logger.error(f"Error searching tickers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=List[dict])
async def all_tickers():
    """Return the full ticker universe (cached in memory when available)."""
    try:
        if not ticker_cache.loaded:
            # Load once per process if not already loaded.
            ticker_cache.load_from_db()

        return ticker_cache.all()
    except Exception as e:
        logger.error(f"Error returning all tickers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-status")
async def ticker_cache_status():
    """Debug endpoint: confirms cache size and load time."""
    return {
        "loaded": ticker_cache.loaded,
        "size": ticker_cache.size(),
        "loaded_at": ticker_cache.loaded_at,
    }
