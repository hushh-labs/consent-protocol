"""Quality reporting helpers for Kai portfolio import V2."""

from __future__ import annotations

from collections import Counter
from typing import Any


def _to_num(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _coerce_optional_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return float(text.replace(",", "").replace("$", ""))
        except ValueError:
            return None
    return None


def build_holdings_quality_report_v2(
    *,
    raw_count: int,
    validated_count: int,
    aggregated_count: int,
    dropped_reasons: Counter[str],
    reconciled_count: int,
    mismatch_count: int,
    parse_diagnostics: dict[str, Any],
    unknown_name_count: int,
    placeholder_symbol_count: int,
    zero_qty_zero_price_nonzero_value_count: int,
    account_header_row_count: int,
    duplicate_symbol_lot_count: int,
    average_confidence: float,
) -> dict[str, Any]:
    sparse_sections = (
        parse_diagnostics.get("sparse_sections_detected")
        if isinstance(parse_diagnostics.get("sparse_sections_detected"), list)
        else []
    )
    pass_timings = (
        parse_diagnostics.get("pass_timings_ms")
        if isinstance(parse_diagnostics.get("pass_timings_ms"), dict)
        else {}
    )
    pass_token_counts = (
        parse_diagnostics.get("pass_token_counts")
        if isinstance(parse_diagnostics.get("pass_token_counts"), dict)
        else {}
    )
    pass_sources = (
        parse_diagnostics.get("pass_content_sources")
        if isinstance(parse_diagnostics.get("pass_content_sources"), dict)
        else {}
    )
    return {
        "raw": raw_count,
        "validated": validated_count,
        "aggregated": aggregated_count,
        "dropped": raw_count - validated_count,
        "reconciled": reconciled_count,
        "mismatch_detected": mismatch_count,
        "dropped_reasons": dict(dropped_reasons),
        "unknown_name_count": unknown_name_count,
        "placeholder_symbol_count": placeholder_symbol_count,
        "zero_qty_zero_price_nonzero_value_count": zero_qty_zero_price_nonzero_value_count,
        "account_header_row_count": account_header_row_count,
        "duplicate_symbol_lot_count": duplicate_symbol_lot_count,
        "average_confidence": average_confidence,
        "parse_repair_applied": parse_diagnostics.get("repair_applied", False),
        "parse_repair_actions": parse_diagnostics.get("repair_actions", []),
        "sparse_sections_detected": sparse_sections,
        "positions_coverage": parse_diagnostics.get("positions_coverage"),
        "pass_timings_ms": pass_timings,
        "pass_token_counts": pass_token_counts,
        "pass_content_sources": pass_sources,
    }


def evaluate_import_quality_gate_v2(
    *,
    holdings: list[dict[str, Any]],
    placeholder_symbol_count: int,
    account_header_row_count: int,
    expected_total_value: float | None,
) -> tuple[bool, dict[str, Any]]:
    holdings_market_value = round(
        sum(_coerce_optional_number(row.get("market_value")) or 0.0 for row in holdings), 2
    )
    target_total_value = _coerce_optional_number(expected_total_value)
    if target_total_value is None or target_total_value <= 0:
        target_total_value = holdings_market_value
    reconciliation_gap = abs((target_total_value or 0.0) - holdings_market_value)
    reconciled_within_cent = reconciliation_gap <= 0.01
    passed = (
        len(holdings) > 0
        and placeholder_symbol_count == 0
        and account_header_row_count == 0
        and reconciled_within_cent
    )
    return passed, {
        "passed": passed,
        "holdings_count": len(holdings),
        "placeholder_symbol_count": placeholder_symbol_count,
        "account_header_row_count": account_header_row_count,
        "expected_total_value": target_total_value,
        "holdings_market_value_sum": holdings_market_value,
        "reconciliation_gap": round(reconciliation_gap, 4),
        "reconciled_within_cent": reconciled_within_cent,
    }


def build_quality_report_v2(
    *,
    quality_report: dict[str, Any],
    quality_gate: dict[str, Any],
    holdings: list[dict[str, Any]],
) -> dict[str, Any]:
    raw = int(quality_report.get("raw") or 0)
    validated = int(quality_report.get("validated") or 0)
    aggregated = int(quality_report.get("aggregated") or len(holdings))
    parser_quality_score = (validated / raw) if raw > 0 else 0.0

    investable_count = sum(1 for row in holdings if bool(row.get("is_investable")))
    cash_count = sum(1 for row in holdings if bool(row.get("is_cash_equivalent")))
    trust_hits = sum(
        1
        for row in holdings
        if str(row.get("symbol_trust_tier") or "").strip().lower() not in {"", "unknown"}
    )
    allocation_input = quality_report.get("positions_coverage")
    coverage_pct = 0.0
    if isinstance(allocation_input, dict):
        maybe = allocation_input.get("value_coverage_pct")
        if isinstance(maybe, (int, float)):
            coverage_pct = float(maybe) / 100.0

    return {
        "schema_version": 2,
        "raw_count": raw,
        "validated_count": validated,
        "aggregated_count": aggregated,
        "holdings_count": len(holdings),
        "investable_positions_count": investable_count,
        "cash_positions_count": cash_count,
        "allocation_coverage_pct": round(max(0.0, min(1.0, coverage_pct)), 4),
        "symbol_trust_coverage_pct": round((trust_hits / len(holdings)) if holdings else 0.0, 4),
        "parser_quality_score": round(parser_quality_score, 4),
        "quality_gate": quality_gate,
        "dropped_reasons": quality_report.get("dropped_reasons") or {},
        "diagnostics": {
            "average_confidence": _to_num(quality_report.get("average_confidence")) or 0.0,
            "mismatch_detected": int(quality_report.get("mismatch_detected") or 0),
            "parse_repair_applied": bool(quality_report.get("parse_repair_applied")),
            "parse_repair_actions": quality_report.get("parse_repair_actions") or [],
            "pass_timings_ms": quality_report.get("pass_timings_ms") or {},
            "pass_token_counts": quality_report.get("pass_token_counts") or {},
            "pass_content_sources": quality_report.get("pass_content_sources") or {},
        },
    }
