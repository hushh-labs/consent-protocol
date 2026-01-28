#!/bin/bash
# Hushh Pre-Launch Verification Script
# Run this before any public release to ensure everything passes

set -e

echo "🔍 Hushh Pre-Launch Verification"
echo "================================"
echo ""

FAIL=0
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# 1. Backend Tests
echo "▶ [1/5] Backend Tests..."
cd consent-protocol
if [ -d "venv" ]; then
  source venv/bin/activate
fi
SECRET_KEY="test_key_32chars_minimum_length!" \
TESTING="true" \
python3 -m pytest tests/ -v --tb=short || { FAIL=1; echo "❌ Backend tests failed"; }
cd "$REPO_ROOT"
echo ""

# 2. Architecture Compliance
echo "▶ [2/5] Architecture Compliance..."
if grep -rq "get_supabase()" consent-protocol/api/routes/ 2>/dev/null; then
  echo "❌ Direct Supabase access found in API routes!"
  grep -r "get_supabase()" consent-protocol/api/routes/
  FAIL=1
else
  echo "✅ No direct Supabase access in routes"
fi
echo ""

# 3. Frontend Lint
echo "▶ [3/5] Frontend Lint..."
cd hushh-webapp
npm run check-lint || { FAIL=1; echo "❌ Lint failed"; }
cd "$REPO_ROOT"
echo ""

# 4. TypeScript
echo "▶ [4/5] TypeScript Check..."
cd hushh-webapp
npx tsc --noEmit || { FAIL=1; echo "❌ TypeScript failed"; }
cd "$REPO_ROOT"
echo ""

# 5. Check for uncommitted changes
echo "▶ [5/5] Git Status..."
MODIFIED=$(git status --porcelain | grep "^ M" | wc -l | tr -d ' ')
UNTRACKED=$(git status --porcelain | grep "^??" | wc -l | tr -d ' ')
echo "   Modified files: $MODIFIED"
echo "   Untracked files: $UNTRACKED"
if [ "$UNTRACKED" -gt 0 ]; then
  echo "⚠️  Untracked files should be committed before launch:"
  git status --porcelain | grep "^??"
fi
echo ""

# Result
echo "================================"
if [ $FAIL -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  echo ""
  echo "Ready for public release!"
  exit 0
else
  echo "❌ VERIFICATION FAILED"
  echo ""
  echo "Fix the issues above before launch."
  exit 1
fi
