"""Server-side in-memory cache for Kai market insights.

This cache is intentionally process-local and non-persistent.
It provides:
- short TTL freshness checks,
- stale-on-error fallback windows,
- per-key in-flight dedupe via async locks.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable


@dataclass
class CacheEntry:
    value: Any
    fetched_at: float


@dataclass
class CacheResult:
    value: Any
    stale: bool
    age_seconds: int


class MarketInsightsCache:
    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}
        self._series: dict[str, list[tuple[float, float]]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._provider_cooldowns: dict[str, float] = {}
        self._registry_lock = threading.RLock()

    def _get_lock(self, key: str) -> asyncio.Lock:
        with self._registry_lock:
            lock = self._locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[key] = lock
            return lock

    def _get_entry(self, key: str) -> CacheEntry | None:
        with self._registry_lock:
            return self._entries.get(key)

    def _set_entry(self, key: str, value: Any, fetched_at: float) -> None:
        with self._registry_lock:
            self._entries[key] = CacheEntry(value=value, fetched_at=fetched_at)

    def peek(self, key: str) -> CacheEntry | None:
        with self._registry_lock:
            return self._entries.get(key)

    def seed_entry(self, key: str, value: Any, fetched_at: float) -> None:
        """Seed an entry from external cache tier (e.g., Postgres L2)."""
        self._set_entry(key, value, fetched_at)

    def append_series_point(
        self,
        key: str,
        value: float,
        *,
        timestamp: float | None = None,
        max_points: int = 120,
    ) -> None:
        if max_points <= 0:
            return
        ts = timestamp or time.time()
        with self._registry_lock:
            series = self._series.setdefault(key, [])
            series.append((ts, float(value)))
            if len(series) > max_points:
                del series[: len(series) - max_points]

    def get_series_points(
        self,
        key: str,
        *,
        max_age_seconds: int = 86_400,
    ) -> list[tuple[float, float]]:
        now = time.time()
        with self._registry_lock:
            points = list(self._series.get(key, []))
        if max_age_seconds <= 0:
            return points
        cutoff = now - max_age_seconds
        filtered = [(ts, value) for ts, value in points if ts >= cutoff]
        if len(filtered) != len(points):
            with self._registry_lock:
                self._series[key] = filtered
        return filtered

    def mark_provider_cooldown(self, key: str, cooldown_seconds: int) -> None:
        if cooldown_seconds <= 0:
            return
        with self._registry_lock:
            self._provider_cooldowns[key] = time.time() + cooldown_seconds

    def is_provider_in_cooldown(self, key: str) -> bool:
        now = time.time()
        with self._registry_lock:
            until = self._provider_cooldowns.get(key)
            if until is None:
                return False
            if until <= now:
                self._provider_cooldowns.pop(key, None)
                return False
            return True

    def provider_cooldown_snapshot(self) -> dict[str, int]:
        """Return active provider cooldowns in remaining seconds."""
        now = time.time()
        out: dict[str, int] = {}
        with self._registry_lock:
            expired: list[str] = []
            for key, until in self._provider_cooldowns.items():
                if until <= now:
                    expired.append(key)
                    continue
                out[key] = max(1, int(until - now))
            for key in expired:
                self._provider_cooldowns.pop(key, None)
        return out

    async def get_or_refresh(
        self,
        key: str,
        *,
        fresh_ttl_seconds: int,
        stale_ttl_seconds: int,
        fetcher: Callable[[], Awaitable[Any]],
    ) -> CacheResult:
        now = time.time()
        existing = self._get_entry(key)
        if existing and (now - existing.fetched_at) <= fresh_ttl_seconds:
            return CacheResult(
                value=existing.value,
                stale=False,
                age_seconds=max(0, int(now - existing.fetched_at)),
            )

        lock = self._get_lock(key)
        async with lock:
            now = time.time()
            existing = self._get_entry(key)
            if existing and (now - existing.fetched_at) <= fresh_ttl_seconds:
                return CacheResult(
                    value=existing.value,
                    stale=False,
                    age_seconds=max(0, int(now - existing.fetched_at)),
                )

            try:
                value = await fetcher()
                fetched_at = time.time()
                self._set_entry(key, value, fetched_at)
                return CacheResult(value=value, stale=False, age_seconds=0)
            except Exception:
                now = time.time()
                fallback = self._get_entry(key)
                if fallback and (now - fallback.fetched_at) <= stale_ttl_seconds:
                    return CacheResult(
                        value=fallback.value,
                        stale=True,
                        age_seconds=max(0, int(now - fallback.fetched_at)),
                    )
                raise


market_insights_cache = MarketInsightsCache()
