from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware import require_firebase_auth
from api.routes import consent, iam, invites, marketplace, ria
from hushh_mcp.services.ria_iam_service import (
    IAMSchemaNotReadyError,
    RIAIAMPolicyError,
    RIAIAMService,
)

TEST_INVITE_ID = "invite-demo-id"
TEST_INVITE_VALUE = "invite-demo-value"


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(consent.router)
    app.include_router(iam.router)
    app.include_router(ria.router)
    app.include_router(marketplace.router)
    app.include_router(invites.router)
    app.dependency_overrides[require_firebase_auth] = lambda: "user_test_123"
    return app


def test_iam_persona_returns_actor_state(monkeypatch):
    async def _mock_get_persona_state(self, user_id: str):
        assert user_id == "user_test_123"
        return {
            "user_id": user_id,
            "personas": ["investor", "ria"],
            "last_active_persona": "ria",
            "investor_marketplace_opt_in": True,
        }

    monkeypatch.setattr(RIAIAMService, "get_persona_state", _mock_get_persona_state)

    client = TestClient(_build_app())
    response = client.get("/api/iam/persona")

    assert response.status_code == 200
    payload = response.json()
    assert payload["last_active_persona"] == "ria"
    assert payload["investor_marketplace_opt_in"] is True


def test_iam_persona_schema_not_ready_returns_compat_payload(monkeypatch):
    async def _mock_get_persona_state(self, user_id: str):
        assert user_id == "user_test_123"
        raise IAMSchemaNotReadyError("IAM schema is not ready")

    monkeypatch.setattr(RIAIAMService, "get_persona_state", _mock_get_persona_state)

    client = TestClient(_build_app())
    response = client.get("/api/iam/persona")

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == "user_test_123"
    assert payload["personas"] == ["investor"]
    assert payload["last_active_persona"] == "investor"
    assert payload["iam_schema_ready"] is False
    assert payload["mode"] == "compat_investor"


def test_ria_request_enforces_verification_policy(monkeypatch):
    async def _mock_create(self, user_id: str, **kwargs):  # noqa: ANN003
        assert user_id == "user_test_123"
        raise RIAIAMPolicyError("RIA verification incomplete", status_code=403)

    monkeypatch.setattr(RIAIAMService, "create_ria_consent_request", _mock_create)

    client = TestClient(_build_app())
    response = client.post(
        "/api/ria/requests",
        json={
            "subject_user_id": "investor_1",
            "requester_actor_type": "ria",
            "subject_actor_type": "investor",
            "scope_template_id": "ria_financial_summary_v1",
            "duration_mode": "preset",
            "duration_hours": 168,
        },
    )

    assert response.status_code == 403
    assert "verification" in response.json()["detail"].lower()


def test_ria_clients_schema_not_ready_returns_503(monkeypatch):
    async def _mock_clients(self, user_id: str):
        assert user_id == "user_test_123"
        raise IAMSchemaNotReadyError("IAM schema is not ready")

    monkeypatch.setattr(RIAIAMService, "list_ria_clients", _mock_clients)

    client = TestClient(_build_app())
    response = client.get("/api/ria/clients")

    assert response.status_code == 503
    payload = response.json()
    assert payload["code"] == "IAM_SCHEMA_NOT_READY"


def test_marketplace_rias_public_read(monkeypatch):
    async def _mock_search(self, **kwargs):  # noqa: ANN003
        assert kwargs.get("limit") == 20
        return [
            {
                "id": "ria_1",
                "display_name": "RIA Alpha",
                "verification_status": "finra_verified",
            }
        ]

    monkeypatch.setattr(RIAIAMService, "search_marketplace_rias", _mock_search)

    client = TestClient(_build_app())
    response = client.get("/api/marketplace/rias")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["display_name"] == "RIA Alpha"


def test_marketplace_schema_not_ready_returns_503(monkeypatch):
    async def _mock_search(self, **kwargs):  # noqa: ANN003
        _ = kwargs
        raise IAMSchemaNotReadyError("IAM schema is not ready")

    monkeypatch.setattr(RIAIAMService, "search_marketplace_rias", _mock_search)

    client = TestClient(_build_app())
    response = client.get("/api/marketplace/rias")

    assert response.status_code == 503
    payload = response.json()
    assert payload["code"] == "IAM_SCHEMA_NOT_READY"


