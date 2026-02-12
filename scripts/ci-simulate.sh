#!/usr/bin/env bash
# ci-simulate.sh -- Run the full CI pipeline locally before pushing
# Mirrors .github/workflows/ci.yml exactly
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CI Simulator ===${NC}"
echo ""

# Frontend checks
echo -e "${BLUE}--- Frontend (hushh-webapp) ---${NC}"
cd "$(dirname "$0")/../hushh-webapp"

echo -e "${BLUE}[1/4] Type check...${NC}"
npm run typecheck
echo -e "${GREEN}  ✓ Type check passed${NC}"

echo -e "${BLUE}[2/4] Lint...${NC}"
npm run lint
echo -e "${GREEN}  ✓ Lint passed${NC}"

echo -e "${BLUE}[3/4] Tests...${NC}"
npm run test
echo -e "${GREEN}  ✓ Tests passed${NC}"

echo -e "${BLUE}[4/4] Build...${NC}"
npm run build
echo -e "${GREEN}  ✓ Build passed${NC}"

echo ""

# Backend checks
echo -e "${BLUE}--- Backend (consent-protocol) ---${NC}"
cd "$(dirname "$0")/../consent-protocol"

echo -e "${BLUE}[1/3] Ruff lint...${NC}"
python -m ruff check .
echo -e "${GREEN}  ✓ Ruff passed${NC}"

echo -e "${BLUE}[2/3] Mypy type check...${NC}"
python -m mypy --config-file pyproject.toml --ignore-missing-imports
echo -e "${GREEN}  ✓ Mypy passed${NC}"

echo -e "${BLUE}[3/3] Tests...${NC}"
if [ -d tests ] && [ -n "$(find tests -name 'test_*.py' -o -name '*_test.py' | head -1)" ]; then
  python -m pytest tests/ -x --tb=short
  echo -e "${GREEN}  ✓ Tests passed${NC}"
else
  echo -e "  ⚠ No test files found, skipping"
fi

echo ""
echo -e "${GREEN}=== All CI checks passed ===${NC}"
