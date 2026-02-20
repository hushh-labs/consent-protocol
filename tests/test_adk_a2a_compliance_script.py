"""Regression test for ADK/A2A compliance verifier."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_verify_adk_a2a_compliance_script_passes():
    root = Path(__file__).resolve().parents[1]
    script = root / "scripts" / "verify_adk_a2a_compliance.py"
    result = subprocess.run(  # noqa: S603 - Local test executes repository-owned verifier script.
        [sys.executable, str(script)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