def test_ria_invites_create(monkeypatch):
    async def _mock_create(self, user_id: str, **kwargs):  # noqa: ANN003
        assert user_id == "user_test_123"
        assert kwargs["scope_template_id"] == "ria_financial_summary_v1"
        return {
            "items": [
                {
                    "invite_id": "invite_1",
                    "invite_token": TEST_INVITE_VALUE,
                    "status": "sent",
                }
            ]
        }

    monkeypatch.setattr(RIAIAMService, "create_ria_invites", _mock_create)

    client = TestClient(_build_app())
    response = client.post(
        "/api/ria/invites",
        json={
            "scope_template_id": "ria_financial_summary_v1",
            "duration_mode": "preset",
            "duration_hours": 168,
            "targets": [{"display_name": "Taylor", "email": "taylor@example.com"}],
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["invite_token"] == TEST_INVITE_VALUE


def test_public_invite_lookup(monkeypatch):
    async def _mock_get(self, invite_token: str):
        assert invite_token == TEST_INVITE_VALUE
        return {
            "invite_token": invite_token,
            "status": "sent",
            "ria": {"display_name": "RIA Alpha"},
        }

    monkeypatch.setattr(RIAIAMService, "get_ria_invite", _mock_get)

    client = TestClient(_build_app())
    response = client.get(f"/api/invites/{TEST_INVITE_VALUE}")

    assert response.status_code == 200
    assert response.json()["ria"]["display_name"] == "RIA Alpha"


def test_accept_invite(monkeypatch):
    async def _mock_accept(self, invite_token: str, user_id: str):
        assert invite_token == TEST_INVITE_VALUE
        assert user_id == "user_test_123"
        return {
            "invite_token": invite_token,
            "request_id": "req_1",
            "status": "accepted",
        }

    monkeypatch.setattr(RIAIAMService, "accept_ria_invite", _mock_accept)

    client = TestClient(_build_app())
    response = client.post(f"/api/invites/{TEST_INVITE_VALUE}/accept")

    assert response.status_code == 200
    assert response.json()["request_id"] == "req_1"


def test_consent_center_returns_combined_surface(monkeypatch):
    async def _mock_center(self, user_id: str):
        assert user_id == "user_test_123"
        return {
            "user_id": user_id,
            "persona_state": {"last_active_persona": "investor"},
            "summary": {"incoming_requests": 1},
            "incoming_requests": [{"id": "req_1", "kind": "incoming_request"}],
            "outgoing_requests": [],
            "active_grants": [],
            "history": [],
            "invites": [],
            "developer_requests": [],
        }

    from hushh_mcp.services.consent_center_service import ConsentCenterService

    monkeypatch.setattr(ConsentCenterService, "get_center", _mock_center)

    client = TestClient(_build_app())
    response = client.get("/api/consent/center")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["incoming_requests"] == 1
    assert payload["incoming_requests"][0]["kind"] == "incoming_request"


def test_generic_consent_request_routes_to_ria_request_creation(monkeypatch):
    async def _mock_create(self, user_id: str, **kwargs):  # noqa: ANN003
        assert user_id == "user_test_123"
        assert kwargs["scope_template_id"] == "ria_financial_summary_v1"
        return {"request_id": "req_generic_1", "status": "REQUESTED"}

    monkeypatch.setattr(RIAIAMService, "create_ria_consent_request", _mock_create)

    client = TestClient(_build_app())
    response = client.post(
        "/api/consent/requests",
        json={
            "subject_user_id": "investor_1",
            "requester_actor_type": "ria",
            "subject_actor_type": "investor",
            "scope_template_id": "ria_financial_summary_v1",
            "duration_mode": "preset",
            "duration_hours": 168,
        },
    )

    assert response.status_code == 200
    assert response.json()["request_id"] == "req_generic_1"
