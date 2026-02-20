#!/usr/bin/env python3
"""Evaluate Gemini portfolio stream extraction quality on one or more PDFs.

This script mirrors the /api/kai/portfolio/import/stream prompt and
normalization pipeline so parser quality can be benchmarked deterministically.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types
from google.genai.types import HttpOptions

CONSENT_PROTOCOL_ROOT = Path(__file__).resolve().parents[1]
if str(CONSENT_PROTOCOL_ROOT) not in sys.path:
    sys.path.insert(0, str(CONSENT_PROTOCOL_ROOT))

from api.routes.kai._streaming import parse_json_with_single_repair  # noqa: E402
from api.routes.kai.portfolio import (  # noqa: E402
    _aggregate_holdings_by_symbol,
    _coerce_optional_number,
    _extract_holdings_list,
    _is_unknown_name,
    _normalize_raw_holding_row,
    _validate_holding_row,
)
from hushh_mcp.constants import GEMINI_MODEL  # noqa: E402

PROMPT = """Extract this brokerage statement to JSON only.

Return one JSON object with keys:
- account_metadata
- portfolio_summary
- asset_allocation
- detailed_holdings
- income_summary
- realized_gain_loss
- activity_and_transactions
- cash_balance
- total_value

Rules:
- No markdown, no prose.
- Return compact minified JSON (no indentation).
- Use null for unknown fields.
- Do not invent ticker symbols.
- Include every holding row in `detailed_holdings`; if ticker is missing, use best available identifier in `symbol_cusip`.
- Preserve numeric values exactly (including negatives)."""


def _default_pdfs() -> list[Path]:
    repo_root = Path(__file__).resolve().parents[2]
    return [
        repo_root / "data" / "Brokerage_March2021.pdf",
        repo_root / "data" / "sample-new-fidelity-acnt-stmt.pdf",
    ]


def _zero_qty_zero_price_nonzero_value_count(rows: list[dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        qty = _coerce_optional_number(row.get("quantity")) or 0.0
        price = _coerce_optional_number(row.get("price")) or 0.0
        market_value = _coerce_optional_number(row.get("market_value")) or 0.0
        if qty == 0.0 and price == 0.0 and market_value > 0.0:
            count += 1
    return count


async def _run_model_for_pdf(client: genai.Client, pdf_path: Path) -> dict[str, Any]:
    contents = [
        types.Part.from_text(text=PROMPT),
        types.Part.from_bytes(data=pdf_path.read_bytes(), mime_type="application/pdf"),
    ]

    config = types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=12288,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=types.ThinkingConfig(
            include_thoughts=True,
            thinking_level=types.ThinkingLevel.MEDIUM,
        ),
    )

    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=config,
    )

    text = (response.text or "").strip()
    parsed, diagnostics = parse_json_with_single_repair(text)
    holdings, source = _extract_holdings_list(parsed)

    normalized_rows: list[dict[str, Any]] = []
    for idx, row in enumerate(holdings):
        if isinstance(row, dict):
            normalized_rows.append(_normalize_raw_holding_row(row, idx))

    dropped_reasons: Counter[str] = Counter()
    validated_rows: list[dict[str, Any]] = []
    for row in normalized_rows:
        is_valid, reason = _validate_holding_row(row)
        if not is_valid:
            dropped_reasons[reason or "unknown"] += 1
            continue
        validated_rows.append(row)

    aggregated_rows = _aggregate_holdings_by_symbol(validated_rows)

    scorecard: dict[str, Any] = {
        "document": str(pdf_path),
        "extract_source": source,
        "parse_repair_applied": bool(diagnostics.get("repair_applied", False)),
        "raw_holdings_count": len(normalized_rows),
        "validated_holdings_count": len(validated_rows),
        "aggregated_holdings_count": len(aggregated_rows),
        "placeholder_symbol_count": sum(
            1
            for row in aggregated_rows
            if str(row.get("symbol") or "").startswith("HOLDING_")
            or not str(row.get("symbol") or "").strip()
        ),
        "unknown_name_count": sum(
            1 for row in aggregated_rows if _is_unknown_name(row.get("name"))
        ),
        "zero_qty_zero_price_nonzero_value_count": _zero_qty_zero_price_nonzero_value_count(
            aggregated_rows
        ),
        "account_header_row_count": int(dropped_reasons.get("account_header_row", 0)),
        "duplicate_symbol_lot_count": max(0, len(validated_rows) - len(aggregated_rows)),
        "dropped_reasons": dict(dropped_reasons),
        "sample_aggregated_holdings": aggregated_rows[:10],
    }

    scorecard["passes_quality_gates"] = (
        scorecard["placeholder_symbol_count"] == 0
        and scorecard["account_header_row_count"] == 0
        and scorecard["zero_qty_zero_price_nonzero_value_count"] == 0
        and scorecard["aggregated_holdings_count"] > 0
        and all(
            bool(str(row.get("symbol") or "").strip() or str(row.get("name") or "").strip())
            for row in aggregated_rows
        )
    )

    return scorecard


async def _evaluate(pdfs: list[Path]) -> dict[str, Any]:
    client = genai.Client(http_options=HttpOptions(api_version="v1"))
    results: list[dict[str, Any]] = []

    for path in pdfs:
        if not path.exists():
            results.append(
                {
                    "document": str(path),
                    "error": "file_not_found",
                    "passes_quality_gates": False,
                }
            )
            continue
        try:
            results.append(await _run_model_for_pdf(client, path))
        except Exception as exc:  # pragma: no cover - runtime diagnostics
            results.append(
                {
                    "document": str(path),
                    "error": str(exc),
                    "passes_quality_gates": False,
                }
            )

    return {
        "model": GEMINI_MODEL,
        "documents": results,
        "all_quality_gates_passed": all(bool(row.get("passes_quality_gates")) for row in results),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate portfolio stream extraction quality")
    parser.add_argument(
        "--pdf",
        dest="pdfs",
        action="append",
        help="Path to PDF file (repeatable). Defaults to project benchmark PDFs.",
    )
    parser.add_argument(
        "--json-out",
        dest="json_out",
        help="Optional path to save JSON report.",
    )
    parser.add_argument(
        "--no-fail",
        action="store_true",
        help="Do not return non-zero exit code when quality gates fail.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_paths = (
        [Path(p).expanduser().resolve() for p in args.pdfs] if args.pdfs else _default_pdfs()
    )

    report = asyncio.run(_evaluate(pdf_paths))

    output = json.dumps(report, indent=2, ensure_ascii=False)
    print(output)

    if args.json_out:
        out_path = Path(args.json_out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output + "\n", encoding="utf-8")

    if report["all_quality_gates_passed"] or args.no_fail:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
