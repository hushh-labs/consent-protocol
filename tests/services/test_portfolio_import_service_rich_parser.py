"""Tests for RichPDFParser comprehensive JSON normalization."""

from hushh_mcp.services.portfolio_import_service import RichPDFParser


def test_parse_gemini_comprehensive_response_supports_alias_keys_and_list_allocation():
    parser = RichPDFParser()
    payload = {
        "account_metadata": {
            "account_holder": "Ada Investor",
            "account_number": "XXX-12345",
            "institution_name": "Fidelity",
            "account_type": "Individual TOD",
            "statement_period_start": "2026-01-01",
            "statement_period_end": "2026-01-31",
        },
        "portfolio_summary": {
            "beginning_value": "$1,000.00",
            "ending_value": "1,700.50",
            "net_deposits_withdrawals": "(100.00)",
            "total_change": "700.50",
        },
        "asset_allocation": [
            {"category": "Equities", "market_value": "1500", "percentage": "88.2"},
            {"category": "Cash", "market_value": "200.50", "percentage": "11.8"},
        ],
        "detailed_holdings": [
            {
                "symbol_cusip": "AAPL",
                "description": "Apple Inc",
                "quantity": "10",
                "price": "150.00",
                "market_value": "1500.00",
                "cost_basis": "1200.00",
                "unrealized_gain_loss": "300.00",
                "unrealized_gain_loss_pct": "25",
                "asset_class": "stock",
                "estimated_annual_income": "12.5",
                "est_yield": "0.8",
            }
        ],
        "activity_and_transactions": [
            {
                "date": "2026-01-10",
                "transaction_type": "BUY",
                "description": "BUY AAPL",
                "quantity": "10",
                "price": "150",
                "amount": "1500",
            }
        ],
        "income_summary": {
            "taxable_dividends": "15.5",
            "qualified_dividends": "5.1",
            "taxable_interest": "2.0",
            "capital_gains_distributions": "0",
            "total_income": "17.5",
        },
        "realized_gain_loss": {
            "short_term_gain": "10",
            "short_term_loss": "(2)",
            "long_term_gain": "5",
            "long_term_loss": "0",
            "net_short_term": "8",
            "net_long_term": "5",
            "net_realized": "13",
        },
        "cash_flow": {
            "opening_balance": "100",
            "deposits": "1000",
            "withdrawals": "(100)",
            "closing_balance": "1000",
        },
        "cash_balance": "$500.00",
        "total_value": "$1,700.50",
    }

    portfolio = parser._parse_gemini_comprehensive_response(payload)

    assert portfolio.account_info is not None
    assert portfolio.account_info.holder_name == "Ada Investor"
    assert portfolio.account_info.brokerage == "Fidelity"

    assert portfolio.account_summary is not None
    assert portfolio.account_summary.ending_value == 1700.50
    assert portfolio.account_summary.net_deposits_period == -100.0

    assert portfolio.asset_allocation is not None
    assert portfolio.asset_allocation.equities_pct == 88.2
    assert portfolio.asset_allocation.cash_pct == 11.8

    assert len(portfolio.holdings) == 1
    assert portfolio.holdings[0].symbol == "AAPL"
    assert portfolio.holdings[0].est_annual_income == 12.5

    assert len(portfolio.transactions) == 1
    assert portfolio.transactions[0].type == "BUY"
    assert portfolio.transactions[0].amount == 1500.0

    assert portfolio.realized_gain_loss is not None
    assert portfolio.realized_gain_loss.short_term_loss == -2.0
    assert portfolio.cash_balance == 500.0
    assert portfolio.total_value == 1700.50


def test_parse_gemini_comprehensive_response_supports_object_allocation_shape():
    parser = RichPDFParser()
    payload = {
        "account_info": {"holder_name": "Test User"},
        "asset_allocation": {
            "cash_pct": "5",
            "equities_pct": "80",
            "bonds_pct": "10",
            "other_pct": "5",
        },
    }

    portfolio = parser._parse_gemini_comprehensive_response(payload)

    assert portfolio.asset_allocation is not None
    assert portfolio.asset_allocation.cash_pct == 5.0
    assert portfolio.asset_allocation.equities_pct == 80.0
    assert portfolio.asset_allocation.bonds_pct == 10.0
    assert portfolio.asset_allocation.other_pct == 5.0
