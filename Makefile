# Consent Protocol -- Development Commands
# =========================================
# For the standalone backend repository.
# Run `make help` to see all available targets.

.PHONY: help dev lint format typecheck test security ci-local clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# === Development ===

dev: ## Start the backend server (port 8000)
	python -m uvicorn server:app --reload --port 8000

# === Quality Checks ===

lint: ## Run linter (ruff)
	ruff check .

format: ## Format code (ruff)
	ruff format .

format-check: ## Check formatting without changes
	ruff format --check .

typecheck: ## Run type checker (mypy)
	mypy --config-file pyproject.toml --ignore-missing-imports .

test: ## Run tests (pytest)
	pytest tests/ -v

security: ## Run security scan (bandit)
	bandit -r hushh_mcp/ api/ -c pyproject.toml

# === Combined Checks ===

ci-local: lint format-check typecheck test security ## Run all CI checks locally

# === Utilities ===

clean: ## Clean up generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .coverage htmlcov/ .ruff_cache/
