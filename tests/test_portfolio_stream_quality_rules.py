"""Synthetic quality-rule tests for Kai portfolio import normalization."""

from collections import Counter

from api.routes.kai.portfolio import (
    _aggregate_holdings_by_symbol,
    _build_holdings_quality_report,
    _normalize_raw_holding_row,
    _validate_holding_row,
)


def _validate_many(rows):
    validated = []
    dropped = Counter()
    for i, row in enumerate(rows):
        normalized = _normalize_raw_holding_row(row, i)
        ok, reason = _validate_holding_row(normalized)
        if not ok:
            dropped[reason or "unknown"] += 1
            continue
        validated.append(normalized)
    return validated, dropped


def test_placeholder_rows_are_removed_from_validated_set():
    rows = [
        {
            "name": "Unknown",
            "quantity": None,
            "price": None,
            "market_value": 900226.92,
        },
        {
            "symbol": "MSFT",
            "name": "Microsoft",
            "quantity": 5,
            "price": 350,
            "market_value": 1750,
        },
    ]

    validated, dropped = _validate_many(rows)
    assert len(validated) == 1
    assert validated[0]["symbol"] == "MSFT"
    assert dropped["placeholder_symbol"] + dropped["zero_qty_zero_price_nonzero_value"] >= 1


def test_account_header_like_rows_are_dropped():
    rows = [
        {
            "name": "John W. Doe - Traditional IRA",
            "quantity": None,
            "price": None,
            "market_value": None,
        },
        {
            "symbol": "AAPL",
            "name": "Apple",
            "quantity": 1,
            "price": 180,
            "market_value": 180,
        },
    ]

    validated, dropped = _validate_many(rows)
    assert len(validated) == 1
    assert dropped["account_header_row"] == 1


def test_zero_data_rows_are_dropped():
    rows = [
        {
            "symbol": "ABCD",
            "name": "Some Security",
            "quantity": None,
            "price": None,
            "market_value": None,
        }
    ]

    validated, dropped = _validate_many(rows)
    assert validated == []
    assert dropped["missing_financial_data"] == 1


def test_aggregation_math_merges_symbol_rows_correctly():
    rows = [
        {
            "symbol": "TSLA",
            "name": "Tesla",
            "quantity": 2,
            "price": 200,
            "market_value": 400,
            "cost_basis": 300,
            "unrealized_gain_loss": 100,
        },
        {
            "symbol": "TSLA",
            "name": "Tesla",
            "quantity": 3,
            "price": 220,
            "market_value": 660,
            "cost_basis": 500,
            "unrealized_gain_loss": 160,
        },
    ]

    validated, dropped = _validate_many(rows)
    assert dropped == {}

    aggregated = _aggregate_holdings_by_symbol(validated)
    assert len(aggregated) == 1
    result = aggregated[0]
    assert result["quantity"] == 5
    assert result["market_value"] == 1060
    assert result["cost_basis"] == 800
    assert result["unrealized_gain_loss"] == 260
    assert result["lots_count"] == 2


def test_quality_report_includes_required_quality_counters():
    report = _build_holdings_quality_report(
        raw_count=10,
        validated_count=7,
        aggregated_count=6,
        dropped_reasons=Counter({"account_header_row": 1, "placeholder_symbol": 2}),
        reconciled_count=3,
        mismatch_count=1,
        parse_diagnostics={"repair_applied": True, "repair_actions": ["balanced_delimiters"]},
        unknown_name_count=0,
        placeholder_symbol_count=0,
        zero_qty_zero_price_nonzero_value_count=0,
        account_header_row_count=1,
        duplicate_symbol_lot_count=1,
    )

    assert report["raw"] == 10
    assert report["validated"] == 7
    assert report["aggregated"] == 6
    assert report["dropped"] == 3
    assert report["dropped_reasons"]["account_header_row"] == 1
    assert report["duplicate_symbol_lot_count"] == 1
    assert report["parse_repair_applied"] is True
