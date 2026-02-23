"""World-model payload helpers for Kai financial V2 persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def build_financial_statement_snapshot_v2(
    *,
    statement_id: str,
    raw_extract_v2: dict[str, Any],
    canonical_v2: dict[str, Any],
    analytics_v2: dict[str, Any],
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": statement_id,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "schema_version": 2,
        "raw_extract_v2": raw_extract_v2,
        "canonical_v2": canonical_v2,
        "analytics_v2": analytics_v2,
        "provenance": provenance or {},
    }


def build_financial_index_summary_v2(
    *,
    holdings_count: int,
    investable_positions_count: int,
    cash_positions_count: int,
    allocation_coverage_pct: float,
    parser_quality_score: float,
    last_statement_total_value: float,
    last_statement_end: str | None,
) -> dict[str, Any]:
    return {
        "holdings_count": holdings_count,
        "investable_positions_count": investable_positions_count,
        "cash_positions_count": cash_positions_count,
        "allocation_coverage_pct": round(allocation_coverage_pct, 4),
        "parser_quality_score": round(parser_quality_score, 4),
        "last_statement_total_value": round(last_statement_total_value, 2),
        "last_statement_end": last_statement_end,
        "domain_contract_version": 2,
        "intent_map": [
            "portfolio",
            "documents",
            "analytics",
            "profile",
            "analysis_history",
            "analysis.decisions",
            "runtime",
        ],
    }
