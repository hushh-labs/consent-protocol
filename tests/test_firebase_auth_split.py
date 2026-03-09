from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.utils.firebase_auth import verify_firebase_bearer


def test_verify_firebase_bearer_uses_auth_specific_admin_app(monkeypatch):
    import firebase_admin.auth as firebase_auth

    fake_app = object()
    bearer_value = "abc123"

    monkeypatch.setattr(
        "api.utils.firebase_auth.ensure_firebase_auth_admin",
        lambda: (True, "hushh-pda"),
    )
    monkeypatch.setattr("api.utils.firebase_auth.get_firebase_auth_app", lambda: fake_app)

    def fake_verify(token: str, app=None):
        assert token == bearer_value
        assert app is fake_app
        return {"uid": "user_123"}

    monkeypatch.setattr(firebase_auth, "verify_id_token", fake_verify)

    assert verify_firebase_bearer(f"Bearer {bearer_value}") == "user_123"


def test_verify_firebase_bearer_returns_500_when_auth_admin_missing(monkeypatch):
    monkeypatch.setattr(
        "api.utils.firebase_auth.ensure_firebase_auth_admin",
        lambda: (False, None),
    )

    with pytest.raises(HTTPException) as exc:
        verify_firebase_bearer("Bearer abc123")

    assert exc.value.status_code == 500
    assert exc.value.detail == "Firebase Admin not configured"
