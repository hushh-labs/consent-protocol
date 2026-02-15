"""Canonical SSE utilities for Kai streaming routes.

This module enforces one strict stream contract across import/optimize/analyze.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal, cast

StreamKind = Literal["portfolio_import", "portfolio_optimize", "stock_analyze"]
SCHEMA_VERSION = "1.0"
DEFAULT_STREAM_TIMEOUT_SECONDS = 120
HEARTBEAT_INTERVAL_SECONDS = 4.0


@dataclass
class CanonicalSSEStream:
    """Stateful canonical SSE event builder for one stream session."""

    stream_kind: StreamKind
    stream_id: str = field(default_factory=lambda: f"strm_{uuid.uuid4().hex}")
    _seq: int = 0

    def event(
        self, event: str, payload: dict[str, Any], *, terminal: bool = False
    ) -> dict[str, str]:
        """Build one canonical SSE frame for sse_starlette."""
        self._seq += 1
        envelope = {
            "schema_version": SCHEMA_VERSION,
            "stream_id": self.stream_id,
            "stream_kind": self.stream_kind,
            "seq": self._seq,
            "event": event,
            "terminal": terminal,
            "payload": payload,
        }
        return {
            "event": event,
            "id": str(self._seq),
            "data": json.dumps(envelope),
        }


_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


def _to_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return cast(dict[str, Any], value)
    raise ValueError("Parsed response is not a JSON object")


def parse_json_with_single_repair(
    raw_text: str,
    *,
    required_keys: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Strict JSON parse with exactly one deterministic repair pass."""
    diagnostics: dict[str, Any] = {
        "raw_length": len(raw_text),
        "repair_attempted": False,
        "repair_applied": False,
        "repair_actions": [],
    }

    candidate = raw_text.strip()
    if not candidate:
        raise ValueError("Empty model response")

    try:
        parsed = _to_object(json.loads(candidate))
    except Exception:
        diagnostics["repair_attempted"] = True
        repaired = _strip_code_fences(candidate)
        actions: list[str] = []

        normalized_quotes = (
            repaired.replace("“", '"').replace("”", '"').replace("’", "'").replace("\u00a0", " ")
        )
        if normalized_quotes != repaired:
            actions.append("normalized_quotes")
            repaired = normalized_quotes

        start = repaired.find("{")
        end = repaired.rfind("}")
        if start != -1 and end != -1 and end > start:
            sliced = repaired[start : end + 1]
            if sliced != repaired:
                actions.append("sliced_outer_object")
                repaired = sliced

        without_trailing = _TRAILING_COMMA_RE.sub(r"\1", repaired)
        if without_trailing != repaired:
            actions.append("removed_trailing_commas")
            repaired = without_trailing

        diagnostics["repair_actions"] = actions
        diagnostics["repair_applied"] = bool(actions)
        parsed = _to_object(json.loads(repaired))

    if required_keys:
        missing = sorted(k for k in required_keys if k not in parsed)
        if missing:
            raise ValueError(f"Missing required keys: {', '.join(missing)}")

    return parsed, diagnostics
