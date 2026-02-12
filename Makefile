# Consent Protocol -- Development Commands
# =========================================
# For the standalone backend repository.
# Run `make help` to see all available targets.

.PHONY: help dev lint format format-check fix typecheck test security ci-local clean

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

fix: ## Auto-format and lint-fix (run before committing)
	ruff format .
	ruff check . --fix

typecheck: ## Run type checker (mypy)
	mypy --config-file pyproject.toml --ignore-missing-imports

test: ## Run tests (pytest)
	TESTING=true \
	SECRET_KEY="test_secret_key_for_ci_only_32chars_min" \
	VAULT_ENCRYPTION_KEY="635ce8d8018dee8b98ec987dc2dbfb79f3658ac7a54d4cb4c6150a21cd60098f" \
	PYTHONPATH=. pytest tests/ -v --tb=short

security: ## Run security scan (bandit, Medium+ severity)
	bandit -r hushh_mcp/ api/ -c pyproject.toml -ll

# === Combined Checks ===

ci-local: lint format-check typecheck test security ## Run all CI checks locally
	@echo ""
	@echo "All CI checks passed!"

# === Utilities ===

clean: ## Clean up generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .coverage htmlcov/ .ruff_cache/
