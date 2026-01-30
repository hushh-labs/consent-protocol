#!/bin/bash
# Test CI checks locally before committing
# Mirrors .github/workflows/ci.yml
#
# Usage: ./scripts/test-ci-local.sh
#
# This script runs the same checks as GitHub Actions CI locally.
# Run this before committing to catch issues early.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

FAIL=0
WARNINGS=0

echo "🔍 Hushh Local CI Testing"
echo "========================"
echo ""
echo "This script mirrors GitHub Actions CI workflow."
echo "Run this before committing to ensure CI will pass."
echo ""

# Frontend checks
echo "▶ [1/3] Frontend CI Checks (Next.js)..."
cd hushh-webapp

echo "  Installing dependencies..."
npm ci > /dev/null 2>&1 || { echo "❌ npm ci failed"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  echo "  TypeScript type check..."
  npx tsc --noEmit || { echo "❌ TypeScript type check failed"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Linting..."
  npm run check-lint || { echo "❌ Lint check failed"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Building..."
  NEXT_PUBLIC_BACKEND_URL=https://api.example.com npm run build > /dev/null 2>&1 || { echo "❌ Build failed"; FAIL=1; }
fi

echo "  Security audit..."
npm audit --audit-level=high > /dev/null 2>&1 || { echo "⚠️  Security audit warnings (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }

cd "$REPO_ROOT"
echo ""

# Backend checks
echo "▶ [2/3] Backend CI Checks (Python)..."
cd consent-protocol

echo "  Installing dependencies..."
pip install -q -r requirements.txt > /dev/null 2>&1 || { echo "❌ pip install failed"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  echo "  Installing dev dependencies..."
  pip install -q pytest pytest-cov pytest-asyncio mypy ruff > /dev/null 2>&1 || { echo "❌ Dev dependencies install failed"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Linting with ruff..."
  python -m ruff check . > /dev/null 2>&1 || { echo "⚠️  Ruff linting issues (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Type checking with mypy..."
  python -m mypy . --ignore-missing-imports > /dev/null 2>&1 || { echo "⚠️  Mypy type check issues (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Running tests..."
  TESTING="true" \
  SECRET_KEY="test_secret_key_for_ci_only_32chars_min" \
  VAULT_ENCRYPTION_KEY="635ce8d8018dee8b98ec987dc2dbfb79f3658ac7a54d4cb4c6150a21cd60098f" \
  python -m pytest tests/ -v --tb=short || { echo "❌ Tests failed"; FAIL=1; }
fi

cd "$REPO_ROOT"
echo ""

# Integration checks
echo "▶ [3/3] Integration Checks..."
cd hushh-webapp

echo "  Installing dependencies..."
npm ci > /dev/null 2>&1 || { echo "❌ npm ci failed"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  echo "  Verifying route contracts..."
  npm run verify:routes > /dev/null 2>&1 || { echo "⚠️  Route contract verification (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }
fi

cd "$REPO_ROOT"
echo ""

# Result
echo "================================"
if [ $FAIL -eq 0 ]; then
  echo "✅ All critical CI checks passed locally"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS non-blocking warnings (see above)"
    echo ""
    echo "These warnings won't block CI but should be addressed:"
    echo "- Security audit warnings"
    echo "- Ruff linting issues"
    echo "- Mypy type check issues"
    echo "- Route contract verification"
  fi
  echo ""
  echo "Ready to commit! 🚀"
  exit 0
else
  echo "❌ Some critical CI checks failed."
  echo ""
  echo "Fix the issues above before committing."
  echo "Re-run this script after fixing: ./scripts/test-ci-local.sh"
  exit 1
fi
