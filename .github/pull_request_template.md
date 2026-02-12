## Summary

<!-- 1-3 bullet points describing what this PR does -->

## Type

<!-- Check one -->
- [ ] Bug fix
- [ ] Feature (new agent, operon, endpoint)
- [ ] Enhancement (existing functionality)
- [ ] Documentation
- [ ] Refactor (no behavior change)

## Checklist

### Required for all PRs
- [ ] `ruff check .` passes
- [ ] `ruff format --check .` passes
- [ ] `mypy --config-file pyproject.toml` passes
- [ ] `pytest tests/ -v` passes
- [ ] `bandit -r hushh_mcp/ api/ -c pyproject.toml` passes

### If adding/modifying agents or tools
- [ ] Consent is validated at agent entry (`HushhAgent.run()`)
- [ ] Consent is validated at each tool invocation (`@hushh_tool`)
- [ ] Agent manifest (`agent.yaml`) is created/updated
- [ ] Documentation updated in `docs/reference/agent-development.md`

### If adding/modifying operons
- [ ] Purity classification is correct (PURE vs IMPURE)
- [ ] IMPURE operons validate consent before user data access
- [ ] Tests cover the new operon
- [ ] Operon catalog updated in `docs/reference/agent-development.md`

### If adding/modifying API routes
- [ ] Service layer is used (no direct DB access from routes)
- [ ] Route documented in API contracts
- [ ] Tests cover the new endpoint

### If modifying database schema
- [ ] SQL migration file added in `db/migrations/`
- [ ] `docs/reference/world-model.md` updated if schema changed

## Testing

<!-- How was this tested? -->

## Related Issues

<!-- Link related issues: Fixes #123, Relates to #456 -->
