from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import developer


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(developer.router)
    return app


def test_list_scopes_returns_dynamic_catalog(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEVELOPER_API_ENABLED", "true")

    client = TestClient(_build_app())
    response = client.get("/api/v1/list-scopes")

    assert response.status_code == 200
    payload = response.json()
    names = [item["name"] for item in payload["scopes"]]
    assert payload["scopes_are_dynamic"] is True
    assert "world_model.read" in names
    assert "attr.{domain}.*" in names
    assert payload["request_endpoint"] == "/api/v1/request-consent"
    assert "hushh://info/developer-api" in payload["mcp_resources"]
    assert payload["recommended_flow"][-1] == "get_scoped_data"


def test_developer_root_returns_mcp_summary(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEVELOPER_API_ENABLED", "true")

    client = TestClient(_build_app())
    response = client.get("/api/v1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["endpoints"]["user_scopes"] == "/api/v1/user-scopes/{user_id}"
    assert "hushh://info/connector" in payload["recommended_resources"]
    assert payload["recommended_mcp_flow"][0] == "discover_user_domains"


def test_user_scopes_requires_developer_token(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEVELOPER_API_ENABLED", "true")
    monkeypatch.setenv("MCP_DEVELOPER_TOKEN", "secret-token")

    client = TestClient(_build_app())
    response = client.get("/api/v1/user-scopes/user_123")

    assert response.status_code == 401
    detail = response.json()["detail"]
    assert detail["error_code"] == "DEVELOPER_TOKEN_REQUIRED"


def test_user_scopes_returns_discovered_domains(monkeypatch):
    class _FakeScopeGenerator:
        async def get_available_scopes(self, user_id: str) -> list[str]:
            assert user_id == "user_123"
            return ["attr.financial.*", "attr.financial.profile.*", "world_model.read"]

    class _FakeIndex:
        available_domains = ["financial"]

    class _FakeWorldModel:
        scope_generator = _FakeScopeGenerator()

        async def get_index_v2(self, user_id: str):
            assert user_id == "user_123"
            return _FakeIndex()

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEVELOPER_API_ENABLED", "true")
    monkeypatch.setenv("MCP_DEVELOPER_TOKEN", "secret-token")
    monkeypatch.setattr(developer, "get_world_model_service", lambda: _FakeWorldModel())

    client = TestClient(_build_app())
    response = client.get(
        "/api/v1/user-scopes/user_123",
        headers={"X-MCP-Developer-Token": "secret-token"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["available_domains"] == ["financial"]
    assert "attr.financial.*" in payload["scopes"]


def test_request_consent_creates_pending_request(monkeypatch):
    inserted: dict[str, object] = {}

    class _FakeScopeGenerator:
        async def get_available_scopes(self, user_id: str) -> list[str]:
            assert user_id == "user_123"
            return ["attr.financial.*", "world_model.read"]

    class _FakeIndex:
        available_domains = ["financial"]

    class _FakeWorldModel:
        scope_generator = _FakeScopeGenerator()

        async def get_index_v2(self, user_id: str):
            assert user_id == "user_123"
            return _FakeIndex()

    class _FakeConsentDBService:
        async def get_active_tokens(
            self, user_id: str, agent_id: str | None = None, scope: str | None = None
        ):
            assert user_id == "user_123"
            assert agent_id == "partner-app"
            assert scope == "attr.financial.*"
            return []

        async def was_recently_denied(self, user_id: str, scope: str, cooldown_seconds: int = 60):
            assert user_id == "user_123"
            assert scope == "attr.financial.*"
            assert cooldown_seconds == 60
            return False

        async def insert_event(self, **kwargs):  # noqa: ANN003
            inserted.update(kwargs)
            return 1

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("DEVELOPER_API_ENABLED", "true")
    monkeypatch.setenv("MCP_DEVELOPER_TOKEN", "secret-token")
    monkeypatch.setattr(developer, "get_world_model_service", lambda: _FakeWorldModel())
    monkeypatch.setattr(developer, "ConsentDBService", _FakeConsentDBService)

    client = TestClient(_build_app())
    response = client.post(
        "/api/v1/request-consent",
        headers={"X-MCP-Developer-Token": "secret-token"},
        json={
            "user_id": "user_123",
            "developer_token": "secret-token",
            "agent_id": "partner-app",
            "scope": "attr.financial.*",
            "expiry_hours": 24,
            "reason": "Portfolio analysis",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending"
    assert payload["scope"] == "attr.financial.*"
    assert inserted["action"] == "REQUESTED"
    assert inserted["agent_id"] == "partner-app"
    assert inserted["scope"] == "attr.financial.*"
