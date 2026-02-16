# Consent Protocol monorepo integration targets.
# This file is intended to be included by a host monorepo Makefile.

CONSENT_UPSTREAM_REMOTE ?= consent-upstream
CONSENT_UPSTREAM_BRANCH ?= main
CONSENT_SUBTREE_PREFIX ?= consent-protocol
CONSENT_SYNC_REF ?= refs/subtree-sync/consent-protocol
CONSENT_MONOREPO_OPS ?= consent-protocol/ops/monorepo

.PHONY: sync-protocol check-protocol-sync push-protocol push-protocol-force setup verify-setup

sync-protocol: ## Pull latest consent-protocol from upstream
	@echo "Pulling $(CONSENT_SUBTREE_PREFIX) from upstream..."
	git fetch $(CONSENT_UPSTREAM_REMOTE) $(CONSENT_UPSTREAM_BRANCH) --quiet
	git subtree pull --prefix=$(CONSENT_SUBTREE_PREFIX) $(CONSENT_UPSTREAM_REMOTE) $(CONSENT_UPSTREAM_BRANCH) --squash
	@echo "Updating sync bookmark..."
	git update-ref $(CONSENT_SYNC_REF) $$(git rev-parse $(CONSENT_UPSTREAM_REMOTE)/$(CONSENT_UPSTREAM_BRANCH))
	@echo "Done. $(CONSENT_SUBTREE_PREFIX)/ is now in sync with upstream."
	@echo "Bookmark: $$(git rev-parse $(CONSENT_SYNC_REF) | cut -c1-8)"

check-protocol-sync: ## Check if consent-protocol is in sync with upstream
	@CONSENT_UPSTREAM_REMOTE=$(CONSENT_UPSTREAM_REMOTE) \
	CONSENT_UPSTREAM_BRANCH=$(CONSENT_UPSTREAM_BRANCH) \
	CONSENT_SUBTREE_PREFIX=$(CONSENT_SUBTREE_PREFIX) \
	CONSENT_SYNC_REF=$(CONSENT_SYNC_REF) \
	sh $(CONSENT_MONOREPO_OPS)/pre-push.sh --check-only

push-protocol: check-protocol-sync ## Push consent-protocol changes to upstream (sync check first)
	@echo "Pushing $(CONSENT_SUBTREE_PREFIX)/ to upstream..."
	git subtree push --prefix=$(CONSENT_SUBTREE_PREFIX) $(CONSENT_UPSTREAM_REMOTE) $(CONSENT_UPSTREAM_BRANCH)
	@echo "Done. Upstream consent-protocol repo is now updated."

push-protocol-force: ## Push consent-protocol to upstream (skip sync check)
	@echo "⚠  Skipping upstream sync check (force mode)..."
	@echo "Pushing $(CONSENT_SUBTREE_PREFIX)/ to upstream..."
	git subtree push --prefix=$(CONSENT_SUBTREE_PREFIX) $(CONSENT_UPSTREAM_REMOTE) $(CONSENT_UPSTREAM_BRANCH)
	@echo "Done. Upstream consent-protocol repo is now updated."

setup: ## First-time setup (hooks + remote + verification)
	@CONSENT_UPSTREAM_REMOTE=$(CONSENT_UPSTREAM_REMOTE) \
	CONSENT_UPSTREAM_BRANCH=$(CONSENT_UPSTREAM_BRANCH) \
	CONSENT_SUBTREE_PREFIX=$(CONSENT_SUBTREE_PREFIX) \
	CONSENT_SYNC_REF=$(CONSENT_SYNC_REF) \
	sh $(CONSENT_MONOREPO_OPS)/setup.sh
	@echo ""
	@$(MAKE) --no-print-directory verify-setup

verify-setup: ## Verify your dev environment is correctly configured
	@echo ""
	@echo "==============================================="
	@echo " Hushh Research — Setup Verification"
	@echo "==============================================="
	@echo ""
	@printf "  Git hooks path:        "; \
	HP=$$(git config core.hooksPath 2>/dev/null || echo ""); \
	if [ "$$HP" = ".githooks" ]; then printf "\033[32m✅ .githooks\033[0m\n"; \
	else printf "\033[31m❌ not set (run: make setup)\033[0m\n"; fi
	@printf "  pre-commit hook:       "; \
	if [ -x .githooks/pre-commit ]; then printf "\033[32m✅ installed\033[0m\n"; \
	else printf "\033[31m❌ missing or not executable\033[0m\n"; fi
	@printf "  pre-push hook:         "; \
	if [ -x .githooks/pre-push ]; then printf "\033[32m✅ installed\033[0m\n"; \
	else printf "\033[31m❌ missing or not executable\033[0m\n"; fi
	@printf "  $(CONSENT_UPSTREAM_REMOTE):      "; \
	if git remote | grep -q "$(CONSENT_UPSTREAM_REMOTE)"; then printf "\033[32m✅ configured\033[0m\n"; \
	else printf "\033[31m❌ not configured (run: make setup)\033[0m\n"; fi
	@printf "  python3:               "; \
	if command -v python3 >/dev/null 2>&1; then printf "\033[32m✅ $$(python3 --version 2>&1)\033[0m\n"; \
	else printf "\033[31m❌ not found\033[0m\n"; fi
	@printf "  ruff:                  "; \
	if python3 -m ruff --version >/dev/null 2>&1; then printf "\033[32m✅ $$(python3 -m ruff --version 2>&1)\033[0m\n"; \
	else printf "\033[31m❌ not found (pip3 install ruff)\033[0m\n"; fi
	@printf "  node:                  "; \
	if command -v node >/dev/null 2>&1; then printf "\033[32m✅ $$(node --version 2>&1)\033[0m\n"; \
	else printf "\033[31m❌ not found\033[0m\n"; fi
	@echo ""
