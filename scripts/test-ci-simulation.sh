#!/bin/bash
# CI Simulation: same steps and package managers as .github/workflows/ci.yml
#
# Run this to reproduce CI locally. If this passes, CI should pass.
# If CI fails, run this script and fix the same failures before pushing.

set +e  # We'll handle errors manually

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

FAIL=0
WARNINGS=0
TEST_COUNT=0
PASS_COUNT=0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     CI Pipeline Real-Time Simulation & Edge Case Testing     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting comprehensive CI simulation..."
echo ""

# ============================================================================
# Test 1: File Validation Edge Cases
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: File Validation Edge Cases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

# Test package-lock.json exists
if [ -f "hushh-webapp/package-lock.json" ]; then
  echo "✓ [PASS] package-lock.json exists"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ [FAIL] package-lock.json missing"
  FAIL=1
fi

# Test package-lock.json is valid JSON
if [ -f "hushh-webapp/package-lock.json" ]; then
  if node -e "JSON.parse(require('fs').readFileSync('hushh-webapp/package-lock.json'))" > /dev/null 2>&1; then
    echo "✓ [PASS] package-lock.json is valid JSON"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ [FAIL] package-lock.json is invalid JSON"
    FAIL=1
  fi
fi

# Test requirements.txt exists
if [ -f "consent-protocol/requirements.txt" ]; then
  echo "✓ [PASS] requirements.txt exists"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ [FAIL] requirements.txt missing"
  FAIL=1
fi

# Test requirements-dev.txt (optional)
if [ -f "consent-protocol/requirements-dev.txt" ]; then
  echo "✓ [PASS] requirements-dev.txt exists (will be used)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "⚠ [WARN] requirements-dev.txt missing (will install directly)"
  WARNINGS=$((WARNINGS + 1))
fi

# Test next.config.ts exists
if [ -f "hushh-webapp/next.config.ts" ]; then
  echo "✓ [PASS] next.config.ts exists"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ [FAIL] next.config.ts missing"
  FAIL=1
fi

# Test verify-route-contracts.cjs exists
if [ -f "hushh-webapp/scripts/verify-route-contracts.cjs" ]; then
  echo "✓ [PASS] verify-route-contracts.cjs exists"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "⚠ [WARN] verify-route-contracts.cjs missing"
  WARNINGS=$((WARNINGS + 1))
fi

# Test test files exist
if [ -d "consent-protocol/tests" ]; then
  TEST_FILES=$(find consent-protocol/tests -name "test_*.py" -o -name "*_test.py" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TEST_FILES" -gt 0 ]; then
    echo "✓ [PASS] Found $TEST_FILES test file(s)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "⚠ [WARN] No test files found"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "⚠ [WARN] tests directory missing"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# Test 2: Version Validation Edge Cases
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Version Validation Edge Cases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

# Test Node.js version
if command -v node > /dev/null 2>&1; then
  NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
  NODE_FULL=$(node --version 2>/dev/null)
  if [ -z "$NODE_VERSION" ]; then
    echo "✗ [FAIL] Could not parse Node.js version"
    FAIL=1
  elif [ "$NODE_VERSION" -ge 20 ]; then
    echo "✓ [PASS] Node.js $NODE_FULL detected (>= 20)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ [FAIL] Node.js $NODE_FULL detected (requires >= 20)"
    FAIL=1
  fi
else
  echo "✗ [FAIL] Node.js not found"
  FAIL=1
fi

# Test Python version
PYTHON_BIN=${PYTHON_BIN:-python3}
if command -v "$PYTHON_BIN" > /dev/null 2>&1; then
  PYTHON_VERSION=$($PYTHON_BIN --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
  PYTHON_FULL=$($PYTHON_BIN --version 2>&1)
  PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
  PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
  
  if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 13 ]); then
    echo "✗ [FAIL] Python $PYTHON_FULL detected (requires >= 3.13)"
    FAIL=1
  elif [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -eq 13 ]; then
    echo "✓ [PASS] Python $PYTHON_FULL detected (matches CI exactly)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "⚠ [WARN] Python $PYTHON_FULL detected (CI uses 3.13)"
    WARNINGS=$((WARNINGS + 1))
    PASS_COUNT=$((PASS_COUNT + 1))  # Still passes, just warns
  fi
else
  echo "✗ [FAIL] Python not found"
  FAIL=1
fi

echo ""

# ============================================================================
# Test 2b: Use latest package managers (same as CI)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2b: Package managers (latest, same as CI)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

if command -v npm > /dev/null 2>&1; then
  if npm install -g npm@latest > /dev/null 2>&1; then
    echo "✓ [PASS] npm upgraded to latest: $(npm --version 2>/dev/null)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "⚠ [WARN] npm global upgrade skipped (no permission or network); using $(npm --version 2>/dev/null)"
    WARNINGS=$((WARNINGS + 1))
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
else
  echo "✗ [FAIL] npm not found"
  FAIL=1
fi

