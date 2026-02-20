from __future__ import annotations

import asyncio

from scripts.eval_portfolio_stream_quality import _evaluate


def test_statement_candidate_error_fails_global_quality_gate(tmp_path) -> None:
    missing_statement = tmp_path / "nonexistent_statement_for_quality_eval.pdf"

    report = asyncio.run(_evaluate([missing_statement], timeout_seconds=5.0))

    assert report["all_quality_gates_passed"] is False
    assert report["aggregate"]["statement_candidate_documents"] == 1
    assert report["aggregate"]["statement_candidate_errors"] == 1
    assert report["documents"][0]["statement_candidate"] is True
    assert report["documents"][0]["error"] == "file_not_found"
