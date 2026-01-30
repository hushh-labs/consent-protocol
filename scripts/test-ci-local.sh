#!/bin/bash
# Test CI checks locally before committing
# Mirrors .github/workflows/ci.yml (same steps and package managers).
#
# Usage: ./scripts/test-ci-local.sh
#
# Run this before committing to catch issues early. If this passes, CI should pass.
# If CI fails, run this script locally and fix the same failures.

# Don't use set -e here because we want to track failures manually
# and provide better error messages
set +e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

FAIL=0
WARNINGS=0

echo "🔍 Hushh Local CI Testing"
echo "========================"
echo ""
echo "This script mirrors GitHub Actions CI workflow."
echo "Run this before committing to ensure CI will pass."
echo ""

# ============================================================================
# Validation: Check required files exist
# ============================================================================
echo "▶ Validating required files..."

# Check package-lock.json
if [ ! -f "hushh-webapp/package-lock.json" ]; then
  echo "❌ ERROR: hushh-webapp/package-lock.json not found"
  echo "   Run 'cd hushh-webapp && npm install' to generate it"
  FAIL=1
else
  # Validate it's valid JSON
  if ! node -e "JSON.parse(require('fs').readFileSync('hushh-webapp/package-lock.json'))" > /dev/null 2>&1; then
    echo "❌ ERROR: hushh-webapp/package-lock.json is not valid JSON"
    FAIL=1
  else
    echo "  ✓ package-lock.json exists and is valid"
  fi
fi

# Check next.config.ts
if [ ! -f "hushh-webapp/next.config.ts" ]; then
  echo "❌ ERROR: hushh-webapp/next.config.ts not found"
  FAIL=1
else
  echo "  ✓ next.config.ts exists"
fi

# Check requirements.txt
if [ ! -f "consent-protocol/requirements.txt" ]; then
  echo "❌ ERROR: consent-protocol/requirements.txt not found"
  FAIL=1
else
  echo "  ✓ requirements.txt exists"
fi

# Check requirements-dev.txt (optional but preferred)
if [ -f "consent-protocol/requirements-dev.txt" ]; then
  echo "  ✓ requirements-dev.txt exists (will be used)"
else
  echo "  ⚠  requirements-dev.txt not found (will install dev deps directly)"
fi

# Check verify-route-contracts script
if [ ! -f "hushh-webapp/scripts/verify-route-contracts.cjs" ]; then
  echo "⚠️  WARNING: hushh-webapp/scripts/verify-route-contracts.cjs not found"
  echo "   Route contract verification will be skipped"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✓ verify-route-contracts.cjs exists"
fi

# Check test directory exists
if [ ! -d "consent-protocol/tests" ]; then
  echo "⚠️  WARNING: consent-protocol/tests directory not found"
  echo "   Tests will be skipped"
  WARNINGS=$((WARNINGS + 1))
else
  TEST_COUNT=$(find consent-protocol/tests -name "test_*.py" -o -name "*_test.py" | wc -l | tr -d ' ')
  if [ "$TEST_COUNT" -eq 0 ]; then
    echo "⚠️  WARNING: No test files found in consent-protocol/tests"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✓ Found $TEST_COUNT test file(s)"
  fi
fi

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "❌ Validation failed. Fix the errors above before continuing."
  exit 1
fi

echo ""

# ============================================================================
# Version Checks
# ============================================================================
echo "▶ Checking versions..."

# Check Node version
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ]; then
  echo "❌ ERROR: Node.js not found. Install Node.js 20+"
  FAIL=1
elif [ "$NODE_VERSION" -lt 20 ]; then
  echo "⚠️  WARNING: Node.js version $NODE_VERSION detected, CI expects 20+"
  echo "   CI may fail if version mismatch causes issues"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✓ Node.js $(node --version) detected"
fi

# Check Python version
PYTHON_BIN=${PYTHON_BIN:-python3}
if ! command -v "$PYTHON_BIN" > /dev/null 2>&1; then
  echo "❌ ERROR: $PYTHON_BIN not found. Install Python 3.11+"
  FAIL=1
