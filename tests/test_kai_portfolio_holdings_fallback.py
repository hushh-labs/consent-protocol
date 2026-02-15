"""Tests for holdings fallback extraction in Kai portfolio import stream route."""

from api.routes.kai.portfolio import (
    _extract_holdings_list,
    _extract_live_holdings_preview_from_text,
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