if command -v "$PYTHON_BIN" > /dev/null 2>&1; then
  if $PYTHON_BIN -m pip install --upgrade pip -q 2>/dev/null; then
    echo "✓ [PASS] pip upgraded: $($PYTHON_BIN -m pip --version 2>/dev/null | sed 's/.*pip /pip /')"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "⚠ [WARN] pip upgrade skipped; using $($PYTHON_BIN -m pip --version 2>/dev/null | sed 's/.*pip /pip /')"
    WARNINGS=$((WARNINGS + 1))
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
else
  echo "✗ [FAIL] Python not found"
  FAIL=1
fi

echo ""

# ============================================================================
# Test 3: Frontend Dependencies (npm ci robustness)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Frontend Dependencies Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd hushh-webapp || { echo "✗ [FAIL] Cannot cd to hushh-webapp"; FAIL=1; exit 1; }

# Test npm ci (timeout not available on macOS, using direct run)
echo "  → Running npm ci..."
if npm ci 2>&1 | tee /tmp/npm-ci.log; then
  echo "✓ [PASS] npm ci completed successfully"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  NPM_EXIT=$?
  if [ $NPM_EXIT -eq 124 ]; then
    echo "✗ [FAIL] npm ci timed out after 120 seconds"
  else
    echo "✗ [FAIL] npm ci failed (exit code: $NPM_EXIT)"
    echo "  Last 10 lines of output:"
    tail -10 /tmp/npm-ci.log | sed 's/^/    /'
  fi
  FAIL=1
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 4: TypeScript Type Check
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: TypeScript Type Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd hushh-webapp || exit 1

echo "  → Running TypeScript type check..."
if npx tsc --noEmit 2>&1 | tee /tmp/tsc.log; then
  echo "✓ [PASS] TypeScript type check passed"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  TSC_EXIT=$?
  echo "✗ [FAIL] TypeScript type check failed (exit code: $TSC_EXIT)"
  echo "  Error summary:"
  grep -E "error TS|Found [0-9]+ error" /tmp/tsc.log | head -5 | sed 's/^/    /'
  FAIL=1
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 5: ESLint Check
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: ESLint Linting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd hushh-webapp || exit 1

echo "  → Running ESLint..."
if npm run check-lint 2>&1 | tee /tmp/eslint.log; then
  echo "✓ [PASS] ESLint check passed"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  ESLINT_EXIT=$?
  echo "✗ [FAIL] ESLint check failed (exit code: $ESLINT_EXIT)"
  echo "  Error summary:"
  grep -E "error|Error|✖" /tmp/eslint.log | head -5 | sed 's/^/    /'
  FAIL=1
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 6: Build Check
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Next.js Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd hushh-webapp || exit 1

echo "  → Running Next.js build (web standalone)..."
if NEXT_PUBLIC_BACKEND_URL=https://api.example.com \
   NEXT_PUBLIC_FIREBASE_API_KEY="dummy-api-key" \
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="dummy-project.firebaseapp.com" \
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="dummy-project" \
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="dummy-project.appspot.com" \
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789" \
   NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef123456" \
   npm run build 2>&1 | tee /tmp/build.log; then
  echo "✓ [PASS] Build (web) completed successfully"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  BUILD_EXIT=$?
  echo "✗ [FAIL] Build failed (exit code: $BUILD_EXIT)"
  echo "  Error summary:"
  grep -E "error|Error|Failed|✖" /tmp/build.log | tail -10 | sed 's/^/    /'
  FAIL=1
fi

echo "  → Running Next.js build (Capacitor export)..."
if [ $FAIL -eq 0 ] && CAPACITOR_BUILD=true \
   NEXT_PUBLIC_BACKEND_URL=https://api.example.com \
   NEXT_PUBLIC_FIREBASE_API_KEY="dummy-api-key" \
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="dummy-project.firebaseapp.com" \
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="dummy-project" \
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="dummy-project.appspot.com" \
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789" \
   NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef123456" \
   npm run cap:build 2>&1 | tee /tmp/cap-build.log; then
  echo "✓ [PASS] Capacitor build completed successfully"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  if [ $FAIL -eq 0 ]; then
    CAP_EXIT=$?
    echo "✗ [FAIL] Capacitor build failed (exit code: $CAP_EXIT)"
    grep -E "error|Error|Failed|✖" /tmp/cap-build.log | tail -5 | sed 's/^/    /'
    FAIL=1
  fi
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 7: Python Dependencies (pip install robustness)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: Python Dependencies Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd consent-protocol || { echo "✗ [FAIL] Cannot cd to consent-protocol"; FAIL=1; exit 1; }

echo "  → Installing Python dependencies (this may take a few minutes)..."
echo "  → Progress will be shown below:"
if $PYTHON_BIN -m pip install --progress-bar off -r requirements.txt 2>&1 | tee /tmp/pip-install.log; then
  echo "✓ [PASS] Python dependencies installed successfully"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  PIP_EXIT=$?
  echo "✗ [FAIL] pip install failed (exit code: $PIP_EXIT)"
  echo "  Error summary:"
  grep -E "error|Error|ERROR|Failed|FAILED" /tmp/pip-install.log | tail -10 | sed 's/^/    /'
  FAIL=1
