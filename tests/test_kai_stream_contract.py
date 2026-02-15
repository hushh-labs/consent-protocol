"""Canonical Kai stream contract tests."""

from __future__ import annotations

import json
from pathlib import Path

from api.routes.kai._streaming import CanonicalSSEStream


def _parse_frame_data(frame: dict[str, str]) -> dict:
    assert "event" in frame
    assert "id" in frame
    assert "data" in frame
    return json.loads(frame["data"])


def test_canonical_stream_event_envelope_shape():
    stream = CanonicalSSEStream("portfolio_import")
    frame = stream.event("stage", {"stage": "uploading"})
    envelope = _parse_frame_data(frame)

    assert frame["event"] == "stage"
    assert frame["id"] == "1"
    assert envelope["schema_version"] == "1.0"
    assert envelope["stream_kind"] == "portfolio_import"
    assert envelope["seq"] == 1
    assert envelope["event"] == "stage"
    assert envelope["terminal"] is False
    assert envelope["payload"] == {"stage": "uploading"}


def test_canonical_stream_sequence_and_terminal_flags():
    stream = CanonicalSSEStream("stock_analyze")

    first = _parse_frame_data(stream.event("agent_start", {"agent": "fundamental"}))
    second = _parse_frame_data(stream.event("agent_token", {"agent": "fundamental", "text": "a"}))
    terminal = _parse_frame_data(stream.event("decision", {"decision": "buy"}, terminal=True))

    assert first["stream_id"] == second["stream_id"] == terminal["stream_id"]
    assert [first["seq"], second["seq"], terminal["seq"]] == [1, 2, 3]
    assert first["terminal"] is False
    assert second["terminal"] is False
    assert terminal["terminal"] is True
    assert terminal["event"] == "decision"


def test_all_stream_kinds_emit_valid_envelopes():
    for stream_kind in ("portfolio_import", "portfolio_optimize", "stock_analyze"):
        stream = CanonicalSSEStream(stream_kind)  # type: ignore[arg-type]
        envelope = _parse_frame_data(stream.event("stage", {"status": "ok"}))
        assert envelope["stream_kind"] == stream_kind
        assert isinstance(envelope["payload"], dict)


def test_stream_routes_use_canonical_stream_builder():
    root = Path(__file__).resolve().parents[1]
    portfolio_source = (root / "api/routes/kai/portfolio.py").read_text(encoding="utf-8")
    losers_source = (root / "api/routes/kai/losers.py").read_text(encoding="utf-8")
    analyze_source = (root / "api/routes/kai/stream.py").read_text(encoding="utf-8")

    assert 'CanonicalSSEStream("portfolio_import")' in portfolio_source
    assert 'CanonicalSSEStream("portfolio_optimize")' in losers_source
    assert 'CanonicalSSEStream("stock_analyze")' in analyze_source


def test_stream_routes_emit_terminal_events():
    root = Path(__file__).resolve().parents[1]
    portfolio_source = (root / "api/routes/kai/portfolio.py").read_text(encoding="utf-8")
    losers_source = (root / "api/routes/kai/losers.py").read_text(encoding="utf-8")
    analyze_source = (root / "api/routes/kai/stream.py").read_text(encoding="utf-8")

    assert 'stream.event(\n                        "complete",' in portfolio_source
    assert "terminal=True" in portfolio_source
    assert 'stream.event("complete", payload, terminal=True)' in losers_source
    assert 'create_event(\n            "decision",' in analyze_source
    assert '"ANALYZE_STREAM_FAILED"' in analyze_source


def test_analyze_stream_requires_explicit_round_phase_metadata():
    root = Path(__file__).resolve().parents[1]
    analyze_source = (root / "api/routes/kai/stream.py").read_text(encoding="utf-8")

    assert "def _normalize_analyze_event_payload" in analyze_source
    assert '"round": 1' in analyze_source
    assert '"phase": "analysis"' in analyze_source