else
  PYTHON_VERSION=$($PYTHON_BIN --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
  PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
  PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
  
  if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    echo "❌ ERROR: Python $PYTHON_VERSION detected, CI requires Python 3.11+"
    FAIL=1
  elif [ "$PYTHON_MAJOR" -ne 3 ] || [ "$PYTHON_MINOR" -ne 11 ]; then
    echo "⚠️  WARNING: Python $PYTHON_VERSION detected, CI uses Python 3.11"
    echo "   Some packages may behave differently. Consider using Python 3.11."
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✓ Python $PYTHON_VERSION detected (matches CI)"
  fi
fi

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "❌ Version checks failed. Fix the errors above before continuing."
  exit 1
fi

# Use latest package managers (same as CI)
echo "▶ Using latest package managers (same as CI)..."
if command -v npm > /dev/null 2>&1; then
  npm install -g npm@latest 2>/dev/null || true
  echo "  npm $(npm --version 2>/dev/null || echo '?')"
fi
if command -v "$PYTHON_BIN" > /dev/null 2>&1; then
  $PYTHON_BIN -m pip install --upgrade pip -q 2>/dev/null || true
  echo "  pip $($PYTHON_BIN -m pip --version 2>/dev/null | head -1 || echo '?')"
fi
echo ""

# Frontend checks
echo "▶ [1/3] Frontend CI Checks (Next.js)..."
cd hushh-webapp

echo "  Installing dependencies..."
npm ci || { echo "❌ npm ci failed - check package-lock.json is in sync with package.json"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  echo "  TypeScript type check..."
  npx tsc --noEmit || { echo "❌ TypeScript type check failed"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Linting..."
  npm run check-lint || { echo "❌ Lint check failed"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Building (web standalone)..."
  NEXT_PUBLIC_BACKEND_URL=https://api.example.com npm run build || { echo "❌ Build failed - check build output above for details"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Building (Capacitor export)..."
  CAPACITOR_BUILD=true NEXT_PUBLIC_BACKEND_URL=https://api.example.com npm run cap:build || { echo "❌ Capacitor build failed - check build output above"; FAIL=1; }
fi

echo "  Security audit..."
npm audit --audit-level=high || { echo "⚠️  Security audit warnings (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }

cd "$REPO_ROOT"
echo ""

# Backend checks
echo "▶ [2/3] Backend CI Checks (Python)..."
cd consent-protocol

# Prefer python3 explicitly for local environments where `pip` may not be on PATH
# PYTHON_BIN is already set during version check above
# CI uses a 5-minute timeout for pip install; local runs unbounded (use Ctrl+C to abort if needed)

echo "  Installing dependencies (this may take a few minutes)..."
$PYTHON_BIN -m pip install --progress-bar off --use-deprecated=legacy-resolver -r requirements.txt || { echo "❌ pip install failed - check requirements.txt and network connection"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  echo "  Installing dev dependencies..."
  # Use requirements-dev.txt if it exists, otherwise install directly
  if [ -f "requirements-dev.txt" ]; then
    echo "    Using requirements-dev.txt..."
    $PYTHON_BIN -m pip install --progress-bar off --use-deprecated=legacy-resolver -r requirements-dev.txt || { echo "❌ Dev dependencies install failed"; FAIL=1; }
    # Install pytest-cov and pytest-asyncio separately as they may not be in requirements-dev.txt
    $PYTHON_BIN -m pip install --progress-bar off --use-deprecated=legacy-resolver pytest-cov pytest-asyncio || { echo "⚠️  Warning: pytest-cov or pytest-asyncio install failed (may already be installed)"; }
  else
    echo "    Installing dev dependencies directly..."
    $PYTHON_BIN -m pip install --progress-bar off --use-deprecated=legacy-resolver pytest pytest-cov pytest-asyncio mypy ruff || { echo "❌ Dev dependencies install failed"; FAIL=1; }
  fi
fi

if [ $FAIL -eq 0 ]; then
  echo "  Linting with ruff..."
  $PYTHON_BIN -m ruff check . || { echo "❌ Ruff linting failed - fix linting issues above"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  echo "  Type checking with mypy..."
  $PYTHON_BIN -m mypy . --ignore-missing-imports || { echo "❌ Mypy type check failed - fix type errors above"; FAIL=1; }
fi

if [ $FAIL -eq 0 ]; then
  if [ -d "tests" ] && [ "$(find tests -name 'test_*.py' -o -name '*_test.py' | wc -l | tr -d ' ')" -gt 0 ]; then
    echo "  Running tests..."
    TESTING="true" \
    SECRET_KEY="test_secret_key_for_ci_only_32chars_min" \
    VAULT_ENCRYPTION_KEY="TEST_VAULT_KEY_PLACEHOLDER" \
    $PYTHON_BIN -m pytest tests/ -v --tb=short || { echo "❌ Tests failed - check test output above"; FAIL=1; }
  else
    echo "  ⚠️  Skipping tests - no test files found"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

cd "$REPO_ROOT"
echo ""

# Integration checks
echo "▶ [3/3] Integration Checks..."
cd hushh-webapp

echo "  Installing dependencies..."
npm ci || { echo "❌ npm ci failed - check package-lock.json is in sync"; FAIL=1; }

if [ $FAIL -eq 0 ]; then
  if [ -f "scripts/verify-route-contracts.cjs" ]; then
    echo "  Verifying route contracts..."
    npm run verify:routes || { echo "⚠️  Route contract verification (non-blocking)"; WARNINGS=$((WARNINGS + 1)); }
  else
    echo "  ⚠️  Skipping route contract verification - script not found"
    WARNINGS=$((WARNINGS + 1))
  fi
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
    echo "- Missing test files or route contract verification script"
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
