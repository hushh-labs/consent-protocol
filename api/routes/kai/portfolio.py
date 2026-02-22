# consent-protocol/api/routes/kai/portfolio.py
"""
Kai Portfolio API Route - Portfolio import and analysis endpoints.

Handles:
- File upload (CSV/PDF) for brokerage statements
- Portfolio summary retrieval
- KPI derivation and world model integration
- SSE streaming for real-time parsing progress

Authentication:
- All endpoints require VAULT_OWNER token (consent-first architecture)
- Token contains user_id, proving both identity and consent
- Firebase is only used for bootstrap (issuing VAULT_OWNER token)
"""

import asyncio
import json
import logging
import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.middleware import require_vault_owner_token
from api.routes.kai._streaming import (
    HEARTBEAT_INTERVAL_SECONDS,
    PORTFOLIO_IMPORT_TIMEOUT_SECONDS,
    CanonicalSSEStream,
    parse_json_with_single_repair,
)
from hushh_mcp.services.portfolio_import_service import (
    ImportResult,
    get_portfolio_import_service,
)
from hushh_mcp.services.renaissance_service import TIER_WEIGHTS, get_renaissance_service
from hushh_mcp.services.symbol_master_service import get_symbol_master_service
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter()
_PICK_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
_MAX_PROFILE_PICKS = 8

_NUMERIC_STRIP_RE = re.compile(r"[$,\s]")
_LIVE_SYMBOL_RE = re.compile(
    r'"(?:symbol|symbol_cusip|ticker|cusip|security_id|security)"\s*:\s*"([^"]{1,64})"',
    flags=re.IGNORECASE,
)
_LIVE_NAME_RE = re.compile(
    r'"(?:description|name|security_name|holding_name)"\s*:\s*"([^"]{1,180})"',
    flags=re.IGNORECASE,
)
_LIVE_ASSET_RE = re.compile(
    r'"(?:asset_class|asset_type|security_type|type)"\s*:\s*"([^"]{1,64})"',
    flags=re.IGNORECASE,
)
_LIVE_QTY_RE = re.compile(
    r'"(?:quantity|shares|units|qty)"\s*:\s*(?:"([^"]{1,40})"|([-+]?\d[\d,]*(?:\.\d+)?))',
    flags=re.IGNORECASE,
)
_LIVE_VALUE_RE = re.compile(
    r'"(?:market_value|current_value|value|position_value|marketValue)"\s*:\s*'
    r'(?:"([^"]{1,40})"|([-+]?\d[\d,]*(?:\.\d+)?))',
    flags=re.IGNORECASE,
)
_HOLDING_KEY_HINTS = frozenset(
    {
        "symbol",
        "symbol_cusip",
        "ticker",
        "cusip",
        "security_id",
        "security",
        "description",
        "name",
        "quantity",
        "qty",
        "shares",
        "units",
        "market_value",
        "value",
        "current_value",
        "marketvalue",
        "price",
        "price_per_unit",
        "last_price",
        "unit_price",
        "current_price",
        "cost_basis",
        "book_value",
        "asset_class",
        "asset_type",
        "security_type",
    }
)


