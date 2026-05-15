"""Canonical field-constraint tests for ConsentApprovalPayload.

Verifies that Pydantic field constraints on the existing model are
enforced automatically at the API boundary — FastAPI returns HTTP 422
with structured error detail before any handler logic runs.

Test strategy
-------------
Model-level tests  — validate / reject payloads directly via Pydantic,
                     no route involved; fast and deterministic.
Route-level tests  — send HTTP requests to the real /api/consent/pending/approve
                     route via TestClient; auth dependency is overridden;
                     422 confirms constraint enforcement at the API surface.

No DB, no network, no LLM.

Integrated by Abdul Gaffar — canonical model-level field constraints.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.routes.consent import ConsentApprovalPayload

_VALID_USER = "user-constraints-test-001"
_VALID_REQUEST = "req-constraints-abc-001"


# ===========================================================================
# ConsentApprovalPayload — model-level unit tests
# ===========================================================================


class TestUserIdConstraints:
    def test_valid_user_id_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.userId == _VALID_USER

    def test_empty_user_id_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({"userId": "", "requestId": _VALID_REQUEST})
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("userId",) for e in errors)

    def test_whitespace_only_user_id_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({"userId": "   ", "requestId": _VALID_REQUEST})
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("userId",) for e in errors)

    def test_user_id_too_long_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"userId": "a" * 129, "requestId": _VALID_REQUEST}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("userId",) for e in errors)

    def test_user_id_at_max_length_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": "a" * 128, "requestId": _VALID_REQUEST}
        )
        assert len(p.userId) == 128


class TestRequestIdConstraints:
    def test_valid_request_id_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.requestId == _VALID_REQUEST

    def test_empty_request_id_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({"userId": _VALID_USER, "requestId": ""})
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("requestId",) for e in errors)

    def test_whitespace_only_request_id_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({"userId": _VALID_USER, "requestId": "\t"})
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("requestId",) for e in errors)

    def test_request_id_too_long_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"userId": _VALID_USER, "requestId": "r" * 129}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("requestId",) for e in errors)


class TestVersionConstraints:
    def test_version_1_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"version": 1, "userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.version == 1

    def test_version_2_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"version": 2, "userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.version == 2

    def test_version_0_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"version": 0, "userId": _VALID_USER, "requestId": _VALID_REQUEST}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("version",) for e in errors)

    def test_version_3_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"version": 3, "userId": _VALID_USER, "requestId": _VALID_REQUEST}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("version",) for e in errors)

    def test_missing_version_defaults_to_1(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.version == 1


class TestDurationHoursConstraints:
    def test_valid_duration_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST, "durationHours": 24}
        )
        assert p.durationHours == 24

    def test_duration_zero_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"userId": _VALID_USER, "requestId": _VALID_REQUEST, "durationHours": 0}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("durationHours",) for e in errors)

    def test_duration_negative_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"userId": _VALID_USER, "requestId": _VALID_REQUEST, "durationHours": -1}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("durationHours",) for e in errors)

    def test_duration_above_max_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {"userId": _VALID_USER, "requestId": _VALID_REQUEST, "durationHours": 8761}
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("durationHours",) for e in errors)

    def test_duration_at_max_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST, "durationHours": 8760}
        )
        assert p.durationHours == 8760

    def test_duration_none_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {"userId": _VALID_USER, "requestId": _VALID_REQUEST}
        )
        assert p.durationHours is None


class TestRevisionConstraints:
    def test_zero_revision_accepted(self):
        p = ConsentApprovalPayload.model_validate(
            {
                "userId": _VALID_USER,
                "requestId": _VALID_REQUEST,
                "sourceContentRevision": 0,
                "sourceManifestRevision": 0,
            }
        )
        assert p.sourceContentRevision == 0
        assert p.sourceManifestRevision == 0

    def test_negative_content_revision_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {
                    "userId": _VALID_USER,
                    "requestId": _VALID_REQUEST,
                    "sourceContentRevision": -1,
                }
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("sourceContentRevision",) for e in errors)

    def test_negative_manifest_revision_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate(
                {
                    "userId": _VALID_USER,
                    "requestId": _VALID_REQUEST,
                    "sourceManifestRevision": -5,
                }
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("sourceManifestRevision",) for e in errors)


# ===========================================================================
# Route-level — POST /api/consent/pending/approve returns 422 on violations
# ===========================================================================


def _make_test_app() -> FastAPI:
    from api.middleware import require_vault_owner_token
    from api.routes import consent

    app = FastAPI()
    app.include_router(consent.router)
    app.dependency_overrides[require_vault_owner_token] = lambda: {
        "user_id": _VALID_USER,
        "token": "test-vault-token",
    }
    return app


def _mock_db():
    svc = MagicMock()
    svc.get_pending_by_request_id = AsyncMock(return_value=None)
    svc.find_covering_active_token = AsyncMock(return_value=None)
    return svc


class TestRouteReturns422OnConstraintViolation:
    """The API surface returns 422 (not 400, not 500) for constraint violations."""

    def test_empty_user_id_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": "", "requestId": _VALID_REQUEST},
        )
        assert response.status_code == 422

    def test_whitespace_user_id_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": "   ", "requestId": _VALID_REQUEST},
        )
        assert response.status_code == 422

    def test_empty_request_id_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": _VALID_USER, "requestId": ""},
        )
        assert response.status_code == 422

    def test_invalid_version_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": _VALID_USER, "requestId": _VALID_REQUEST, "version": 99},
        )
        assert response.status_code == 422

    def test_zero_duration_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={
                "userId": _VALID_USER,
                "requestId": _VALID_REQUEST,
                "durationHours": 0,
            },
        )
        assert response.status_code == 422

    def test_excessive_duration_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={
                "userId": _VALID_USER,
                "requestId": _VALID_REQUEST,
                "durationHours": 99999,
            },
        )
        assert response.status_code == 422

    def test_422_body_contains_detail_key(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": "", "requestId": _VALID_REQUEST},
        )
        assert response.status_code == 422
        body = response.json()
        assert "detail" in body

    def test_422_detail_names_offending_field(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={"userId": "", "requestId": _VALID_REQUEST},
        )
        body = response.json()
        # loc is ("userId",) — the "body" prefix is only added by FastAPI's
        # automatic parameter machinery; our manual re-raise preserves Pydantic's
        # own loc tuple, which starts directly with the field name.
        locs = [tuple(e["loc"]) for e in body["detail"]]
        assert any("userId" in loc for loc in locs)

    def test_valid_payload_passes_constraints_reaches_auth(self):
        """Valid payload passes Pydantic → gets to the user-ID check → 403."""
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        with patch("api.routes.consent.ConsentDBService", return_value=_mock_db()):
            response = client.post(
                "/api/consent/pending/approve",
                json={"userId": _VALID_USER, "requestId": _VALID_REQUEST},
            )
        # 404 = constraints passed, auth passed, DB returned None
        assert response.status_code == 404

    def test_negative_revision_returns_422(self):
        client = TestClient(_make_test_app(), raise_server_exceptions=False)
        response = client.post(
            "/api/consent/pending/approve",
            json={
                "userId": _VALID_USER,
                "requestId": _VALID_REQUEST,
                "sourceContentRevision": -1,
            },
        )
        assert response.status_code == 422
