"""Regression tests: Kai routes no longer require onboarding fields."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.kai import router as kai_router


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _assert_not_onboarding_block(response) -> None:
    text = response.text or ""
    assert "ONBOARDING_REQUIRED" not in text
    assert "onboarding" not in text.lower() or response.status_code != 428


def test_portfolio_import_no_onboarding_gate(vault_owner_token_for_user):
    app = FastAPI()
    app.include_router(kai_router)
    client = TestClient(app)

    token = vault_owner_token_for_user("user_a")
    response = client.post(
        "/api/kai/portfolio/import",
        data={"user_id": "user_a"},
        files={"file": ("", b"symbol,qty\nAAPL,1\n", "text/csv")},
        headers=_auth(token),
    )

    assert response.status_code in {400, 422}
    _assert_not_onboarding_block(response)


def test_optimize_no_onboarding_gate(vault_owner_token_for_user):
    app = FastAPI()
    app.include_router(kai_router)
    client = TestClient(app)

    token = vault_owner_token_for_user("user_a")
    response = client.post(
        "/api/kai/portfolio/analyze-losers",
        json={"user_id": "user_a", "losers": []},
        headers=_auth(token),
    )

    assert response.status_code == 400
    _assert_not_onboarding_block(response)


def test_analyze_stream_no_onboarding_gate(vault_owner_token_for_user):
    app = FastAPI()
    app.include_router(kai_router)
    client = TestClient(app)

    token = vault_owner_token_for_user("user_a")
    response = client.get(
        "/api/kai/analyze/stream",
        params={"user_id": "user_a"},
        headers=_auth(token),
    )

    assert response.status_code == 422
    _assert_not_onboarding_block(response)
