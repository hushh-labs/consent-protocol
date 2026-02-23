"""Kai portfolio import V2 schema contract definitions."""

from __future__ import annotations

from typing import Any

FINANCIAL_STATEMENT_EXTRACT_V2_REQUIRED_KEYS: set[str] = {
    "statement_details",
    "account_metadata",
    "portfolio_summary",
    "asset_allocation",
    "portfolio_detail",
    "detailed_holdings",
    "transactions",
    "reconciliation_summary",
    "investment_objective",
    "management_contacts",
    "derived_metrics",
    "cash_balance",
    "total_value",
}

FINANCIAL_STATEMENT_EXTRACT_V2_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "statement_details": {"type": "OBJECT"},
        "account_metadata": {"type": "OBJECT"},
        "portfolio_summary": {"type": "OBJECT"},
        "asset_allocation": {"type": "ARRAY", "items": {"type": "OBJECT"}},
        "portfolio_detail": {"type": "OBJECT"},
        "detailed_holdings": {"type": "ARRAY", "items": {"type": "OBJECT"}},
        "transactions": {"type": "OBJECT"},
        "reconciliation_summary": {"type": "OBJECT"},
        "investment_objective": {"type": "OBJECT"},
        "management_contacts": {"type": "OBJECT"},
        "derived_metrics": {"type": "OBJECT"},
        "cash_balance": {"type": "NUMBER"},
        "total_value": {"type": "NUMBER"},
    },
    "required": [
        "statement_details",
        "account_metadata",
        "portfolio_summary",
        "asset_allocation",
        "portfolio_detail",
        "detailed_holdings",
        "transactions",
        "reconciliation_summary",
        "investment_objective",
        "management_contacts",
        "derived_metrics",
        "cash_balance",
        "total_value",
    ],
}
