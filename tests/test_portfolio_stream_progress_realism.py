"""Portfolio import stream realism checks."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_STREAMING_SPEC = importlib.util.spec_from_file_location(
    "kai_streaming_progress_realism_module",
    _ROOT / "api/routes/kai/_streaming.py",
)
if _STREAMING_SPEC is None or _STREAMING_SPEC.loader is None:
    raise RuntimeError("Unable to load _streaming module for realism tests")
_STREAMING_MODULE = importlib.util.module_from_spec(_STREAMING_SPEC)
sys.modules[_STREAMING_SPEC.name] = _STREAMING_MODULE
_STREAMING_SPEC.loader.exec_module(_STREAMING_MODULE)

CanonicalSSEStream = _STREAMING_MODULE.CanonicalSSEStream


def _progress(frame: dict[str, str]) -> float:
    envelope = json.loads(frame["data"])
    return float(envelope["payload"]["progress_pct"])


def test_progress_stays_zero_until_measurable_signal_is_provided():
    stream = CanonicalSSEStream("portfolio_import")

    uploading = stream.event("stage", {"stage": "uploading"})
    indexing = stream.event("stage", {"stage": "indexing"})
    scanning = stream.event("stage", {"stage": "scanning"})
    measured_chunk = stream.event(
        "chunk",
        {
            "chunk_count": 3,
            "total_chars": 1200,
            "progress_pct": 41.0,
        },
    )
    parsing = stream.event(
        "progress",
        {
            "phase": "parsing",
            "holdings_extracted": 2,
            "holdings_total": 10,
            "progress_pct": 83.2,
        },
    )
    done = stream.event("complete", {"message": "done"}, terminal=True)

    assert _progress(uploading) == 0.0
    assert _progress(indexing) == 0.0
    assert _progress(scanning) == 0.0
    assert _progress(measured_chunk) == 41.0
    assert _progress(parsing) == 83.2
    assert _progress(done) == 100.0


def test_portfolio_route_has_no_hardcoded_pre_measure_percentages():
    source = (_ROOT / "api/routes/kai/portfolio.py").read_text(encoding="utf-8")

    for disallowed in (
        '"progress_pct": 5',
        '"progress_pct": 15',
        '"progress_pct": 30',
        '"progress_pct": 45',
        '"progress_pct": 60',
    ):
        assert disallowed not in source

    assert 'f"Parsed {idx + 1} of {parsed_total} holdings"' in source
    assert "holdings_extracted" in source
