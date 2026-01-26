# Testing Guide

This document describes the testing architecture for Hushh, with special
emphasis on **BYOK (Bring Your Own Key) compliance**.

## Table of Contents

- [Overview](#overview)
- [BYOK-Compliant Testing](#byok-compliant-testing)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Test Fixtures](#test-fixtures)
- [CI/CD Integration](#cicd-integration)

## Overview

The Hushh test suite is divided into two main areas:

1. **Frontend Tests** (`hushh-webapp/__tests__/`) - TypeScript/Jest
2. **Backend Tests** (`consent-protocol/tests/`) - Python/pytest

Both test suites follow the BYOK security model, meaning:

- **No production encryption keys** are ever used in tests
- Test keys are **dynamically generated** for each test
- Tests verify encryption without exposing plaintext to the server
- Consent tokens are mocked or generated with test-specific secrets

## BYOK-Compliant Testing

### Why BYOK Compliance Matters in Tests

The BYOK architecture ensures that encryption keys never leave the user's
device. This principle must extend to testing:

```
WRONG:
  - Using environment variable VAULT_ENCRYPTION_KEY in tests
  - Hardcoding encryption keys in test files
  - Sharing keys between tests

RIGHT:
  - Generating random keys per test via fixtures
  - Using mock tokens with test-specific SECRET_KEY
  - Isolating test environments from production
```

### Test Key Generation

All encryption tests use the `test_vault_key` fixture from `conftest.py`:

```python
@pytest.fixture
def test_vault_key() -> str:
    """Generate a random vault key for testing (BYOK-compliant)."""
    return os.urandom(32).hex()
```

This ensures:
- Each test gets a unique key
- Keys are not persisted
- Production keys are never used

### Environment Isolation

The `conftest.py` includes an auto-use fixture that isolates the test
environment:

```python
@pytest.fixture(autouse=True)
def isolate_test_environment(monkeypatch):
    """Ensure tests don't use production secrets."""
    monkeypatch.setenv("SECRET_KEY", "test_secret_key_for_testing_only")
    monkeypatch.delenv("VAULT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("TESTING", "true")
```

## Test Structure

### Backend (Python)

```
consent-protocol/tests/
├── conftest.py                    # Shared BYOK-compliant fixtures
├── test_token.py                  # Consent token tests
├── test_vault.py                  # Vault encryption tests
├── test_trust.py                  # TrustLink (A2A) tests
├── test_hushh_adk_foundation.py   # ADK foundation tests
├── test_professional_operon.py   # Operon tests
└── quality/
    ├── test_byok_encryption.py   # Cross-platform encryption compatibility
    ├── test_revocation_persistence.py  # Token revocation tests
    └── test_rate_limiting.py     # Rate limiting tests
```

### Frontend (TypeScript)

```
hushh-webapp/__tests__/
├── api/
│   ├── vault/
│   │   └── food.test.ts          # Vault API tests
│   ├── compliance/
│   │   └── protocol-audit.test.ts # Protocol compliance
│   └── agent/
│       └── chat.test.ts          # Agent chat tests
├── utils/
│   ├── mock-tokens.ts            # Token mocking utilities
│   └── test-helpers.ts           # Test helper functions
└── setup.ts                      # Jest setup configuration
```

## Running Tests

### Backend Tests

```bash
cd consent-protocol

# Run all tests
pytest

# Run with coverage
pytest --cov=hushh_mcp --cov-report=html

# Run specific test file
pytest tests/test_vault.py

# Run specific test
pytest tests/test_vault.py::test_encrypt_decrypt_roundtrip

# Run with verbose output
pytest -v --tb=long
```

### Frontend Tests

```bash
cd hushh-webapp

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- __tests__/api/vault/food.test.ts
```

## Writing New Tests

### Backend Test Template

```python
# tests/test_new_feature.py
"""
Tests for new feature - BYOK Compliant
"""

import pytest
from hushh_mcp.vault.encrypt import encrypt_data, decrypt_data


def test_feature_with_encryption(test_vault_key, mock_consent_token):
    """
    Test description.
    
    Uses fixtures from conftest.py for BYOK compliance.
    """
    # Arrange
    plaintext = '{"key": "value"}'
    
    # Act
    encrypted = encrypt_data(plaintext, test_vault_key)
    decrypted = decrypt_data(encrypted, test_vault_key)
    
    # Assert
    assert decrypted == plaintext


def test_feature_with_consent(mock_vault_owner_token, test_user_id):
    """
    Test that requires consent validation.
    """
    # Use mock token from fixtures
    pass
```

### Frontend Test Template

```typescript
// __tests__/api/new-feature.test.ts
import { mockValidationResponse } from "../utils/mock-tokens";

describe("New Feature", () => {
  beforeEach(() => {
    // Setup mocks
  });

  it("should handle encrypted data correctly", async () => {
    // Use mock tokens and encrypted payloads
    const mockEncrypted = {
      ciphertext: "base64_encrypted_data",
      iv: "base64_iv",
      tag: "base64_tag",
    };

    // Test logic
  });
});
```

## Test Fixtures

### Available Fixtures (conftest.py)

| Fixture | Description |
|---------|-------------|
| `test_vault_key` | Random 256-bit hex key |
| `test_vault_key_bytes` | Random 32-byte key |
| `test_passphrase` | Random passphrase for key derivation |
| `test_salt` | Random 16-byte salt |
| `mock_consent_token` | Valid VAULT_OWNER token |
| `mock_vault_owner_token` | Alias for VAULT_OWNER token |
| `mock_read_food_token` | Token with vault.read.food scope |
| `test_user_id` | Unique test user ID |
| `test_agent_id` | Unique test agent ID |
| `mock_db_pool` | Mocked database pool |
| `sample_encrypted_payload` | Pre-encrypted test data |
| `sample_plaintext_data` | Test data dictionary |
| `mock_trust_link` | A2A TrustLink for testing |

### Using Fixtures

```python
def test_example(test_vault_key, mock_consent_token, test_user_id):
    # Fixtures are automatically injected by pytest
    assert len(test_vault_key) == 64  # 32 bytes as hex
    assert mock_consent_token.startswith("HCT:")
    assert test_user_id.startswith("test_user_")
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests to `main`
- Pushes to `main`

The CI workflow:
1. Sets up Python 3.11 / Node.js 20
2. Installs dependencies
3. Runs linting (ruff, ESLint)
4. Runs type checking (mypy, TypeScript)
5. Runs tests with coverage

### Environment Variables in CI

```yaml
env:
  TESTING: "true"
  SECRET_KEY: "test_secret_key_for_ci_only"
  # Note: VAULT_ENCRYPTION_KEY is NOT set - tests use fixtures
```

## Test Categories

When adding new agents or features, create tests in these categories:

1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test agent → operon → DB flow
3. **BYOK Compliance Tests** - Verify no plaintext keys are exposed
4. **Consent Validation Tests** - Test token requirements
5. **A2A Delegation Tests** - Test TrustLink flows

## Common Mistakes to Avoid

### DON'T: Use Production Keys

```python
# WRONG - BYOK Violation
from hushh_mcp.config import VAULT_ENCRYPTION_KEY
encrypted = encrypt_data(data, VAULT_ENCRYPTION_KEY)
```

### DO: Use Test Fixtures

```python
# RIGHT - BYOK Compliant
def test_encryption(test_vault_key):
    encrypted = encrypt_data(data, test_vault_key)
```

### DON'T: Hardcode Tokens

```python
# WRONG
token = "HCT:hardcoded_token_value"
```

### DO: Use Mock Fixtures

```python
# RIGHT
def test_with_token(mock_consent_token):
    # Token is generated with test SECRET_KEY
```

## Debugging Tests

### Verbose Output

```bash
pytest -v --tb=long tests/test_vault.py
```

### Print Statements

```python
def test_debug(test_vault_key, capsys):
    print(f"Key length: {len(test_vault_key)}")
    # Output captured by pytest
```

### PDB Debugging

```bash
pytest --pdb tests/test_vault.py::test_failing
```

## Questions?

For testing-related questions:
- Open a GitHub issue with the `testing` label
- Ask in the Discord #builders channel
