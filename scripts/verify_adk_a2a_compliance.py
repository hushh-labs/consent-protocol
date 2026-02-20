#!/usr/bin/env python3
"""Static compliance checks for Kai ADK and Google A2A contracts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def _check_patterns(path: Path, patterns: list[str]) -> dict[str, Any]:
    if not path.exists():
        return {"path": str(path), "ok": False, "missing_file": True, "missing_patterns": patterns}

    source = path.read_text(encoding="utf-8")
    missing = [pattern for pattern in patterns if re.search(pattern, source) is None]
    return {
        "path": str(path),
        "ok": len(missing) == 0,
        "missing_file": False,
        "missing_patterns": missing,
    }


def main() -> int:
    checks = [
        _check_patterns(
            ROOT / "hushh_mcp/adk_bridge/kai_agent.py",
            [
                r"X-Consent-Token",
                r"validate_token\(consent_token,\s*ConsentScope\.VAULT_OWNER\)",
                r"orchestrate_debate_stream",
                r"DebateEngine",
            ],
        ),
        _check_patterns(
            ROOT / "server_a2a.py",
            [
                r"KaiA2AServer",
                r"google_a2a_compatible=True",
                r"WSGIMiddleware",
            ],
        ),
        _check_patterns(
            ROOT / "api/routes/kai/analyze.py",
            [
                r"require_vault_owner_token",
                r"RealtimeDataUnavailable",
            ],
        ),
        _check_patterns(
            ROOT / "api/routes/kai/stream.py",
            [
                r"CanonicalSSEStream",
                r"validate_token",
                r"RealtimeDataUnavailable",
            ],
        ),
        _check_patterns(
            ROOT / "hushh_mcp/agents/kai/fundamental_agent.py",
            [
                r"fetch_sec_filings",
                r"fetch_market_data",
                r"analyze_fundamentals",
            ],
        ),
        _check_patterns(
            ROOT / "hushh_mcp/agents/kai/sentiment_agent.py",
            [
                r"fetch_market_news",
            ],
        ),
        _check_patterns(
            ROOT / "hushh_mcp/agents/kai/valuation_agent.py",
            [
                r"fetch_peer_data",
            ],
        ),
    ]

    ok = all(item["ok"] for item in checks)
    report = {
        "ok": ok,
        "checks": checks,
    }
    print(json.dumps(report, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
