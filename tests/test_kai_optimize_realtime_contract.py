"""Realtime dependency contract tests for optimize portfolio context builder."""

from __future__ import annotations

import pytest

from api.routes.kai.losers import (
    AnalyzeLosersRequest,
    PortfolioLoser,
    _build_optimization_context,
)
from hushh_mcp.operons.kai.fetchers import RealtimeDataUnavailable


class _FakeRenaissanceService:
    async def get_screening_context(self) -> str:
        return "context"

    async def get_screening_criteria(self):
        return [{"id": "R1", "title": "Rule 1"}]

    async def get_all_investable(self):
        class _Stock:
            ticker = "MSFT"
            tier = "KING"
            sector = "Technology"
            investment_thesis = "Quality compounder"
            company_name = "Microsoft"

        return [_Stock()]

    async def get_analysis_context(self, ticker: str):
        return {
            "is_investable": ticker == "AAPL",
            "tier": "ACE" if ticker == "AAPL" else "QUEEN",
            "tier_description": "tier description",
            "investment_thesis": "thesis",
            "fcf_billions": 12.3,
            "conviction_weight": 1.0,
            "is_avoid": False,
            "avoid_category": None,
            "avoid_reason": None,
            "avoid_source": None,
        }


@pytest.mark.asyncio
async def test_build_optimization_context_includes_realtime_payload(monkeypatch):
    import api.routes.kai.losers as losers_module

    monkeypatch.setattr(losers_module, "get_renaissance_service", lambda: _FakeRenaissanceService())

    async def _fake_fetch_market_data(ticker: str, user_id: str, consent_token: str):
        assert ticker == "AAPL"
        assert user_id == "user_1"
        assert consent_token == "vault_owner_token"  # noqa: S105 - Test fixture token only.
        return {
            "provider": "unit_test_quote",
            "fetched_at": "2026-02-20T00:00:00Z",
            "ttl_seconds": 60,
            "is_stale": False,
            "quote": {
                "price": 201.25,
                "change_pct": 1.48,
            },
        }

    monkeypatch.setattr(losers_module, "fetch_market_data", _fake_fetch_market_data)

    request = AnalyzeLosersRequest(
        user_id="user_1",
        losers=[PortfolioLoser(symbol="AAPL", market_value=1000.0, gain_loss_pct=-8.0)],
    )

    (
        losers_filtered,
        _criteria_context,
        _criteria_rows,
        _replacement_pool,
        per_loser_context,
        _optimize_from_losers,
        _total_mv,
    ) = await _build_optimization_context(
        request=request,
        user_id="user_1",
        consent_token="vault_owner_token",  # noqa: S106 - Test fixture token only.
    )

    assert len(losers_filtered) == 1
    assert len(per_loser_context) == 1
    assert per_loser_context[0]["symbol"] == "AAPL"
    assert per_loser_context[0]["realtime"]["price"] == 201.25
    assert per_loser_context[0]["realtime"]["source"] == "unit_test_quote"
    assert per_loser_context[0]["renaissance"]["tier"] == "ACE"


@pytest.mark.asyncio
async def test_build_optimization_context_fails_closed_when_realtime_missing(monkeypatch):
    import api.routes.kai.losers as losers_module

    monkeypatch.setattr(losers_module, "get_renaissance_service", lambda: _FakeRenaissanceService())

    async def _failing_fetch_market_data(ticker: str, user_id: str, consent_token: str):
        raise RealtimeDataUnavailable("market_data", "provider down", retryable=True)

    monkeypatch.setattr(losers_module, "fetch_market_data", _failing_fetch_market_data)

    request = AnalyzeLosersRequest(
        user_id="user_1",
        losers=[PortfolioLoser(symbol="AAPL", market_value=1000.0, gain_loss_pct=-8.0)],
    )

    with pytest.raises(RealtimeDataUnavailable):
        await _build_optimization_context(
            request=request,
            user_id="user_1",
            consent_token="vault_owner_token",  # noqa: S106 - Test fixture token only.
        )
