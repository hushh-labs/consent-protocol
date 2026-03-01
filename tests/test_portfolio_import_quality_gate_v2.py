from __future__ import annotations

from api.routes.kai import portfolio as portfolio_route
from hushh_mcp.kai_import.quality_v2 import evaluate_import_quality_gate_v2


def _holding(symbol: str, market_value: float) -> dict[str, float | str]:
    return {"symbol": symbol, "market_value": market_value}


def test_quality_gate_passes_clean_portfolio() -> None:
    passed, gate = evaluate_import_quality_gate_v2(
        holdings=[_holding("AAPL", 100.0), _holding("MSFT", 200.0)],
        placeholder_symbol_count=0,
        account_header_row_count=0,
        expected_total_value=300.0,
        core_keys_present=True,
        rows_with_symbol_pct=1.0,
        rows_with_market_value_pct=1.0,
    )

    assert passed is True
    assert gate["severity"] == "pass"
    assert gate["reasons"] == []
    assert gate["core_keys_present"] is True


def test_quality_gate_warns_on_coverage_gap() -> None:
    passed, gate = evaluate_import_quality_gate_v2(
        holdings=[_holding("AAPL", 100.0), _holding("MSFT", 200.0)],
        placeholder_symbol_count=0,
        account_header_row_count=0,
        expected_total_value=300.0,
        core_keys_present=True,
        rows_with_symbol_pct=0.55,
        rows_with_market_value_pct=0.45,
    )

    assert passed is True
    assert gate["severity"] == "warn"
    assert "low_symbol_coverage" in gate["reasons"]
    assert "low_market_value_coverage" in gate["reasons"]


def test_quality_gate_fails_when_core_keys_missing() -> None:
    passed, gate = evaluate_import_quality_gate_v2(
        holdings=[_holding("AAPL", 125.0), _holding("MSFT", 75.0)],
        placeholder_symbol_count=0,
        account_header_row_count=0,
        expected_total_value=200.0,
        core_keys_present=False,
        rows_with_symbol_pct=1.0,
        rows_with_market_value_pct=1.0,
    )

    assert passed is False
    assert gate["severity"] == "fail"
    assert "core_keys_missing" in gate["reasons"]


def test_quality_gate_fails_when_no_holdings() -> None:
    passed, gate = evaluate_import_quality_gate_v2(
        holdings=[],
        placeholder_symbol_count=0,
        account_header_row_count=0,
        expected_total_value=0.0,
        core_keys_present=True,
        rows_with_symbol_pct=0.0,
        rows_with_market_value_pct=0.0,
    )

    assert passed is False
    assert gate["severity"] == "fail"
    assert "no_holdings_extracted" in gate["reasons"]


def test_import_upload_limit_is_25mb() -> None:
    assert portfolio_route._MAX_IMPORT_FILE_BYTES == 25 * 1024 * 1024
