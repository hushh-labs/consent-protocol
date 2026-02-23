"""Prompt builders for Kai portfolio import V2."""

from __future__ import annotations


def build_statement_extract_prompt_v2() -> str:
    """Return deterministic top-down extraction prompt for brokerage statements."""
    return """You are extracting a brokerage statement for production portfolio analytics.
Return exactly ONE JSON object, no markdown and no prose.

Top-level keys must be present exactly (snake_case):
- statement_details
- account_metadata
- portfolio_summary
- asset_allocation
- portfolio_detail
- detailed_holdings
- transactions
- reconciliation_summary
- investment_objective
- management_contacts
- derived_metrics
- cash_balance
- total_value

Critical extraction constraints:
1) Strict JSON only:
- valid JSON object only
- no code fences
- no trailing commentary

2) Numeric fidelity:
- preserve sign and decimals exactly from statement text
- parse accounting negatives like "(123.45)" as -123.45
- keep percentages as numeric values (not strings) where possible

3) No fabrication:
- do not invent symbols, CUSIPs, account IDs, sectors, industries, prices, or totals
- if unknown, set null (or empty array/object where structurally required)

4) Holdings vs non-holdings separation:
- detailed_holdings must include only actual position rows
- do NOT include account headers, section titles, or transaction rows as holdings
- include cash/cash-equivalent position rows in detailed_holdings

5) Identifier provenance per holding:
- include as available: symbol, ticker, cusip, symbol_cusip, security_id
- if only one identifier appears in document, preserve it in its native field
- do not synthesize ticker from company name when no ticker is present
- include identifier classification fields per holding (when inferable):
  - symbol_source: one of ["statement_ticker","statement_cusip","statement_security_id","derived_none"]
  - symbol_kind: one of ["us_common_equity_ticker","fund_or_etf_ticker","bond_or_fixed_income_id","cash_identifier","unknown"]
  - is_sec_common_equity_ticker: true/false/null
- for mutual fund, ETF share class, trust, sweep, money market, bond, muni, or cash rows:
  - set is_sec_common_equity_ticker to false
  - do not classify as us_common_equity_ticker
- if only CUSIP/security identifier is present, keep ticker null and fill cusip/security_id.

6) Cash policy in extraction:
- include cash, sweep, money-market, principal cash, income cash rows
- for those rows set:
  - instrument_kind: "cash_equivalent" when inferable
  - is_cash_equivalent: true when inferable
  - is_investable: false when inferable
- include those rows in totals/allocation context

7) Investable classification hints:
- set instrument_kind when inferable: equity, fixed_income, real_asset, cash_equivalent, other
- keep sector/industry null unless explicitly present or clearly inferable from statement labels
- include listing/analysis eligibility hints per holding (when inferable):
  - security_listing_status: one of ["sec_common_equity","non_sec_common_equity","cash_or_sweep","fixed_income","unknown"]
  - analyze_eligible_hint: true only for clear common-equity/ETF tickers; false for cash/sweep/cusip-only/unknown

8) Classification consistency rules (must hold for each holding):
- If symbol_kind == "cash_identifier" OR instrument_kind == "cash_equivalent":
  - security_listing_status = "cash_or_sweep"
  - is_sec_common_equity_ticker = false
  - analyze_eligible_hint = false
- If instrument_kind == "fixed_income" OR symbol_kind == "bond_or_fixed_income_id":
  - security_listing_status = "fixed_income"
  - is_sec_common_equity_ticker = false
- If symbol_kind == "fund_or_etf_ticker":
  - security_listing_status = "non_sec_common_equity"
  - is_sec_common_equity_ticker = false
- If security is a clear U.S. common stock ticker (not ETF/fund/bond/cash):
  - symbol_kind = "us_common_equity_ticker"
  - security_listing_status = "sec_common_equity"
  - is_sec_common_equity_ticker = true
- Never mark both:
  - symbol_kind == "fund_or_etf_ticker" AND security_listing_status == "sec_common_equity"
- Never set analyze_eligible_hint=true for cash_or_sweep, fixed_income, or cusip-only rows.

Expected content by section:
- statement_details:
  institution_name, account_name, account_number (masked if masked), statement_period_start, statement_period_end
- account_metadata:
  account_type, currency, tax_status, registration_type, household/relationship labels if present
- portfolio_summary:
  beginning_value, ending_value, change_in_value, estimated_annual_income, estimated_current_yield
- asset_allocation:
  array of rows with asset_class/category and value and/or percent fields if available
- portfolio_detail:
  section-level grouped holdings if present (retain document grouping)
- detailed_holdings:
  one row per position line with quantity, price, market_value, cost_basis, unrealized_gain_loss,
  unrealized_gain_loss_pct, estimated_annual_income, est_yield, asset_class/asset_type/security_type,
  sector, industry, plus identifier fields and classification hints
- transactions:
  grouped activity lists if present (cash transactions, dividends, purchases, sales, fees, etc.)
- reconciliation_summary:
  market value and cash reconciliation blocks if present
- investment_objective:
  objective text and target allocation ranges if shown
- management_contacts:
  advisor/trust officer/manager names and contact details if shown
- derived_metrics:
  deterministic metrics inferable from extracted rows only (no invented analytics)

Terminal checks before output:
- all required top-level keys exist
- detailed_holdings is non-empty when statement contains positions
- total_value equals statement ending portfolio value when present; otherwise null
- cash_balance extracted from statement cash summary when present; otherwise null
"""
