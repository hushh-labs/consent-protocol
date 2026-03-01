"""Strict JSON parse contract tests for Kai import extraction V2."""

from __future__ import annotations

import pytest

from hushh_mcp.kai_import.extract_v2 import ImportStrictParseError, parse_json_strict_v2


def test_parse_json_strict_v2_rejects_invalid_json() -> None:
    with pytest.raises(ImportStrictParseError) as exc:
        parse_json_strict_v2('{"a": 1', required_keys={"a"})
    assert exc.value.code == "IMPORT_JSON_INVALID"


def test_parse_json_strict_v2_rejects_schema_mismatch() -> None:
    with pytest.raises(ImportStrictParseError) as exc:
        parse_json_strict_v2('{"a": 1, "extra": 2}', required_keys={"a"})
    assert exc.value.code == "IMPORT_SCHEMA_INVALID"


def test_parse_json_strict_v2_accepts_exact_required_shape() -> None:
    parsed, diagnostics = parse_json_strict_v2('{"a": 1, "b": []}', required_keys={"a", "b"})
    assert parsed == {"a": 1, "b": []}
    assert diagnostics["mode"] == "strict_json_only"
