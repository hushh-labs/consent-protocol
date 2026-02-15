"""Tests for document relevance gating in PortfolioImportService."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_SERVICE_SPEC = importlib.util.spec_from_file_location(
    "portfolio_import_service_test_module",
    _ROOT / "hushh_mcp/services/portfolio_import_service.py",
)
if _SERVICE_SPEC is None or _SERVICE_SPEC.loader is None:
    raise RuntimeError("Unable to load portfolio_import_service module for tests")
_SERVICE_MODULE = importlib.util.module_from_spec(_SERVICE_SPEC)
sys.modules[_SERVICE_SPEC.name] = _SERVICE_MODULE
_SERVICE_SPEC.loader.exec_module(_SERVICE_MODULE)
PortfolioImportService = _SERVICE_MODULE.PortfolioImportService


def test_heuristic_relevance_accepts_brokerage_statement_text():
    service = PortfolioImportService()
    sample_text = """
    Fidelity Brokerage Statement
    Account Number: XXX-12345
    Positions and Holdings
    Symbol Quantity Market Value Cost Basis Unrealized Gain/Loss
    AAPL 10 1875.00 1400.00 475.00
    """

    result = service._heuristic_relevance(
        text_sample=sample_text,
        filename="fidelity_statement.pdf",
    )

    assert result.is_relevant is True
    assert result.code == "RELEVANT"
    assert result.confidence >= 0.7


def test_heuristic_relevance_rejects_irrelevant_content():
    service = PortfolioImportService()
    sample_text = """
    Medical Prescription
    Patient diagnosis and treatment plan
    Invoice total due and lease agreement addendum
    """

    result = service._heuristic_relevance(
        text_sample=sample_text,
        filename="medical-record.pdf",
    )

    assert result.is_relevant is False
    assert result.code == "IRRELEVANT_CONTENT"


def test_assess_document_relevance_handles_unreadable_uploads():
    service = PortfolioImportService()
    result = asyncio.run(
        service.assess_document_relevance(
            file_content=b"",
            filename="unknown.pdf",
        )
    )

    assert result.is_relevant is False
    assert result.code == "EMPTY_OR_UNREADABLE"
