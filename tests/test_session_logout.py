"""
Hermetic tests for the /consent/logout endpoint.

Covers:
- Happy path: active session tokens are revoked and count is returned
- No active session tokens: returns 0 revoked
- Token user mismatch: 403
- DB error: 500
- Missing/invalid VAULT_OWNER token: 401/403 (from require_vault_owner_token)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_FAKE_TOKEN_DATA = {"user_id": "user-abc", "scope": "vault.owner"}


def _make_app() -> FastAPI:
    app = FastAPI()

    from api.middleware import require_vault_owner_token
    from api.routes.session import router

    app.dependency_overrides[require_vault_owner_token] = lambda: _FAKE_TOKEN_DATA
    app.include_router(router)
    return app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(_make_app(), raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_logout_revokes_active_session_tokens(client: TestClient):
    fake_tokens = [
        {"token_id": "tok-1", "agent_id": "self", "scope": "vault.owner"},
        {"token_id": "tok-2", "agent_id": "self", "scope": "vault.owner"},
    ]
    with (
        patch(
            "hushh_mcp.services.consent_db.ConsentDBService.get_active_tokens",
            new_callable=AsyncMock,
            return_value=fake_tokens,
        ),
        patch("api.routes.session.revoke_token") as mock_revoke,
    ):
        resp = client.post("/api/consent/logout", json={"userId": "user-abc"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["revoked_count"] == 2
    assert mock_revoke.call_count == 2
    mock_revoke.assert_any_call("tok-1")
    mock_revoke.assert_any_call("tok-2")


def test_logout_returns_zero_when_no_active_tokens(client: TestClient):
    with patch(
        "hushh_mcp.services.consent_db.ConsentDBService.get_active_tokens",
        new_callable=AsyncMock,
        return_value=[],
    ):
        resp = client.post("/api/consent/logout", json={"userId": "user-abc"})

    assert resp.status_code == 200
    assert resp.json()["revoked_count"] == 0


def test_logout_skips_tokens_without_token_id(client: TestClient):
    fake_tokens = [
        {"agent_id": "self", "scope": "vault.owner"},  # no token_id key
        {"token_id": None, "agent_id": "self"},  # token_id is None
        {"token_id": "tok-valid", "agent_id": "self"},
    ]
    with (
        patch(
            "hushh_mcp.services.consent_db.ConsentDBService.get_active_tokens",
            new_callable=AsyncMock,
            return_value=fake_tokens,
        ),
        patch("api.routes.session.revoke_token") as mock_revoke,
    ):
        resp = client.post("/api/consent/logout", json={"userId": "user-abc"})

    assert resp.status_code == 200
    assert resp.json()["revoked_count"] == 1
    mock_revoke.assert_called_once_with("tok-valid")


# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------


def test_logout_user_mismatch_returns_403():
    app = FastAPI()
    from api.middleware import require_vault_owner_token
    from api.routes.session import router

    app.dependency_overrides[require_vault_owner_token] = lambda: {
        "user_id": "different-user",
        "scope": "vault.owner",
    }
    app.include_router(router)

    resp = TestClient(app, raise_server_exceptions=False).post(
        "/api/consent/logout", json={"userId": "user-abc"}
    )
    assert resp.status_code == 403
    assert "mismatch" in resp.json()["detail"].lower()


def test_logout_without_auth_returns_401_or_403():
    app = FastAPI()
    from api.routes.session import router

    app.include_router(router)

    resp = TestClient(app, raise_server_exceptions=False).post(
        "/api/consent/logout", json={"userId": "user-abc"}
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


def test_logout_db_error_returns_500(client: TestClient):
    with patch(
        "hushh_mcp.services.consent_db.ConsentDBService.get_active_tokens",
        new_callable=AsyncMock,
        side_effect=RuntimeError("db down"),
    ):
        resp = client.post("/api/consent/logout", json={"userId": "user-abc"})

    assert resp.status_code == 500


def test_logout_db_error_is_not_200(client: TestClient):
    with patch(
        "hushh_mcp.services.consent_db.ConsentDBService.get_active_tokens",
        new_callable=AsyncMock,
        side_effect=Exception("unexpected"),
    ):
        resp = client.post("/api/consent/logout", json={"userId": "user-abc"})

    assert resp.status_code != 200
