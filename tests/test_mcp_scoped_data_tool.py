from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from mcp_modules.tools import data_tools


@pytest.mark.asyncio
async def test_get_scoped_data_returns_decrypted_payload(monkeypatch):
    async def _resolve(user_id: str) -> str:
        assert user_id == "user@example.com"
        return "user_123"

    async def _validate(token: str, expected_scope=None):  # noqa: ANN001
        assert token == "token_123"  # noqa: S105
        assert expected_scope == "attr.financial.*"
        return (
            True,
            None,
            SimpleNamespace(
                user_id="user_123",
                scope_str="attr.financial.*",
                scope=SimpleNamespace(value="world_model.read"),
            ),
        )

    async def _fetch(token: str):
        assert token == "token_123"  # noqa: S105
        return {"financial": {"risk_profile": "balanced"}}

    monkeypatch.setattr(data_tools, "resolve_email_to_uid", _resolve)
    monkeypatch.setattr(data_tools, "validate_token_with_db", _validate)
    monkeypatch.setattr(data_tools, "_fetch_decrypted_export", _fetch)

    result = await data_tools.handle_get_scoped_data(
        {
            "user_id": "user@example.com",
            "consent_token": "token_123",
            "expected_scope": "attr.financial.*",
        }
    )

    payload = json.loads(result[0].text)
    assert payload["status"] == "success"
    assert payload["user_id"] == "user_123"
    assert payload["scope"] == "attr.financial.*"
    assert payload["data"]["financial"]["risk_profile"] == "balanced"
