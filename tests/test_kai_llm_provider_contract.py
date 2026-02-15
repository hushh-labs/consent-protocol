"""Provider contract checks for Kai LLM operons."""

from __future__ import annotations

from pathlib import Path


def test_llm_operon_does_not_use_legacy_google_generativeai_fallback():
    root = Path(__file__).resolve().parents[1]
    source = (root / "hushh_mcp/operons/kai/llm.py").read_text(encoding="utf-8")

    assert "google.generativeai" not in source
    assert "GenerativeModel(" not in source
    assert "GOOGLE_GENAI_USE_VERTEXAI" in source
    assert "vertexai=True" in source
