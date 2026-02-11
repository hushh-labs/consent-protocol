# Contributor Onboarding Guide

Welcome to Hushh! This guide will walk you through making your first contribution.

## 🎯 Overview

This guide covers:
1. Setting up your development environment
2. Finding your first issue
3. Testing CI locally before committing
4. Making your first contribution
5. Submitting a pull request

---

## Step 1: Set Up Your Environment

### Prerequisites

Before you start, ensure you have:

- **Node.js**: v20+ ([Download](https://nodejs.org/))
- **Python**: 3.13 ([Download](https://www.python.org/downloads/); backend targets 3.13)
- **Git**: Latest version
- **PostgreSQL**: Local or Cloud SQL instance
- **Firebase Project**: For authentication (see [Getting Started](../getting_started.md))

### Initial Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hushh-research.git
   cd hushh-research
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/hushh-labs/hushh-research.git
   ```

4. **Install dependencies**:
   ```bash
   # Frontend
   cd hushh-webapp
   npm install
   cd ..
   
   # Backend
   cd consent-protocol
   pip install -r requirements.txt
   pip install pytest pytest-cov pytest-asyncio mypy ruff  # Dev dependencies
   cd ..
   ```

5. **Configure environment**:
   - Copy `consent-protocol/.env.example` to `consent-protocol/.env` and fill in values
   - Copy `hushh-webapp/.env.local.example` to `hushh-webapp/.env.local` and fill in values
   - **Important**: Ensure `GOOGLE_GENAI_USE_VERTEXAI=True` is set for Gemini 3 models
   - See [Getting Started Guide](../../getting_started.md) for details

6. **Verify setup**:
   ```bash
   # Test backend
   cd consent-protocol
   python -m pytest tests/ -v
   cd ..
   
   # Test frontend
   cd hushh-webapp
   npm run build
   cd ..
   ```

---

## Step 2: Find Your First Issue

### Good First Issues

Look for issues labeled `good-first-issue`:
- Documentation improvements
- Small bug fixes
- Test additions
- UI polish

### Finding Issues

1. Go to the [Issues page](https://github.com/hushh-labs/hushh-research/issues)
2. Filter by `good-first-issue` label
3. Read the issue description carefully
4. Comment on the issue to claim it (prevents duplicate work)

### Understanding the Issue

Before you start coding:
- Read the issue description and comments
- Check related documentation in `docs/`
- Understand which parts of the codebase are affected
- Ask questions if anything is unclear

---

## Step 3: Test CI Locally (Critical!)

**Always test CI checks locally before committing.** This saves time and prevents broken PRs. See the [CI Configuration Reference](../reference/ci.md) for the full workflow, path filters, and coding rules.

### Run Local CI Tests

```bash
# From repository root
./scripts/test-ci-local.sh
```

This script runs the same checks as GitHub Actions CI:
- ✅ Frontend: TypeScript, lint, Next build, Capacitor build
- ✅ Backend: Ruff lint, Mypy type check, pytest
- ✅ Integration: Route contract verification (must pass in CI)

### What to Expect

**If all checks pass:**
```
✅ All critical CI checks passed locally
Ready to commit! 🚀
```

**If checks fail:**
```
❌ Some critical CI checks failed.
Fix the issues above before committing.
```

### Fixing Issues

1. **TypeScript errors**: Fix type issues in `hushh-webapp/`
2. **Lint errors**: Run `npm run lint:fix` or `python -m ruff check --fix .`
3. **Test failures**: Fix failing tests in `consent-protocol/tests/`
4. **Build errors**: Check for missing dependencies or configuration

### When to Run Local CI

- ✅ Before creating a branch
- ✅ After making changes
- ✅ Before committing
- ✅ Before pushing to GitHub

---

## Step 4: Make Your Changes

### Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch (use format: /[username]/[type]/[type-name])
git checkout -b YOUR_USERNAME/feat/your-feature-name
# or
git checkout -b YOUR_USERNAME/fix/your-bug-fix
# or
git checkout -b YOUR_USERNAME/docs/your-doc-update
```

### Follow Architecture Rules

**Remember the three critical rules:**

1. **Tri-Flow Rule**: If your feature touches backend data or device capabilities, implement:
   - Web: Next.js API route (`hushh-webapp/app/api/...`)
   - iOS: Swift plugin (`hushh-webapp/ios/App/App/Plugins/...`)
   - Android: Kotlin plugin (`hushh-webapp/android/.../plugins/...`)

2. **Consent-First**: Always validate consent tokens. Never bypass validation.

3. **Zero-Knowledge (BYOK)**: Never store keys on the server. Decrypt client-side only.

### Write Code

- Follow existing code style
- Add comments for complex logic
- Use TypeScript types (frontend) and Pydantic models (backend)
- Handle errors gracefully

### Test Your Changes

```bash
# Frontend
cd hushh-webapp
npm run dev  # Test in browser
npm run build  # Verify build works

# Backend
cd consent-protocol
python -m pytest tests/ -v  # Run tests
```

---

## Step 5: Commit Your Changes

### Before Committing

1. **Run local CI**:
   ```bash
   ./scripts/test-ci-local.sh
   ```

2. **Optional: Set up pre-commit hooks** (recommended):
   ```bash
   # Install pre-commit (if not already installed)
   pip install pre-commit
   
   # Set up hooks (when available)
   # pre-commit install
   ```
   > **Note**: Pre-commit hooks are planned for Phase 2. For now, always run `./scripts/test-ci-local.sh` manually before committing.

3. **Stage your changes**:
   ```bash
   git add .
   ```

4. **Check what you're committing**:
   ```bash
   git status
   git diff --cached
   ```

### Write a Good Commit Message

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add movie recommendation agent
fix: resolve vault unlock race condition
docs: update contributor guide
test: add tests for consent validation
```

**Format:**
```
<type>: <short description>

<optional longer description>
<optional references to issues>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `style`: Formatting
- `chore`: Maintenance

**AI-assisted commits (required from now on):** If any change was produced or assisted by AI, the commit message **body** must include:
1. `Signed-off-by: [AI Provider Name] <[identifier]>` (e.g. `Signed-off-by: Cursor AI (Claude) <ai@cursor.com>`).
2. `Tokens used: [as provided by environment]` when your IDE or tool reports token usage.

See [Contributing - AI-Assisted Contributions](../../contributing.md)
### Commit

```bash
git commit -m "feat: add movie recommendation agent"
```

```bash
git commit -m "feat: add movie recommendation agent" -m "Signed-off-by: Cursor AI (Claude) <ai@cursor.com>" -m "Tokens used: 12500 (input) / 800 (output)"
```

---

## Step 6: Submit a Pull Request

### Push Your Branch

```bash
git push origin YOUR_USERNAME/feat/your-feature-name
```

### Create PR on GitHub

1. Go to [Pull Requests](https://github.com/hushh-labs/hushh-research/pulls)
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template:

### PR Template Checklist

- [ ] **Description**: Clear explanation of what changed and why
- [ ] **Tri-Flow Checklist** (if applicable):
  - [ ] Web Implementation
  - [ ] iOS Implementation
  - [ ] Android Implementation
  - [ ] Service Layer
  - [ ] TypeScript Interface
- [ ] **Testing**: What you tested and how
- [ ] **Screenshots/Video**: Visual proof (if UI changes)

### After Submitting

1. **Wait for CI**: GitHub Actions will run automatically
2. **Address feedback**: Respond to review comments
3. **Update PR**: Push fixes if requested
4. **Celebrate**: Once approved and merged! 🎉

---

## Common Issues & Solutions

### Local CI Fails

**Problem**: `npm ci` fails
**Solution**: Delete `node_modules` and `package-lock.json`, then `npm install`

**Problem**: Python tests fail
**Solution**: Ensure environment variables are set (see `.env` file)

**Problem**: TypeScript errors
**Solution**: Run `npx tsc --noEmit` to see detailed errors

### PR Fails CI

**Problem**: CI fails on GitHub but passed locally
**Solution**: 
- Check environment differences
- Ensure all dependencies are in `package.json`/`requirements.txt`
- Verify environment variables match CI

### Merge Conflicts

**Problem**: Your branch is out of date
**Solution**:
```bash
git checkout main
git pull upstream main
git checkout YOUR_USERNAME/feat/your-feature-name
git rebase main
# Resolve conflicts, then:
git add .
git rebase --continue
git push --force-with-lease origin YOUR_USERNAME/feat/your-feature-name
```

---

## Next Steps

After your first contribution:

1. **Join Discord**: [Join our community](https://discord.gg/fd38enfsH5)
2. **Find more issues**: Look for `help-wanted` labels
3. **Review PRs**: Help review other contributors' work
4. **Share feedback**: Tell us how we can improve the onboarding process

---

## Resources

- [Getting Started Guide](../../getting_started.md) - Detailed setup instructions
- [Contributing Guide](../../contributing.md) - Architecture rules and guidelines
- [Project Context Map](../project_context_map.md) - Understanding the codebase
- [Feature Checklist](../guides/feature_checklist.md) - Building new features
- [Route Contracts](../reference/route_contracts.md) - API contract documentation

---

## Getting Help

- **Discord**: [Join our Discord](https://discord.gg/fd38enfsH5) for real-time help
- **GitHub Issues**: Open an issue for bugs or feature requests
- **Documentation**: Check `docs/` for detailed guides

---

Thank you for contributing to Hushh! 🚀
