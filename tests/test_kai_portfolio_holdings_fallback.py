"""Tests for holdings fallback extraction in Kai portfolio import stream route."""

from api.routes.kai.portfolio import (
    _aggregate_holdings_by_symbol,
    _extract_holdings_list,
    _extract_live_holdings_preview_from_text,
    _normalize_raw_holding_row,
    _validate_holding_row,
)


def test_extract_holdings_list_prefers_canonical_key():
    payload = {
        "detailed_holdings": [
            {"symbol": "AAPL", "quantity": 10, "market_value": 1850.0},
            {"symbol": "MSFT", "quantity": 5, "market_value": 2100.0},
        ]
    }

    holdings, source = _extract_holdings_list(payload)
    assert source == "detailed_holdings"
    assert len(holdings) == 2
    assert holdings[0]["symbol"] == "AAPL"


def test_extract_holdings_list_supports_alias_and_nested_shapes():
    payload = {
        "portfolio": {
            "positions": {
                "items": [
                    {"symbol_cusip": "VTI", "quantity": 12, "market_value": 3350.0},
                    {"symbol_cusip": "BND", "quantity": 20, "market_value": 1450.0},
                ]
            }
        }
    }

    holdings, source = _extract_holdings_list(payload)
    assert source == "recursive_scan"
    assert len(holdings) == 2
    assert holdings[1]["symbol_cusip"] == "BND"


def test_extract_holdings_list_returns_empty_when_not_present():
    payload = {"account_metadata": {"institution_name": "Fidelity"}, "portfolio_summary": {}}

    holdings, source = _extract_holdings_list(payload)
    assert source == "none"
    assert holdings == []


def test_extract_holdings_list_merges_nested_lists_across_accounts():
    payload = {
        "account_groups": [
            {
                "positions": [
                    {"symbol": "AAPL", "quantity": 10, "market_value": 1800},
                    {"symbol": "MSFT", "quantity": 5, "market_value": 2100},
                ]
            },
            {
                "positions": [
                    {"symbol": "GOOGL", "quantity": 3, "market_value": 900},
                    {"symbol": "AMZN", "quantity": 2, "market_value": 700},
                ]
            },
        ]
    }

    holdings, source = _extract_holdings_list(payload)
    symbols = {h.get("symbol") for h in holdings}
    assert source == "recursive_scan"
    assert symbols == {"AAPL", "MSFT", "GOOGL", "AMZN"}


def test_extract_live_holdings_preview_from_text_returns_relatable_fields():
    streamed_json = """
{"detailed_holdings":[
  {"symbol":"AAPL","name":"Apple Inc","quantity":10,"market_value":1950.25,"asset_type":"stock"},
  {"symbol_cusip":"VTI","description":"Vanguard Total Stock Market ETF","shares":"5","value":"1250.75","asset_class":"etf"}
]}
    """.strip()

    preview = _extract_live_holdings_preview_from_text(streamed_json, max_items=5)
    assert len(preview) >= 2
    assert preview[0]["symbol"] == "AAPL"
    assert preview[0]["name"] == "Apple Inc"
    assert preview[0]["quantity"] == 10.0
    assert preview[0]["market_value"] == 1950.25


def test_validate_holding_row_drops_placeholder_symbol_rows():
    raw = {
        "name": "Unknown",
        "quantity": None,
        "market_value": 900226.92,
        "price": None,
    }
    normalized = _normalize_raw_holding_row(raw, idx=20)

    is_valid, reason = _validate_holding_row(normalized)
    assert is_valid is False
    assert reason in {"placeholder_symbol", "zero_qty_zero_price_nonzero_value"}


def test_validate_holding_row_drops_account_header_rows():
    raw = {
        "name": "John W. Doe - Individual - TOD",
        "symbol": "",
        "quantity": None,
        "market_value": None,
    }
    normalized = _normalize_raw_holding_row(raw, idx=3)
    is_valid, reason = _validate_holding_row(normalized)

    assert is_valid is False
    assert reason == "account_header_row"


def test_aggregate_holdings_by_symbol_merges_lots_and_keeps_symbol():
    rows = [
        _normalize_raw_holding_row(
            {
                "symbol": "AAPL",
                "name": "Apple Inc",
                "quantity": 10,
                "price": 100,
                "market_value": 1000,
                "cost_basis": 800,
                "unrealized_gain_loss": 200,
            },
            idx=0,
        ),
        _normalize_raw_holding_row(
            {
                "symbol": "AAPL",
                "name": "Apple Inc",
                "quantity": 5,
                "price": 120,
                "market_value": 600,
                "cost_basis": 500,
                "unrealized_gain_loss": 100,
            },
            idx=1,
        ),
    ]
    is_valid_0, _ = _validate_holding_row(rows[0])
    is_valid_1, _ = _validate_holding_row(rows[1])
    assert is_valid_0 is True
    assert is_valid_1 is True

    aggregated = _aggregate_holdings_by_symbol(rows)
    assert len(aggregated) == 1
    assert aggregated[0]["symbol"] == "AAPL"
    assert aggregated[0]["quantity"] == 15
    assert aggregated[0]["market_value"] == 1600
    assert aggregated[0]["cost_basis"] == 1300
    assert aggregated[0]["unrealized_gain_loss"] == 300
    assert aggregated[0]["lots_count"] == 2
