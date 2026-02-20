#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "❌ python3 (or python) is required for backend checks."
  exit 1
fi

"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r requirements.txt
"$PYTHON_BIN" -m pip install -r requirements-dev.txt

"$PYTHON_BIN" -m ruff check .
"$PYTHON_BIN" -m mypy --config-file pyproject.toml --ignore-missing-imports
"$PYTHON_BIN" -m bandit -r hushh_mcp/ api/ -c pyproject.toml -ll

if [ -d tests ] && [ -n "$(find tests -name 'test_*.py' -o -name '*_test.py' | head -1)" ]; then
  TESTING="${TESTING:-true}" \
  SECRET_KEY="${SECRET_KEY:-test_secret_key_for_ci_only_32chars_min}" \
  VAULT_ENCRYPTION_KEY="${VAULT_ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}" \
  MCP_DEVELOPER_TOKEN="${MCP_DEVELOPER_TOKEN:-test_mcp_developer_token_for_ci}" \
  "$PYTHON_BIN" -m pytest tests/ -v --tb=short --cov=hushh_mcp --cov-report=xml --cov-report=term
else
  echo "⚠ No test files found, skipping pytest."
fi