def _looks_like_holding_row(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    keys = {str(key).lower() for key in value.keys()}
    if not keys:
        return False

    strong_fields = {
        "market_value",
        "current_value",
        "marketvalue",
        "cost_basis",
        "book_value",
        "unrealized_gain_loss",
        "asset_class",
        "asset_type",
        "security_type",
        "symbol_cusip",
    }
    id_fields = {"symbol", "symbol_cusip", "ticker", "cusip", "security_id", "security"}
    qty_fields = {"quantity", "qty", "shares", "units"}
    price_fields = {"price", "price_per_unit", "last_price", "unit_price", "current_price"}
    transaction_bias_fields = {
        "transaction_type",
        "settle_date",
        "trade_date",
        "amount",
        "net_amount",
    }

    # Guard against transaction rows being misidentified as holdings.
    if keys.intersection(transaction_bias_fields) and not keys.intersection(strong_fields):
        return False

    if keys.intersection(strong_fields) and keys.intersection(id_fields):
        return True
    if (
        keys.intersection(id_fields)
        and keys.intersection(qty_fields)
        and keys.intersection(price_fields)
    ):
        return True
    if keys.intersection(_HOLDING_KEY_HINTS):
        return True
    # Some statements only return a security identifier + value fields.
    identifier_keys = {"cusip", "security_id", "security"}
    numeric_keys = {"market_value", "value", "current_value", "quantity", "shares", "units"}
    return bool(keys.intersection(identifier_keys) and keys.intersection(numeric_keys))


def _recursive_find_holdings_lists(
    value: Any,
    *,
    _seen: set[int] | None = None,
) -> list[list[dict[str, Any]]]:
    seen = _seen if _seen is not None else set()
    candidates: list[list[dict[str, Any]]] = []

    if isinstance(value, (list, dict)):
        obj_id = id(value)
        if obj_id in seen:
            return candidates
        seen.add(obj_id)

    if isinstance(value, list):
        rows = [row for row in value if isinstance(row, dict)]
        if rows and any(_looks_like_holding_row(row) for row in rows):
            candidates.append(rows)
        for row in value:
            candidates.extend(_recursive_find_holdings_lists(row, _seen=seen))
        return candidates

    if isinstance(value, dict):
        for nested_value in value.values():
            candidates.extend(_recursive_find_holdings_lists(nested_value, _seen=seen))
    return candidates


def _merge_unique_holding_rows(candidates: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen_fingerprints: set[str] = set()
    for rows in candidates:
        for row in rows:
            try:
                fingerprint = json.dumps(row, sort_keys=True, default=str)
            except Exception:
                fingerprint = str(sorted((str(k), str(v)) for k, v in row.items()))
            if fingerprint in seen_fingerprints:
                continue
            seen_fingerprints.add(fingerprint)
            merged.append(row)
    return merged


def _extract_holdings_list(parsed_data: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    collected_candidates: list[list[dict[str, Any]]] = []
    source_fields: list[str] = []

    detailed_holdings = parsed_data.get("detailed_holdings")
    if isinstance(detailed_holdings, list):
        rows = [row for row in detailed_holdings if isinstance(row, dict)]
        if rows and any(_looks_like_holding_row(row) for row in rows):
            collected_candidates.append(rows)
            source_fields.append("detailed_holdings")

    aliases = (
        "holdings",
        "positions",
        "portfolio_holdings",
        "securities",
    )
    for alias in aliases:
        candidate = parsed_data.get(alias)
        if isinstance(candidate, list):
            rows = [row for row in candidate if isinstance(row, dict)]
            if rows and any(_looks_like_holding_row(row) for row in rows):
                collected_candidates.append(rows)
                source_fields.append(alias)
        if isinstance(candidate, dict):
            nested = (
                candidate.get("items")
                or candidate.get("rows")
                or candidate.get("data")
                or candidate.get("holdings")
                or candidate.get("positions")
                or candidate.get("securities")
            )
            if isinstance(nested, list):
                rows = [row for row in nested if isinstance(row, dict)]
                if rows and any(_looks_like_holding_row(row) for row in rows):
                    collected_candidates.append(rows)
                    source_fields.append(f"{alias}.items")

    recursive_candidates = _recursive_find_holdings_lists(parsed_data)
    if recursive_candidates:
        collected_candidates.extend(recursive_candidates)

    if not collected_candidates:
        return [], "none"

    merged = _merge_unique_holding_rows(collected_candidates)
    if not merged:
        return [], "none"

    if "detailed_holdings" in source_fields:
        return merged, "detailed_holdings"
    if source_fields:
        return merged, source_fields[0]
    return merged, "recursive_scan"


def _estimate_stream_holdings(full_response: str) -> int:
    if not full_response:
        return 0

    lower = full_response.lower()
    anchor = -1
    for key in ('"detailed_holdings"', '"holdings"', '"positions"', '"securities"'):
        anchor = lower.rfind(key)
        if anchor != -1:
            break
    section = full_response[anchor:] if anchor != -1 else full_response
    symbol_matches = re.findall(
        r'"(?:symbol|symbol_cusip|ticker)"\s*:', section, flags=re.IGNORECASE
    )
    if symbol_matches:
        return len(symbol_matches)
    row_markers = re.findall(
        r'"(?:quantity|market_value|cost_basis|price|price_per_unit)"\s*:',
        section,
        flags=re.IGNORECASE,
    )
    return max(0, len(row_markers) // 2)


def _extract_live_holdings_preview_from_text(
    full_response: str,
    *,
    max_items: int = 40,
) -> list[dict[str, Any]]:
    if not full_response:
        return []

    lower = full_response.lower()
    anchors = [
        lower.rfind('"detailed_holdings"'),
        lower.rfind('"holdings"'),
        lower.rfind('"positions"'),
        lower.rfind('"securities"'),
    ]
    anchor = max(anchors)
    section = full_response[anchor:] if anchor >= 0 else full_response

    preview: list[dict[str, Any]] = []
    seen: set[str] = set()

    for symbol_match in _LIVE_SYMBOL_RE.finditer(section):
        symbol = symbol_match.group(1).strip()
        if not symbol:
            continue

        window_start = symbol_match.start()
        window_end = min(len(section), window_start + 700)
        window = section[window_start:window_end]

        name_match = _LIVE_NAME_RE.search(window)
        asset_match = _LIVE_ASSET_RE.search(window)
        qty_match = _LIVE_QTY_RE.search(window)
        value_match = _LIVE_VALUE_RE.search(window)

        name = name_match.group(1).strip() if name_match else ""
        asset_type = asset_match.group(1).strip() if asset_match else ""
        quantity_raw = (
            (qty_match.group(1) or qty_match.group(2)).strip()
            if qty_match and (qty_match.group(1) or qty_match.group(2))
            else None
        )
        market_value_raw = (
            (value_match.group(1) or value_match.group(2)).strip()
            if value_match and (value_match.group(1) or value_match.group(2))
            else None
        )

        quantity = _coerce_optional_number(quantity_raw)
        market_value = _coerce_optional_number(market_value_raw)

        fingerprint = f"{symbol}|{name}|{quantity}|{market_value}|{asset_type}"
        if fingerprint in seen:
            continue
        seen.add(fingerprint)

        preview.append(
            {
                "symbol": symbol,
                "name": name or None,
                "quantity": quantity,
                "market_value": market_value,
                "asset_type": asset_type or None,
            }
        )
        if len(preview) >= max_items:
            break

    return preview


def _build_holdings_preview(
    holdings: list[dict[str, Any]],
    *,
    max_items: Optional[int] = None,
) -> list[dict[str, Any]]:
    preview: list[dict[str, Any]] = []
    rows = holdings
    if isinstance(max_items, int) and max_items > 0:
        rows = holdings[:max_items]

    for holding in rows:
        symbol = holding.get("symbol") or holding.get("symbol_cusip")
        name = holding.get("name") or holding.get("description")
        preview.append(
            {
                "symbol": str(symbol).strip() if symbol is not None else "",
                "name": str(name).strip() if name is not None else "",
                "market_value": _coerce_optional_number(holding.get("market_value")),
                "quantity": _coerce_optional_number(holding.get("quantity")),
                "asset_type": str(holding.get("asset_type", "")).strip() or None,
            }
        )
    return preview


def _first_present(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return None


def _coerce_optional_number(value: Any) -> Optional[float]:
    """Parse currency-like values to float; return None for blanks/invalid numbers."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if math.isfinite(num) else None

    text = str(value).strip()
    if not text or text.lower() in {"n/a", "na", "null", "none", "--", "-"}:
        return None

    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    text = _NUMERIC_STRIP_RE.sub("", text).replace("%", "")
    if negative:
        text = f"-{text}"

    try:
        num = float(text)
        return num if math.isfinite(num) else None
    except ValueError:
        return None


def _reconcile_holding_numeric_fields(
    holding: dict[str, Any], tolerance: float = 0.10
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply deterministic market-value-first reconciliation for holding numeric fields."""
    normalized = dict(holding)
    reconciled_fields: list[str] = []
    mismatch_detected = False

    qty = _coerce_optional_number(normalized.get("quantity"))
    price = _coerce_optional_number(normalized.get("price"))
    market_value = _coerce_optional_number(normalized.get("market_value"))
    has_qty = qty is not None and qty != 0.0

    # Fill missing market value when quantity and price are available.
    if market_value is None and has_qty and price is not None:
        qty_value = qty if qty is not None else 0.0
        market_value = qty_value * price
        reconciled_fields.append("market_value")

    # Market value is authoritative: derive/recompute price when possible.
    if has_qty and market_value is not None:
        qty_value = qty if qty is not None else 1.0
        derived_price = market_value / qty_value
        if price is None:
            price = derived_price
            reconciled_fields.append("price")
        elif derived_price != 0:
            rel_delta = abs(price - derived_price) / abs(derived_price)
            if rel_delta > tolerance:
                mismatch_detected = True
                price = derived_price
                reconciled_fields.append("price")

    if qty is not None and price is not None and market_value is not None and market_value != 0:
        expected_market_value = qty * price
        rel_delta = abs(expected_market_value - market_value) / abs(market_value)
        if rel_delta > tolerance:
            mismatch_detected = True

    normalized["quantity"] = qty
    normalized["price"] = price
    normalized["price_per_unit"] = price
    normalized["market_value"] = market_value
    normalized["cost_basis"] = _coerce_optional_number(normalized.get("cost_basis"))
    normalized["unrealized_gain_loss"] = _coerce_optional_number(
        normalized.get("unrealized_gain_loss")
    )
    normalized["unrealized_gain_loss_pct"] = _coerce_optional_number(
        normalized.get("unrealized_gain_loss_pct")
    )
    normalized["estimated_annual_income"] = _coerce_optional_number(
        normalized.get("estimated_annual_income")
    )
    normalized["est_yield"] = _coerce_optional_number(normalized.get("est_yield"))

    return normalized, {
        "reconciled_fields": sorted(set(reconciled_fields)),
        "mismatch_detected": mismatch_detected,
    }


_UNKNOWN_NAMES = {
    "",
    "unknown",
    "n/a",
    "na",
    "none",
    "unnamed",
}
_ACCOUNT_HEADER_HINTS = (
    "individual",
    "traditional ira",
    "education account",
    "tod",
    "joint",
    "account",
)
_CASH_EQUIVALENT_HINTS = (
    "cash",
    "money market",
    "sweep",
    "core position",
)
_TRADE_ACTION_TOKENS = {
    "BUY",
    "SELL",
    "REINVEST",
    "DIVIDEND",
    "INTEREST",
    "TRANSFER",
    "WITHDRAWAL",
    "DEPOSIT",
}


def _normalize_symbol_token(raw_value: Any) -> str:
    if raw_value is None:
        return ""
    token = re.sub(r"[^A-Za-z0-9]", "", str(raw_value)).upper()
    return token[:12]


def _is_unknown_name(value: Any) -> bool:
    if value is None:
        return True
    name = str(value).strip().lower()
    return name in _UNKNOWN_NAMES


def _is_non_holding_row(row: dict[str, Any]) -> bool:
    """
    Detect rows that look like account/profile headers instead of holdings.
    """
    name = str(row.get("name") or row.get("description") or "").strip().lower()
    symbol = str(row.get("symbol") or "").strip().lower()

    has_numeric = any(
        _coerce_optional_number(row.get(key)) is not None
        for key in ("quantity", "price", "market_value", "cost_basis")
    )
    if not has_numeric and any(hint in name for hint in _ACCOUNT_HEADER_HINTS):
        return True
    if not has_numeric and symbol == "" and name:
        return True
    return False


def _is_cash_equivalent_row(row: dict[str, Any]) -> bool:
    symbol = str(row.get("symbol") or "").strip().upper()
    if symbol in {"CASH", "MMF", "SWEEP"}:
        return True
    asset_type = str(row.get("asset_type") or "").strip().lower()
    if asset_type in {"cash", "cash_equivalent", "money_market"}:
        return True
    name = str(row.get("name") or row.get("description") or "").strip().lower()
    return any(hint in name for hint in _CASH_EQUIVALENT_HINTS)


def _looks_like_cash_sweep_identifier(
    symbol: str,
    *,
    name: str,
    asset_type: str,
) -> bool:
    normalized_symbol = str(symbol).strip().upper()
    if not normalized_symbol:
        return False
    if normalized_symbol in {"CASH", "MMF", "SWEEP"}:
        return False
    name_lc = str(name).strip().lower()
    asset_lc = str(asset_type).strip().lower()
    if "sweep" in name_lc:
        return True
    if "cash" in name_lc and ("cash" in asset_lc or "sweep" in asset_lc):
        return True
    if "cash" in asset_lc and len(normalized_symbol) > 4:
        return True
    return False


def _compute_holding_confidence(row: dict[str, Any]) -> float:
    """
    Compute a deterministic row confidence score in [0, 1].

    This score is intentionally simple and auditable:
    - Strongly rewards explicit symbols and complete numeric fields.
    - Penalizes synthetic/derived identifiers and reconciliation mismatches.
    """
    score = 0.2
    symbol_quality = str(row.get("symbol_quality") or "").lower().strip()
    if symbol_quality == "provided":
        score += 0.35
    elif symbol_quality == "derived_from_name":
        score += 0.2
    elif symbol_quality == "aggregated":
        score += 0.25
    else:
        score += 0.05

    name = str(row.get("name") or "").strip()
    if not _is_unknown_name(name):
        score += 0.1

    quantity = _coerce_optional_number(row.get("quantity"))
    price = _coerce_optional_number(row.get("price"))
    market_value = _coerce_optional_number(row.get("market_value"))
    if quantity is not None:
        score += 0.1
    if price is not None:
        score += 0.1
    if market_value is not None:
        score += 0.1

    reconciliation = row.get("reconciliation")
    if isinstance(reconciliation, dict) and reconciliation.get("mismatch_detected"):
        score -= 0.15

    if str(row.get("symbol") or "").startswith("HOLDING_"):
        score = min(score, 0.35)

    return max(0.0, min(1.0, round(score, 4)))


def _normalize_raw_holding_row(row: dict[str, Any], idx: int) -> dict[str, Any]:
    symbol_master = get_symbol_master_service()
    raw_symbol = _first_present(
        row,
        "symbol",
        "ticker",
        "symbol_cusip",
        "cusip",
        "security_id",
        "security",
    )
    symbol_quality = "provided"
    normalized_symbol = _normalize_symbol_token(raw_symbol)
    raw_name = str(
        _first_present(
            row,
            "description",
            "name",
            "security_name",
            "holding_name",
        )
        or ""
    ).strip()
    raw_asset_type = str(
        _first_present(
            row,
            "asset_class",
            "asset_type",
            "security_type",
            "type",
        )
        or ""
    ).strip()
    if not normalized_symbol:
        if raw_name:
            fallback = _normalize_symbol_token(raw_name.split()[0])
            normalized_symbol = fallback
            symbol_quality = "derived_from_name" if fallback else "synthetic"
        else:
            symbol_quality = "synthetic"
    if not normalized_symbol and symbol_quality == "synthetic":
        normalized_symbol = f"HOLDING_{idx + 1}"

    # Cash sweep lines often carry internal identifiers (e.g., QACDS).
    # Canonicalize to CASH so market/watchlist layers do not treat them as tradable tickers.
    if _looks_like_cash_sweep_identifier(
        normalized_symbol, name=raw_name, asset_type=raw_asset_type
    ):
        normalized_symbol = "CASH"
        if symbol_quality == "provided":
            symbol_quality = "derived_from_name"

    symbol_classification = symbol_master.classify(
        normalized_symbol,
        name=raw_name,
        asset_type=raw_asset_type,
    )
    if symbol_classification.symbol:
        normalized_symbol = symbol_classification.symbol

    raw_sector_value = _first_present(row, "sector", "gics_sector", "sector_name")
    raw_sector = str(raw_sector_value).strip() if raw_sector_value is not None else ""
    raw_industry_value = _first_present(row, "industry", "gics_industry", "industry_name")
    raw_industry = str(raw_industry_value).strip() if raw_industry_value is not None else ""
    merged_sector, merged_industry, sector_tags, metadata_confidence = symbol_master.enrich_holding(
        symbol=normalized_symbol,
        sector=raw_sector or None,
        industry=raw_industry or None,
    )
    if symbol_classification.trust_tier == "cash_equivalent":
        merged_sector = merged_sector or "Cash & Cash Equivalents"
        merged_industry = merged_industry or "Cash Management"

    normalized, reconciliation = _reconcile_holding_numeric_fields(
        {
            "symbol": normalized_symbol,
            "symbol_quality": symbol_quality,
            "symbol_trust_tier": symbol_classification.trust_tier,
            "symbol_trust_reason": symbol_classification.reason,
            "tradable": bool(symbol_classification.tradable),
            "name": raw_name or "Unknown",
            "quantity": _first_present(row, "quantity", "shares", "units", "qty"),
            "price": _first_present(
                row,
                "price",
                "price_per_unit",
                "last_price",
                "unit_price",
                "current_price",
            ),
            "price_per_unit": _first_present(
                row,
                "price",
                "price_per_unit",
                "last_price",
                "unit_price",
                "current_price",
            ),
            "market_value": _first_present(
                row,
                "market_value",
                "current_value",
                "marketValue",
                "value",
                "position_value",
            ),
            "cost_basis": _first_present(
                row,
                "cost_basis",
                "book_value",
                "cost",
                "total_cost",
            ),
            "unrealized_gain_loss": _first_present(
                row,
                "unrealized_gain_loss",
                "gain_loss",
                "unrealized_pnl",
                "pnl",
            ),
            "unrealized_gain_loss_pct": _first_present(
                row,
                "unrealized_gain_loss_pct",
                "gain_loss_pct",
                "unrealized_return_pct",
                "return_pct",
            ),
            "asset_type": raw_asset_type or None,
            "sector": merged_sector,
            "industry": merged_industry,
            "sector_tags": sector_tags,
            "metadata_confidence": metadata_confidence,
            "acquisition_date": row.get("acquisition_date"),
            "estimated_annual_income": _first_present(
                row,
                "estimated_annual_income",
                "est_annual_income",
                "annual_income",
            ),
            "est_yield": _first_present(row, "est_yield", "yield", "current_yield"),
        }
    )
    if reconciliation["reconciled_fields"] or reconciliation["mismatch_detected"]:
        normalized["reconciliation"] = reconciliation
    normalized["confidence"] = _compute_holding_confidence(normalized)
    normalized["provenance"] = {
        "source": "statement_llm_parse",
        "symbol_quality": symbol_quality,
        "symbol_trust_tier": symbol_classification.trust_tier,
        "symbol_trust_reason": symbol_classification.reason,
        "reconciled_fields": reconciliation.get("reconciled_fields", []),
        "mismatch_detected": bool(reconciliation.get("mismatch_detected")),
    }
    return normalized


def _validate_holding_row(row: dict[str, Any]) -> tuple[bool, str | None]:
    symbol = str(row.get("symbol") or "").strip()
    symbol_quality = str(row.get("symbol_quality") or "").strip().lower()
    symbol_trust_tier = str(row.get("symbol_trust_tier") or "").strip().lower()
    name = str(row.get("name") or "").strip()
    quantity = _coerce_optional_number(row.get("quantity"))
    price = _coerce_optional_number(row.get("price"))
    market_value = _coerce_optional_number(row.get("market_value"))

    if _is_non_holding_row(row):
        return False, "account_header_row"

    if symbol.startswith("HOLDING_") or not symbol:
        if symbol_quality == "synthetic":
            return False, "placeholder_symbol"
        if not symbol:
            return False, "missing_symbol"

    if symbol_trust_tier == "action_token" or symbol.upper() in _TRADE_ACTION_TOKENS:
        return False, "trade_action_token"

    if symbol in {"UNKNOWN", "NA", "NONE", "N/A"}:
        return False, "placeholder_symbol"

    if _is_unknown_name(name) and symbol_quality != "provided":
        return False, "unknown_name"

    if _is_unknown_name(name) and (symbol.startswith("HOLDING_") or not symbol):
        return False, "unknown_name"

    if quantity is None and price is None and market_value is None:
        return False, "missing_financial_data"

    # Reject impossible rows that still leak through LLM output:
    # quantity=0, price~0, huge market value and no strong symbol.
    if (
        quantity is not None
        and abs(quantity) < 1e-9
        and (price is None or abs(price) < 1e-9)
        and market_value is not None
        and abs(market_value) >= 1.0
        and symbol_quality != "provided"
        and not _is_cash_equivalent_row(row)
    ):
        return False, "zero_qty_zero_price_nonzero_value"

    return True, None


def _aggregate_holdings_by_symbol(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        symbol = _normalize_symbol_token(row.get("symbol"))
        if not symbol:
            continue
        existing = grouped.get(symbol)
        if not existing:
            grouped[symbol] = {
                **row,
                "symbol": symbol,
                "lots_count": 1,
                "confidence": _coerce_optional_number(row.get("confidence")) or 0.0,
                "quantity": _coerce_optional_number(row.get("quantity")),
                "market_value": _coerce_optional_number(row.get("market_value")),
                "cost_basis": _coerce_optional_number(row.get("cost_basis")),
                "unrealized_gain_loss": _coerce_optional_number(row.get("unrealized_gain_loss")),
                "provenance": {
                    "source": "statement_llm_parse",
                    "aggregated_from_lots": 1,
                },
            }
            continue

        existing["lots_count"] = int(existing.get("lots_count") or 1) + 1
        existing["provenance"] = {
            "source": "statement_llm_parse",
            "aggregated_from_lots": existing["lots_count"],
        }

        incoming_confidence = _coerce_optional_number(row.get("confidence")) or 0.0
        existing_confidence = _coerce_optional_number(existing.get("confidence")) or 0.0
        lot_count_before = max(1, existing["lots_count"] - 1)
        existing["confidence"] = round(
            ((existing_confidence * lot_count_before) + incoming_confidence)
            / existing["lots_count"],
            4,
        )

        for field in ("quantity", "market_value", "cost_basis", "unrealized_gain_loss"):
            current_value = _coerce_optional_number(existing.get(field))
            incoming_value = _coerce_optional_number(row.get(field))
            if incoming_value is None:
                continue
            if current_value is None:
                existing[field] = incoming_value
            else:
                existing[field] = current_value + incoming_value

        existing_name = str(existing.get("name") or "").strip()
        incoming_name = str(row.get("name") or "").strip()
        if _is_unknown_name(existing_name) and incoming_name:
            existing["name"] = incoming_name
        if not existing.get("asset_type") and row.get("asset_type"):
            existing["asset_type"] = row.get("asset_type")
        if not existing.get("sector") and row.get("sector"):
            existing["sector"] = row.get("sector")
        if not existing.get("industry") and row.get("industry"):
            existing["industry"] = row.get("industry")
        existing_tags = (
            existing.get("sector_tags") if isinstance(existing.get("sector_tags"), list) else []
        )
        incoming_tags = row.get("sector_tags") if isinstance(row.get("sector_tags"), list) else []
        if incoming_tags:
            deduped_tags: list[str] = []
            for tag in [*existing_tags, *incoming_tags]:
                text = str(tag or "").strip()
                if text and text not in deduped_tags:
                    deduped_tags.append(text)
            existing["sector_tags"] = deduped_tags
        existing_conf = _coerce_optional_number(existing.get("metadata_confidence")) or 0.0
        incoming_conf = _coerce_optional_number(row.get("metadata_confidence")) or 0.0
        existing["metadata_confidence"] = max(existing_conf, incoming_conf)
        if not bool(existing.get("tradable")) and bool(row.get("tradable")):
            existing["tradable"] = True
        if str(existing.get("symbol_trust_tier") or "").lower() in {"", "unknown"}:
            existing["symbol_trust_tier"] = row.get("symbol_trust_tier")
            existing["symbol_trust_reason"] = row.get("symbol_trust_reason")

    aggregated = list(grouped.values())
    for row in aggregated:
        qty = _coerce_optional_number(row.get("quantity"))
        market_value = _coerce_optional_number(row.get("market_value"))
        if qty is not None and abs(qty) > 1e-9 and market_value is not None:
            row["price"] = market_value / qty
            row["price_per_unit"] = row["price"]
        row["symbol_quality"] = "aggregated"
        row["confidence"] = _compute_holding_confidence(row)
    return aggregated


def _build_holdings_quality_report(
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
    }


class PortfolioImportResponse(BaseModel):
    """Response from portfolio import endpoint."""

    success: bool
    holdings_count: int = 0
    total_value: float = 0.0
    losers: list[dict] = Field(default_factory=list)
    winners: list[dict] = Field(default_factory=list)
    kpis_stored: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    source: str = "unknown"
    # Comprehensive financial data (LLM-extracted)
    portfolio_data: Optional[dict] = None
    account_info: Optional[dict] = None
    account_summary: Optional[dict] = None
    asset_allocation: Optional[dict] = None
    income_summary: Optional[dict] = None
    realized_gain_loss: Optional[dict] = None
    transactions: Optional[list] = None
    cash_balance: float = 0.0


class PortfolioSummaryResponse(BaseModel):
    """Response for portfolio summary endpoint."""

    user_id: str
    has_portfolio: bool
    holdings_count: Optional[int] = None
    portfolio_value_bucket: Optional[str] = None
    risk_bucket: Optional[str] = None
    losers_count: Optional[int] = None
    winners_count: Optional[int] = None
    total_gain_loss_pct: Optional[float] = None


class DashboardProfilePick(BaseModel):
    """Profile-personalized ticker candidate for dashboard recommendations."""

    symbol: str
    company_name: str
    sector: Optional[str] = None
    tier: Optional[str] = None
    conviction_weight: float = 0.0
    price: Optional[float] = None
    change_percent: Optional[float] = None
    recommendation_bias: Optional[str] = None
    rationale: str
    source_tags: list[str] = Field(default_factory=list)
    degraded: bool = False
    as_of: Optional[str] = None


class DashboardProfilePicksResponse(BaseModel):
    """Response payload for profile-based picks on Kai dashboard."""

    user_id: str
    generated_at: str
    risk_profile: str
    picks: list[DashboardProfilePick] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_symbols_query(raw: Optional[str], *, max_items: int = 20) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for part in raw.split(","):
        symbol = str(part or "").strip().upper()
        if not symbol or not _PICK_TICKER_RE.match(symbol):
            continue
        if symbol in out:
            continue
        out.append(symbol)
        if len(out) >= max_items:
            break
    return out


def _normalize_risk_profile(raw: Any) -> str:
    text = str(raw or "").strip().lower()
    if text in {"conservative", "balanced", "aggressive"}:
        return text
    return "balanced"


def _allowed_tiers_for_risk(risk_profile: str) -> tuple[str, ...]:
    if risk_profile == "conservative":
        return ("ACE", "KING")
    if risk_profile == "aggressive":
        return ("KING", "QUEEN", "JACK", "ACE")
    return ("ACE", "KING", "QUEEN")


def _recommendation_bias_from_tier(tier: str) -> str:
    tier_upper = str(tier or "").strip().upper()
    return {
        "ACE": "STRONG_BUY",
        "KING": "BUY",
        "QUEEN": "HOLD_TO_BUY",
        "JACK": "WATCHLIST",
    }.get(tier_upper, "NEUTRAL")


def _candidate_rank(
    *,
    tier: str,
    sector: str,
    dominant_sectors: list[str],
    tier_rank: Optional[int],
) -> tuple[float, int, str]:
    tier_upper = str(tier or "").strip().upper()
    sector_clean = str(sector or "").strip()
    score = float(TIER_WEIGHTS.get(tier_upper, 0.5))
    if dominant_sectors:
        if sector_clean == dominant_sectors[0]:
            score += 0.22
        elif sector_clean in dominant_sectors:
            score += 0.12
    tie_breaker = tier_rank if isinstance(tier_rank, int) else 999_999
    return (score, -tie_breaker, tier_upper)


def _build_pick_rationale(*, tier: str, sector: str, dominant_sector: Optional[str]) -> str:
    tier_upper = str(tier or "").strip().upper() or "UNRANKED"
    if dominant_sector and sector and sector == dominant_sector:
        return (
            f"{tier_upper} tier candidate with sector alignment to your existing portfolio "
            f"({sector})."
        )
    if sector:
        return f"{tier_upper} tier candidate with resilient fundamentals in {sector}."
    return f"{tier_upper} tier candidate from the Renaissance investable universe."


@router.post("/portfolio/import", response_model=PortfolioImportResponse)
async def import_portfolio(
    file: UploadFile,
    user_id: str = Form(..., description="User's ID"),
    token_data: dict = Depends(require_vault_owner_token),
) -> PortfolioImportResponse:
    """
    Import a brokerage statement and analyze the portfolio.

    Accepts CSV or PDF files from major brokerages:
    - Charles Schwab
    - Fidelity
    - Robinhood
    - Generic CSV format

    **Process**:
    1. Parse the file to extract holdings
    2. Derive KPIs (risk bucket, sector allocation, etc.)
    3. Store KPIs in user's world model
    4. Return summary with losers and winners

    **Authentication**: Requires valid VAULT_OWNER token.
    The token proves both identity (user_id) and consent (vault unlocked).

    **Example Response**:
    ```json
    {
        "success": true,
        "holdings_count": 15,
        "total_value": 125000.00,
        "losers": [
            {"symbol": "NFLX", "name": "Netflix", "gain_loss_pct": -15.5, "gain_loss": -2500.00}
        ],
        "winners": [
            {"symbol": "NVDA", "name": "NVIDIA", "gain_loss_pct": 45.2, "gain_loss": 8500.00}
        ],
        "kpis_stored": ["holdings_count", "risk_bucket", "sector_allocation"],
        "source": "schwab"
    }
    ```
    """
    # Verify user_id matches token (consent-first: token contains user_id)
    if token_data["user_id"] != user_id:
        logger.warning(f"User ID mismatch: token={token_data['user_id']}, request={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Check file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Import portfolio
    service = get_portfolio_import_service()
    result: ImportResult = await service.import_file(
        user_id=user_id,
        file_content=content,
        filename=file.filename,
    )

    if (
        not result.success
        and result.error
        and "does not appear to be a brokerage statement" in result.error.lower()
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "IRRELEVANT_CONTENT",
                "message": result.error,
            },
        )

    return PortfolioImportResponse(
        success=result.success,
        holdings_count=result.holdings_count,
        total_value=result.total_value,
        losers=result.losers,
        winners=result.winners,
        kpis_stored=result.kpis_stored,
        error=result.error,
        source=result.source,
        # Comprehensive financial data
        portfolio_data=result.portfolio_data,
        account_info=result.account_info,
        account_summary=result.account_summary,
        asset_allocation=result.asset_allocation,
        income_summary=result.income_summary,
        realized_gain_loss=result.realized_gain_loss,
        transactions=result.transactions,
        cash_balance=result.cash_balance,
    )


@router.get("/portfolio/summary/{user_id}", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    user_id: str,
    token_data: dict = Depends(require_vault_owner_token),
) -> PortfolioSummaryResponse:
    """
    Get portfolio summary from world model (without decrypting holdings).

    Returns KPIs derived from the user's imported portfolio.

    **Authentication**: Requires valid VAULT_OWNER token matching user_id.
    """
    # Verify user_id matches token (consent-first: token contains user_id)
    if token_data["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Get portfolio summary from world_model_index_v2 (no decryption)
    world_model = get_world_model_service()
    index = await world_model.get_index_v2(user_id)
    if index is None or "financial" not in index.available_domains:
        return PortfolioSummaryResponse(
            user_id=user_id,
            has_portfolio=False,
        )
    summary = index.domain_summaries.get("financial") or {}
    has_portfolio = summary.get("has_portfolio", False)
    if isinstance(has_portfolio, str):
        has_portfolio = has_portfolio == "true" or has_portfolio == "1"
    holdings_count = summary.get("holdings_count")
    if holdings_count is not None:
        holdings_count = int(holdings_count)
    losers_count = summary.get("losers_count")
    if losers_count is not None:
        losers_count = int(losers_count)
    winners_count = summary.get("winners_count")
    if winners_count is not None:
        winners_count = int(winners_count)
    total_gain_loss_pct = summary.get("total_gain_loss_pct")
    if total_gain_loss_pct is not None:
        total_gain_loss_pct = float(total_gain_loss_pct)
    return PortfolioSummaryResponse(
        user_id=user_id,
        has_portfolio=bool(has_portfolio),
        holdings_count=holdings_count,
        portfolio_value_bucket=summary.get("portfolio_value_bucket"),
        risk_bucket=summary.get("risk_bucket"),
        losers_count=losers_count,
        winners_count=winners_count,
        total_gain_loss_pct=total_gain_loss_pct,
    )


@router.get("/dashboard/profile-picks/{user_id}", response_model=DashboardProfilePicksResponse)
async def get_dashboard_profile_picks(
    user_id: str,
    symbols: Optional[str] = Query(
        default=None,
        description="Optional comma-separated ticker symbols from current holdings context.",
    ),
    limit: int = Query(default=4, ge=1, le=_MAX_PROFILE_PICKS),
    token_data: dict = Depends(require_vault_owner_token),
) -> DashboardProfilePicksResponse:
    """
    Build profile-based dashboard picks from real user context.

    Source blend:
    - User profile/risk from `world_model_index_v2.domain_summaries.financial`
    - Existing holdings symbols from caller-provided decrypted symbols context
    - Renaissance investable universe tiers
    - Live quote/sector context via `fetch_market_data`

    No synthetic placeholders are returned.
    """
    if token_data["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match token",
        )

    requested_symbols = _normalize_symbols_query(symbols)
    requested_limit = max(1, min(int(limit), _MAX_PROFILE_PICKS))
    consent_token = str(token_data.get("token") or "")

    world_model = get_world_model_service()
    index = await world_model.get_index_v2(user_id)
    domain_summaries = index.domain_summaries if index and index.domain_summaries else {}
    financial_summary = (
        domain_summaries.get("financial")
        if isinstance(domain_summaries.get("financial"), dict)
        else {}
    )
    risk_profile = _normalize_risk_profile(
        financial_summary.get("risk_profile") or financial_summary.get("profile_risk_profile")
    )
    allowed_tiers = _allowed_tiers_for_risk(risk_profile)
    holdings_count = int(
        _coerce_optional_number(
            financial_summary.get("holdings_count")
            or financial_summary.get("attribute_count")
            or financial_summary.get("item_count")
        )
        or 0
    )

    from hushh_mcp.operons.kai.fetchers import fetch_market_data

    holdings_sector_counter: Counter[str] = Counter()
    if requested_symbols:
        sector_sem = asyncio.Semaphore(4)

        async def resolve_holding_sector(symbol: str) -> Optional[str]:
            async with sector_sem:
                try:
                    quote = await fetch_market_data(symbol, user_id, consent_token)
                    sector = str(quote.get("sector") or "").strip()
                    return sector or None
                except Exception as exc:
                    logger.warning(
                        "[Kai Picks] failed to resolve holding sector for %s (%s): %s",
                        symbol,
                        user_id,
                        exc,
                    )
                    return None

        sector_rows = await asyncio.gather(
            *(resolve_holding_sector(symbol) for symbol in requested_symbols)
        )
        for sector in sector_rows:
            if sector:
                holdings_sector_counter[sector] += 1

    dominant_sectors = [sector for sector, _ in holdings_sector_counter.most_common(2)]
    dominant_sector = dominant_sectors[0] if dominant_sectors else None

    renaissance_service = get_renaissance_service()
    tier_results = await asyncio.gather(
        *(renaissance_service.get_by_tier(tier) for tier in allowed_tiers),
        return_exceptions=True,
    )
    owned_symbols = set(requested_symbols)
    candidate_by_symbol: dict[str, Any] = {}
    for tier_value, result in zip(allowed_tiers, tier_results, strict=False):
        if isinstance(result, Exception):
            logger.warning("[Kai Picks] Renaissance tier fetch failed (%s): %s", tier_value, result)
            continue
        for stock in result:
            symbol_key = str(getattr(stock, "ticker", "") or "").strip().upper()
            if not symbol_key or symbol_key in owned_symbols or symbol_key in candidate_by_symbol:
                continue
            candidate_by_symbol[symbol_key] = stock

    ranked_candidates = sorted(
        candidate_by_symbol.values(),
        key=lambda stock: _candidate_rank(
            tier=str(getattr(stock, "tier", "")),
            sector=str(getattr(stock, "sector", "")),
            dominant_sectors=dominant_sectors,
            tier_rank=getattr(stock, "tier_rank", None),
        ),
        reverse=True,
    )
    candidate_pool = ranked_candidates[: max(requested_limit * 3, requested_limit)]

    quote_sem = asyncio.Semaphore(4)

    async def enrich_candidate(stock: Any) -> DashboardProfilePick:
        symbol_value = str(getattr(stock, "ticker", "") or "").strip().upper()
        company_name = str(getattr(stock, "company_name", "") or symbol_value)
        tier_value = str(getattr(stock, "tier", "") or "").strip().upper() or None
        sector_value = str(getattr(stock, "sector", "") or "").strip() or None
        conviction_weight = float(TIER_WEIGHTS.get(tier_value or "", 0.5))
        recommendation_bias = _recommendation_bias_from_tier(tier_value or "")

        quote_payload: dict[str, Any] = {}
        degraded = False
        source_tags = ["Renaissance"]
        async with quote_sem:
            try:
                quote_payload = await fetch_market_data(symbol_value, user_id, consent_token)
                source_name = str(quote_payload.get("source") or "").strip()
                if source_name:
                    source_tags.append(source_name)
            except Exception as exc:
                degraded = True
                source_tags.append("Quote unavailable")
                logger.warning("[Kai Picks] quote fetch failed for %s: %s", symbol_value, exc)

        return DashboardProfilePick(
            symbol=symbol_value,
            company_name=company_name,
            sector=sector_value,
            tier=tier_value,
            conviction_weight=round(conviction_weight, 4),
            price=_coerce_optional_number(quote_payload.get("price")),
            change_percent=_coerce_optional_number(quote_payload.get("change_percent")),
            recommendation_bias=recommendation_bias,
            rationale=_build_pick_rationale(
                tier=tier_value or "UNRANKED",
                sector=sector_value or "",
                dominant_sector=dominant_sector,
            ),
            source_tags=source_tags,
            degraded=degraded,
            as_of=str(quote_payload.get("fetched_at") or _now_utc_iso()),
        )

    enriched = await asyncio.gather(*(enrich_candidate(stock) for stock in candidate_pool))
    picks = enriched[:requested_limit]

    context_payload = {
        "requested_symbol_count": len(requested_symbols),
        "holdings_count_index": holdings_count,
        "dominant_sectors": dominant_sectors,
        "allowed_tiers": list(allowed_tiers),
        "candidate_pool_size": len(candidate_pool),
    }

    return DashboardProfilePicksResponse(
        user_id=user_id,
        generated_at=_now_utc_iso(),
        risk_profile=risk_profile,
        picks=picks,
        context=context_payload,
    )


@router.post("/portfolio/import/stream")
async def import_portfolio_stream(
    request: Request,
    file: UploadFile,
    user_id: str = Form(..., description="User's ID"),
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    SSE streaming endpoint for portfolio import with real-time progress.

    Streams Gemini parsing progress as Server-Sent Events (SSE).
    Uses Gemini 3 Flash thinking mode for visible AI reasoning.

    **Event Types (canonical)**:
    - `stage`: Current processing stage + heartbeat metadata
    - `thinking`: Best-effort thought summaries
    - `chunk`: Streamed JSON text chunks from extraction
    - `aborted`: Graceful terminal halt (e.g., irrelevant content)
    - `complete`: Final parsed portfolio payload
    - `error`: Structured terminal error payload

    **Authentication**: Requires valid VAULT_OWNER token.

    **Disconnection Handling (Production-Grade)**:
    - Layer 1: sse_starlette ping every 15s detects dead connections (app crash, force-close)
    - Layer 2: asyncio.timeout(180) hard ceiling prevents runaway LLM calls
    - Layer 3: backend heartbeats every 3-5s while waiting for model output
    - Layer 4: request.is_disconnected() checked per-chunk for fast cleanup
    """
    # Verify user_id matches token
    if token_data["user_id"] != user_id:
        logger.warning(f"User ID mismatch: token={token_data['user_id']}, request={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    filename_lower = file.filename.lower()
    content_type = (file.content_type or "").lower()
    is_csv_upload = filename_lower.endswith(".csv") or "csv" in content_type
    is_pdf_upload = filename_lower.endswith(".pdf") or "pdf" in content_type
    if not (is_pdf_upload or is_csv_upload):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a PDF or CSV statement.",
        )

    # Read file content
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    async def event_generator():
        """Generate SSE events for streaming portfolio parsing with Gemini thinking."""
        HARD_TIMEOUT_SECONDS = PORTFOLIO_IMPORT_TIMEOUT_SECONDS
        stream = CanonicalSSEStream("portfolio_import")

        from google import genai
        from google.genai import types
        from google.genai.types import HttpOptions

        from hushh_mcp.constants import GEMINI_MODEL

        thinking_enabled = True

        try:
            async with asyncio.timeout(HARD_TIMEOUT_SECONDS):
                # Stage 1: Uploading
                yield stream.event(
                    "stage",
                    {
                        "stage": "uploading",
                        "message": "Processing uploaded file...",
                    },
                )
                await asyncio.sleep(0.1)  # Small delay for UI feedback

                # SDK auto-configures from GOOGLE_API_KEY and GOOGLE_GENAI_USE_VERTEXAI env vars
                client = genai.Client(http_options=HttpOptions(api_version="v1"))
                model_to_use = GEMINI_MODEL
                logger.info(f"SSE: Using Vertex AI with model {model_to_use}")

                # Stage 2: Indexing
                yield stream.event(
                    "stage",
                    {
                        "stage": "indexing",
                        "message": "Indexing document structure...",
                    },
                )

                import_service = get_portfolio_import_service()
                relevance = await import_service.assess_document_relevance(
                    file_content=content,
                    filename=file.filename or "uploaded_document",
                )
                if not relevance.is_relevant:
                    logger.info(
                        "[Portfolio Import] Rejected irrelevant upload (confidence=%.3f, source=%s)",
                        relevance.confidence,
                        relevance.source,
                    )
                    yield stream.event(
                        "aborted",
                        {
                            "code": "IRRELEVANT_CONTENT",
                            "reason": "irrelevant_content",
                            "message": (
                                "Uploaded document does not look like a brokerage statement. "
                                "Please upload a brokerage account PDF/CSV statement."
                            ),
                            "doc_type": relevance.doc_type,
                            "confidence": relevance.confidence,
                            "classifier_source": relevance.source,
                            "classifier_reason": relevance.reason,
                        },
                        terminal=True,
                    )
                    return

                # Keep prompt concise for lower latency and better stream yield behavior.
                prompt = """Extract this brokerage statement to JSON only.

Return one JSON object with keys:
- account_metadata
- portfolio_summary
- asset_allocation
- detailed_holdings
- historical_values
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
- For each holding, include `asset_type` and `sector` whenever present in the statement.
- Preserve numeric values exactly (including negatives)."""

                # Create content payload with source-aware MIME type.
                upload_mime_type = "text/csv" if is_csv_upload else "application/pdf"
                contents = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=content, mime_type=upload_mime_type),
                ]

                config_kwargs: dict[str, Any] = {
                    "temperature": 0.1,
                    "max_output_tokens": 12288,
                    "automatic_function_calling": types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                }
                if thinking_enabled:
                    config_kwargs["thinking_config"] = types.ThinkingConfig(
                        include_thoughts=True,
                        thinking_level=types.ThinkingLevel.MEDIUM,
                    )
                    logger.info("SSE: Thinking mode enabled for token-level reasoning stream")
                else:
                    logger.info("SSE: Thinking mode disabled for stable streaming throughput")

                config = types.GenerateContentConfig(**config_kwargs)

                # Stage 3: Scanning (real runtime milestone: handoff to model stream request)
                yield stream.event(
                    "stage",
                    {
                        "stage": "scanning",
                        "message": "Submitting statement to Vertex model...",
                    },
                )

                full_response = ""
                chunk_count = 0
                thought_count = 0
                current_stream_stage: str = "scanning"
                thinking_stage_emitted = False
                extracting_stage_emitted = False
                streamed_holdings_estimate = 0
                latest_live_holdings_preview: list[dict[str, Any]] = []
                stream_started_at = asyncio.get_running_loop().time()
                last_extract_progress_emit_at = stream_started_at

                def extraction_progress_from_chunks(chunks: int) -> float | None:
                    if chunks <= 0:
                        return None
                    return min(
                        80.0,
                        35.0 + min(45.0, math.log1p(max(chunks, 1)) * 12.0),
                    )

                # Use official Gemini streaming API with thinking support
                gen_stream = await client.aio.models.generate_content_stream(
                    model=model_to_use,
                    contents=contents,
                    config=config,
                )

                client_disconnected = False

                stream_iter = gen_stream.__aiter__()
                next_chunk_task: asyncio.Task | None = None
                while True:
                    # Check for disconnection after each chunk
                    if await request.is_disconnected():
                        logger.info(
                            "[Portfolio Import] Client disconnected, stopping streaming — saving compute"
                        )
                        client_disconnected = True
                        if next_chunk_task and not next_chunk_task.done():
                            next_chunk_task.cancel()
                        break

                    try:
                        if next_chunk_task is None:
                            next_chunk_task = asyncio.create_task(stream_iter.__anext__())
                        chunk = await asyncio.wait_for(
                            asyncio.shield(next_chunk_task),
                            timeout=HEARTBEAT_INTERVAL_SECONDS,
                        )
                        next_chunk_task = None
                    except asyncio.TimeoutError:
                        elapsed = int(asyncio.get_running_loop().time() - stream_started_at)
                        heartbeat_stage = current_stream_stage
                        if heartbeat_stage == "extracting":
                            heartbeat_message = (
                                f"Streaming extracted JSON payload... ({elapsed}s elapsed)"
                            )
                        elif heartbeat_stage == "thinking":
                            heartbeat_message = f"Model is still reasoning over account sections... ({elapsed}s elapsed)"
                        else:
                            heartbeat_message = (
                                f"Awaiting first model tokens... ({elapsed}s elapsed)"
                            )
                        yield stream.event(
                            "stage",
                            {
                                "stage": heartbeat_stage,
                                "message": heartbeat_message,
                                "heartbeat": True,
                                "elapsed_seconds": elapsed,
                                "chunk_count": chunk_count,
                                "total_chars": len(full_response),
                                **(
                                    {"progress_pct": extraction_progress_from_chunks(chunk_count)}
                                    if heartbeat_stage == "extracting"
                                    and extraction_progress_from_chunks(chunk_count) is not None
                                    else {}
                                ),
                            },
                        )
                        continue
                    except StopAsyncIteration:
                        next_chunk_task = None
                        break

                    # Handle chunks with thinking support
                    appended_response_text = False
                    if hasattr(chunk, "candidates") and chunk.candidates:
                        candidate = chunk.candidates[0]
                        if hasattr(candidate, "content") and candidate.content:
                            parts = getattr(candidate.content, "parts", None) or []
                            for part in parts:
                                if not hasattr(part, "text") or not part.text:
                                    continue

                                # Check if this is a thought (reasoning) or actual response
                                is_thought = hasattr(part, "thought") and part.thought

                                if is_thought:
                                    # Stream thought summary to frontend
                                    thought_count += 1
                                    current_stream_stage = "thinking"
                                    if not thinking_stage_emitted:
                                        thinking_stage_emitted = True
                                        yield stream.event(
                                            "stage",
                                            {
                                                "stage": "thinking",
                                                "message": "Reasoning through account sections...",
                                            },
                                        )
                                    yield stream.event(
                                        "thinking",
                                        {
                                            "thought": part.text,
                                            "count": thought_count,
                                            "token_source": "thought",
                                            "message": "Reasoning through account sections...",
                                        },
                                    )
                                else:
                                    # This is the actual JSON response
                                    if not extracting_stage_emitted:
                                        extracting_stage_emitted = True
                                        current_stream_stage = "extracting"
                                        yield stream.event(
                                            "stage",
                                            {
                                                "stage": "extracting",
                                                "message": "Extracting financial data...",
                                            },
                                        )

                                    full_response += part.text
                                    chunk_count += 1
                                    appended_response_text = True
                                    streamed_holdings_estimate = max(
                                        streamed_holdings_estimate,
                                        _estimate_stream_holdings(full_response),
                                    )
                                    latest_live_holdings_preview = (
                                        _extract_live_holdings_preview_from_text(
                                            full_response, max_items=40
                                        )
                                    )

                                    # Stream extraction progress
                                    yield stream.event(
                                        "chunk",
                                        {
                                            "text": part.text,
                                            "total_chars": len(full_response),
                                            "chunk_count": chunk_count,
                                            "holdings_detected": streamed_holdings_estimate,
                                            "holdings_preview": latest_live_holdings_preview,
                                            "token_source": "response",
                                            "progress_pct": extraction_progress_from_chunks(
                                                chunk_count
                                            ),
                                        },
                                    )
                                    now = asyncio.get_running_loop().time()
                                    if (
                                        chunk_count > 1
                                        and (now - last_extract_progress_emit_at)
                                        >= HEARTBEAT_INTERVAL_SECONDS
                                    ):
                                        last_extract_progress_emit_at = now
                                        yield stream.event(
                                            "progress",
                                            {
                                                "phase": "extracting",
                                                "message": (
                                                    "Streaming response: "
                                                    f"{chunk_count} chunks, {len(full_response):,} chars"
                                                ),
                                                "chunk_count": chunk_count,
                                                "total_chars": len(full_response),
                                                "progress_pct": extraction_progress_from_chunks(
                                                    chunk_count
                                                ),
                                            },
                                        )

                    # Fallback for response shapes where chunk.text is populated even if candidates exist.
                    if not appended_response_text and getattr(chunk, "text", None):
                        if not extracting_stage_emitted:
                            extracting_stage_emitted = True
                            current_stream_stage = "extracting"
                            yield stream.event(
                                "stage",
                                {
                                    "stage": "extracting",
                                    "message": "Extracting financial data...",
                                },
                            )

                        text_chunk = chunk.text
                        full_response += text_chunk
                        chunk_count += 1
                        streamed_holdings_estimate = max(
                            streamed_holdings_estimate,
                            _estimate_stream_holdings(full_response),
                        )
                        latest_live_holdings_preview = _extract_live_holdings_preview_from_text(
                            full_response, max_items=40
                        )
                        yield stream.event(
                            "chunk",
                            {
                                "text": text_chunk,
                                "total_chars": len(full_response),
                                "chunk_count": chunk_count,
                                "holdings_detected": streamed_holdings_estimate,
                                "holdings_preview": latest_live_holdings_preview,
                                "token_source": "response",
                                "progress_pct": extraction_progress_from_chunks(chunk_count),
                            },
                        )
                        now = asyncio.get_running_loop().time()
                        if (
                            chunk_count > 1
                            and (now - last_extract_progress_emit_at) >= HEARTBEAT_INTERVAL_SECONDS
                        ):
                            last_extract_progress_emit_at = now
                            yield stream.event(
                                "progress",
                                {
                                    "phase": "extracting",
                                    "message": (
                                        "Streaming response: "
                                        f"{chunk_count} chunks, {len(full_response):,} chars"
                                    ),
                                    "chunk_count": chunk_count,
                                    "total_chars": len(full_response),
                                    "progress_pct": extraction_progress_from_chunks(chunk_count),
                                },
                            )

                # Skip all post-processing if client disconnected — no point parsing for nobody
                if client_disconnected:
                    logger.info(
                        "[Portfolio Import] Skipping post-processing, client gone — LLM compute saved"
                    )
                    return

                # Strict LLM streaming only: no secondary generation fallback.
                if not full_response.strip():
                    raise ValueError("Empty model response from streaming call")

                # Final extraction complete
                yield stream.event(
                    "stage",
                    {
                        "stage": "extracting",
                        "message": "Extraction stream complete",
                        "total_chars": len(full_response),
                        "chunk_count": chunk_count,
                        "thought_count": thought_count,
                        "holdings_detected": streamed_holdings_estimate,
                        "holdings_preview": latest_live_holdings_preview,
                        **(
                            {"progress_pct": extraction_progress_from_chunks(chunk_count)}
                            if extraction_progress_from_chunks(chunk_count) is not None
                            else {}
                        ),
                    },
                )

                # Stage 4: Parsing
                yield stream.event(
                    "stage",
                    {
                        "stage": "parsing",
                        "message": "Processing extracted data...",
                    },
                )

                # Parse JSON from response
                parse_diagnostics: dict[str, Any] = {}
                try:
                    parsed_data, parse_diagnostics = parse_json_with_single_repair(full_response)
                    detailed_holdings, holdings_source = _extract_holdings_list(parsed_data)
                    parsed_data["detailed_holdings"] = detailed_holdings
                    if holdings_source != "detailed_holdings":
                        yield stream.event(
                            "warning",
                            {
                                "code": "HOLDINGS_ALIAS_USED",
                                "message": (
                                    "Structured holdings were recovered from an alternative field."
                                    if holdings_source != "none"
                                    else "No holdings array found in model output; continuing with empty holdings."
                                ),
                                "source_field": holdings_source,
                                "holdings_count": len(detailed_holdings),
                            },
                        )

                    # Transform Gemini response to match frontend expected structure
                    account_metadata_raw = parsed_data.get("account_metadata")
                    account_metadata = (
                        account_metadata_raw if isinstance(account_metadata_raw, dict) else {}
                    )
                    account_info = {
                        "holder_name": account_metadata.get("account_holder"),
                        "account_number": account_metadata.get("account_number"),
                        "account_type": account_metadata.get("account_type"),
                        "brokerage_name": account_metadata.get("institution_name"),
                        "statement_period_start": account_metadata.get("statement_period_start"),
                        "statement_period_end": account_metadata.get("statement_period_end"),
                    }

                    portfolio_summary_raw = parsed_data.get("portfolio_summary")
                    portfolio_summary = (
                        portfolio_summary_raw if isinstance(portfolio_summary_raw, dict) else {}
                    )
                    account_summary = {
                        "beginning_value": _coerce_optional_number(
                            portfolio_summary.get("beginning_value")
                        ),
                        "ending_value": _coerce_optional_number(
                            portfolio_summary.get("ending_value")
                        ),
                        "change_in_value": _coerce_optional_number(
                            portfolio_summary.get("total_change")
                        ),
                        "cash_balance": _coerce_optional_number(parsed_data.get("cash_balance"))
                        or 0.0,
                        "net_deposits_withdrawals": _coerce_optional_number(
                            portfolio_summary.get("net_deposits_withdrawals")
                        ),
                        "investment_gain_loss": _coerce_optional_number(
                            portfolio_summary.get("investment_gain_loss")
                        ),
                    }

                    detailed_holdings_raw = parsed_data.get("detailed_holdings")
                    detailed_holdings = (
                        detailed_holdings_raw if isinstance(detailed_holdings_raw, list) else []
                    )
                    normalized_holdings: list[dict[str, Any]] = []
                    parsed_total = len(detailed_holdings)
                    if parsed_total > 0:
                        yield stream.event(
                            "progress",
                            {
                                "phase": "parsing",
                                "message": f"Normalizing {parsed_total} extracted holdings...",
                                "holdings_extracted": 0,
                                "holdings_total": parsed_total,
                                "holdings_raw_count": parsed_total,
                                "holdings_preview": [],
                                "progress_pct": 82,
                            },
                        )
                    for idx, h in enumerate(detailed_holdings):
                        if await request.is_disconnected():
                            logger.info(
                                "[Portfolio Import] Client disconnected during parsing, stopping stream cleanup"
                            )
                            return
                        if not isinstance(h, dict):
                            logger.warning(
                                "[Portfolio Import] Skipping non-dict holding row at index %s: %r",
                                idx,
                                type(h).__name__,
                            )
                            continue
                        normalized = _normalize_raw_holding_row(h, idx)
                        normalized_holdings.append(normalized)

                        if parsed_total <= 10 or (idx + 1) == parsed_total or (idx + 1) % 5 == 0:
                            yield stream.event(
                                "progress",
                                {
                                    "phase": "parsing",
                                    "message": (
                                        f"Parsed {idx + 1} of {parsed_total} holdings"
                                        if parsed_total > 0
                                        else "Parsing holdings..."
                                    ),
                                    "holdings_extracted": idx + 1,
                                    "holdings_total": parsed_total,
                                    "holdings_raw_count": parsed_total,
                                    "holdings_preview": _build_holdings_preview(
                                        normalized_holdings, max_items=40
                                    ),
                                    "progress_pct": 82
                                    + min(16.0, ((idx + 1) / max(parsed_total, 1)) * 16.0),
                                },
                            )

                    # ---- Validation pass: reject hallucinated or incomplete entries ----
                    raw_count = len(normalized_holdings)
                    reconciled_count = 0
                    mismatch_count = 0
                    dropped_reasons: Counter[str] = Counter()
                    validated_holdings: list[dict[str, Any]] = []
                    for row in normalized_holdings:
                        is_valid, reason = _validate_holding_row(row)
                        if not is_valid:
                            dropped_reasons[reason or "unknown"] += 1
                            continue

                        reconciliation = row.get("reconciliation")
                        if isinstance(reconciliation, dict):
                            if reconciliation.get("reconciled_fields"):
                                reconciled_count += 1
                            if reconciliation.get("mismatch_detected"):
                                mismatch_count += 1

                        validated_holdings.append(row)

                    holdings = _aggregate_holdings_by_symbol(validated_holdings)
                    duplicate_symbol_lot_count = max(0, len(validated_holdings) - len(holdings))
                    unknown_name_count = sum(
                        1 for row in holdings if _is_unknown_name(row.get("name"))
                    )
                    placeholder_symbol_count = sum(
                        1 for row in holdings if str(row.get("symbol") or "").startswith("HOLDING_")
                    )
                    zero_qty_zero_price_nonzero_value_count = sum(
                        1
                        for row in holdings
                        if (
                            (_coerce_optional_number(row.get("quantity")) or 0.0) == 0.0
                            and (_coerce_optional_number(row.get("price")) or 0.0) == 0.0
                            and (_coerce_optional_number(row.get("market_value")) or 0.0) > 0.0
                        )
                    )
                    account_header_row_count = dropped_reasons.get("account_header_row", 0)
                    logger.info(
                        "[Portfolio Validation] Validated %s/%s holdings (aggregated=%s)",
                        len(validated_holdings),
                        raw_count,
                        len(holdings),
                    )

                    # Calculate total_value if not provided
                    total_value = _coerce_optional_number(parsed_data.get("total_value")) or 0.0
                    if not total_value and account_summary.get("ending_value"):
                        total_value = account_summary["ending_value"] or 0.0
                    if not total_value and holdings:
                        total_value = sum(
                            _coerce_optional_number(h.get("market_value")) or 0 for h in holdings
                        )

                    quality_report = _build_holdings_quality_report(
                        raw_count=raw_count,
                        validated_count=len(validated_holdings),
                        aggregated_count=len(holdings),
                        dropped_reasons=dropped_reasons,
                        reconciled_count=reconciled_count,
                        mismatch_count=mismatch_count,
                        parse_diagnostics=parse_diagnostics,
                        unknown_name_count=unknown_name_count,
                        placeholder_symbol_count=placeholder_symbol_count,
                        zero_qty_zero_price_nonzero_value_count=zero_qty_zero_price_nonzero_value_count,
                        account_header_row_count=account_header_row_count,
                        duplicate_symbol_lot_count=duplicate_symbol_lot_count,
                        average_confidence=(
                            round(
                                sum(
                                    _coerce_optional_number(row.get("confidence")) or 0.0
                                    for row in holdings
                                )
                                / max(len(holdings), 1),
                                4,
                            )
                            if holdings
                            else 0.0
                        ),
                    )

                    yield stream.event(
                        "progress",
                        {
                            "phase": "parsing",
                            "message": (
                                f"Validated {len(validated_holdings)} holdings and aggregated into {len(holdings)} symbols"
                            ),
                            "holdings_extracted": len(validated_holdings),
                            "holdings_total": parsed_total,
                            "holdings_raw_count": raw_count,
                            "holdings_validated_count": len(validated_holdings),
                            "holdings_aggregated_count": len(holdings),
                            "holdings_dropped_reasons": dict(dropped_reasons),
                            "holdings_preview": _build_holdings_preview(holdings, max_items=40),
                            "progress_pct": 98,
                        },
                    )

                    # Build portfolio_data structure for frontend
                    portfolio_data = {
                        "account_info": account_info,
                        "account_summary": account_summary,
                        "asset_allocation": parsed_data.get("asset_allocation"),
                        "holdings": holdings,
                        "income_summary": parsed_data.get("income_summary"),
                        "realized_gain_loss": parsed_data.get("realized_gain_loss"),
                        "cash_flow": parsed_data.get("cash_flow"),
                        "cash_management": parsed_data.get("cash_management"),
                        "projections_and_mrd": parsed_data.get("projections_and_mrd"),
                        "historical_values": parsed_data.get("historical_values"),
                        "ytd_metrics": parsed_data.get("ytd_metrics"),
                        "legal_and_disclosures": parsed_data.get("legal_and_disclosures"),
                        "cash_balance": _coerce_optional_number(parsed_data.get("cash_balance"))
                        or 0.0,
                        "total_value": total_value,
                        "quality_report": quality_report,
                        "kpis": {
                            "holdings_count": len(holdings),
                            "total_value": total_value,
                        },
                    }

                    logger.info(
                        f"SSE: Transformed portfolio data - {len(holdings)} holdings, total_value={total_value}"
                    )

                    # Stage 5: Complete
                    yield stream.event(
                        "complete",
                        {
                            "portfolio_data": portfolio_data,
                            "success": True,
                            "thought_count": thought_count,
                            "holdings_raw_count": raw_count,
                            "holdings_validated_count": len(validated_holdings),
                            "holdings_aggregated_count": len(holdings),
                            "holdings_dropped_reasons": dict(dropped_reasons),
                        },
                        terminal=True,
                    )

                except Exception as parse_error:
                    logger.error(f"JSON parse error: {parse_error}")
                    fallback_rows = _extract_live_holdings_preview_from_text(
                        full_response, max_items=240
                    )
                    if fallback_rows:
                        normalized_holdings: list[dict[str, Any]] = []
                        for idx, row in enumerate(fallback_rows):
                            if not isinstance(row, dict):
                                continue
                            normalized_holdings.append(_normalize_raw_holding_row(row, idx))

                        dropped_reasons: Counter[str] = Counter()
                        validated_holdings: list[dict[str, Any]] = []
                        for row in normalized_holdings:
                            is_valid, reason = _validate_holding_row(row)
                            if not is_valid:
                                dropped_reasons[reason or "unknown"] += 1
                                continue
                            validated_holdings.append(row)

                        holdings = _aggregate_holdings_by_symbol(validated_holdings)
                        total_value = sum(
                            _coerce_optional_number(h.get("market_value")) or 0.0 for h in holdings
                        )
                        quality_report = _build_holdings_quality_report(
                            raw_count=len(normalized_holdings),
                            validated_count=len(validated_holdings),
                            aggregated_count=len(holdings),
                            dropped_reasons=dropped_reasons,
                            reconciled_count=0,
                            mismatch_count=0,
                            parse_diagnostics={
                                **parse_diagnostics,
                                "fallback_from_stream_text": True,
                            },
                            unknown_name_count=sum(
                                1 for row in holdings if _is_unknown_name(row.get("name"))
                            ),
                            placeholder_symbol_count=sum(
                                1
                                for row in holdings
                                if str(row.get("symbol") or "").startswith("HOLDING_")
                            ),
                            zero_qty_zero_price_nonzero_value_count=sum(
                                1
                                for row in holdings
                                if (
                                    (_coerce_optional_number(row.get("quantity")) or 0.0) == 0.0
                                    and (_coerce_optional_number(row.get("price")) or 0.0) == 0.0
                                    and (_coerce_optional_number(row.get("market_value")) or 0.0)
                                    > 0.0
                                )
                            ),
                            account_header_row_count=dropped_reasons.get("account_header_row", 0),
                            duplicate_symbol_lot_count=max(
                                0, len(validated_holdings) - len(holdings)
                            ),
                            average_confidence=(
                                round(
                                    sum(
                                        _coerce_optional_number(row.get("confidence")) or 0.0
                                        for row in holdings
                                    )
                                    / max(len(holdings), 1),
                                    4,
                                )
                                if holdings
                                else 0.0
                            ),
                        )

                        yield stream.event(
                            "warning",
                            {
                                "code": "IMPORT_PARSE_FALLBACK_USED",
                                "message": "Structured parse failed; recovered holdings from stream text.",
                                "holdings_count": len(holdings),
                            },
                        )
                        yield stream.event(
                            "complete",
                            {
                                "portfolio_data": {
                                    "account_info": {},
                                    "account_summary": {
                                        "beginning_value": None,
                                        "ending_value": total_value or None,
                                        "change_in_value": None,
                                        "cash_balance": 0.0,
                                        "net_deposits_withdrawals": None,
                                        "investment_gain_loss": None,
                                    },
                                    "asset_allocation": None,
                                    "holdings": holdings,
                                    "income_summary": None,
                                    "realized_gain_loss": None,
                                    "cash_flow": None,
                                    "cash_management": None,
                                    "projections_and_mrd": None,
                                    "historical_values": None,
                                    "ytd_metrics": None,
                                    "legal_and_disclosures": None,
                                    "cash_balance": 0.0,
                                    "total_value": total_value,
                                    "quality_report": quality_report,
                                    "kpis": {
                                        "holdings_count": len(holdings),
                                        "total_value": total_value,
                                    },
                                },
                                "success": True,
                                "parse_fallback": True,
                                "holdings_raw_count": len(normalized_holdings),
                                "holdings_validated_count": len(validated_holdings),
                                "holdings_aggregated_count": len(holdings),
                                "holdings_dropped_reasons": dict(dropped_reasons),
                            },
                            terminal=True,
                        )
                    else:
                        yield stream.event(
                            "error",
                            {
                                "code": "IMPORT_PARSE_FAILED",
                                "message": "Unable to normalize extracted statement output. Please retry.",
                                "diagnostics": {
                                    "response_chars": len(full_response),
                                    "chunk_count": chunk_count,
                                    "parse_repair_actions": parse_diagnostics.get(
                                        "repair_actions", []
                                    ),
                                },
                            },
                            terminal=True,
                        )

            # end of asyncio.timeout context

        except asyncio.TimeoutError:
            logger.warning(
                f"[Portfolio Import] Hard timeout ({HARD_TIMEOUT_SECONDS}s) reached, stopping LLM"
            )
            yield stream.event(
                "error",
                {
                    "code": "IMPORT_TIMEOUT",
                    "message": (
                        f"Portfolio import timed out after {HARD_TIMEOUT_SECONDS}s. "
                        "Please try again with a smaller file."
                    ),
                },
                terminal=True,
            )
        except Exception as e:
            logger.error(f"SSE streaming error: {e}")
            import traceback

            logger.error(traceback.format_exc())
            yield stream.event(
                "error",
                {"code": "IMPORT_STREAM_FAILED", "message": str(e)},
                terminal=True,
            )

    return EventSourceResponse(
        event_generator(),
        ping=15,  # Send ping every 15s — detects dead connections (app crash, force-close, network drop)
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