fi

# Install dev dependencies
if [ $FAIL -eq 0 ]; then
  echo "  → Installing dev dependencies..."
  if [ -f "requirements-dev.txt" ]; then
    echo "    Using requirements-dev.txt..."
    if $PYTHON_BIN -m pip install --progress-bar off -r requirements-dev.txt 2>&1 | tee /tmp/pip-dev.log; then
      echo "✓ [PASS] Dev dependencies installed from requirements-dev.txt"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "✗ [FAIL] Dev dependencies install failed"
      FAIL=1
    fi
  else
    echo "    Installing dev dependencies directly..."
    if $PYTHON_BIN -m pip install --progress-bar off pytest pytest-cov pytest-asyncio mypy ruff 2>&1 | tee /tmp/pip-dev.log; then
      echo "✓ [PASS] Dev dependencies installed directly"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "✗ [FAIL] Dev dependencies install failed"
      FAIL=1
    fi
  fi
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 8: Ruff Linting
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: Ruff Linting (Python)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd consent-protocol || exit 1

echo "  → Running ruff check..."
if $PYTHON_BIN -m ruff check . 2>&1 | tee /tmp/ruff.log; then
  echo "✓ [PASS] Ruff linting passed"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  RUFF_EXIT=$?
  echo "✗ [FAIL] Ruff linting failed (exit code: $RUFF_EXIT)"
  echo "  Error summary:"
  grep -E "error|Error|F|E[0-9]" /tmp/ruff.log | head -10 | sed 's/^/    /'
  FAIL=1
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 9: Mypy Type Check
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: Mypy Type Check (Python)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd consent-protocol || exit 1

echo "  → Running mypy type check..."
if $PYTHON_BIN -m mypy --config-file pyproject.toml --ignore-missing-imports 2>&1 | tee /tmp/mypy.log; then
  echo "✓ [PASS] Mypy type check passed"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  MYPY_EXIT=$?
  echo "✗ [FAIL] Mypy type check failed (exit code: $MYPY_EXIT)"
  echo "  Error summary:"
  grep -E "error|Error" /tmp/mypy.log | head -10 | sed 's/^/    /'
  FAIL=1
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 10: Pytest Tests
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 10: Python Tests (pytest)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd consent-protocol || exit 1

if [ -d "tests" ] && [ "$(find tests -name 'test_*.py' -o -name '*_test.py' 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  echo "  → Running pytest tests..."
  if TESTING="true" \
     SECRET_KEY="test_secret_key_for_ci_only_32chars_min" \
     VAULT_ENCRYPTION_KEY="635ce8d8018dee8b98ec987dc2dbfb79f3658ac7a54d4cb4c6150a21cd60098f" \
     $PYTHON_BIN -m pytest tests/ -v --tb=short 2>&1 | tee /tmp/pytest.log; then
    echo "✓ [PASS] All tests passed"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    PYTEST_EXIT=$?
    echo "✗ [FAIL] Tests failed (exit code: $PYTEST_EXIT)"
    echo "  Test failures:"
    grep -E "FAILED|ERROR|failed|error" /tmp/pytest.log | head -10 | sed 's/^/    /'
    FAIL=1
  fi
else
  echo "⚠ [WARN] No test files found, skipping"
  WARNINGS=$((WARNINGS + 1))
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Test 11: Route Contract Verification
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 11: Route Contract Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_COUNT=$((TEST_COUNT + 1))

cd hushh-webapp || exit 1

if [ -f "scripts/verify-route-contracts.cjs" ]; then
  echo "  → Running route contract verification..."
  if npm run verify:routes 2>&1 | tee /tmp/verify-routes.log; then
    echo "✓ [PASS] Route contract verification passed"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    VERIFY_EXIT=$?
    echo "⚠ [WARN] Route contract verification failed (non-blocking)"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "⚠ [WARN] verify-route-contracts.cjs not found, skipping"
  WARNINGS=$((WARNINGS + 1))
fi

cd "$REPO_ROOT" || exit 1
echo ""

# ============================================================================
# Final Summary
# ============================================================================
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    CI Simulation Summary                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Tests Run:    $TEST_COUNT"
echo "Tests Passed: $PASS_COUNT"
echo "Warnings:     $WARNINGS"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ ALL CRITICAL CHECKS PASSED"
  if [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "⚠️  $WARNINGS non-blocking warnings detected"
    echo "   These won't block CI but should be addressed"
  fi
  echo ""
  echo "🎉 CI Pipeline is ready!"
  exit 0
else
  echo "❌ CRITICAL CHECKS FAILED"
  echo ""
  echo "Fix the errors above before committing."
  echo "Check log files in /tmp/ for detailed error messages:"
  echo "  - /tmp/npm-ci.log"
  echo "  - /tmp/tsc.log"
  echo "  - /tmp/eslint.log"
  echo "  - /tmp/build.log"
  echo "  - /tmp/pip-install.log"
  echo "  - /tmp/ruff.log"
  echo "  - /tmp/mypy.log"
  echo "  - /tmp/pytest.log"
  exit 1
fi
