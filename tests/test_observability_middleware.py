import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middlewares.observability import (
    REQUEST_ID_HEADER,
    _status_bucket,
    observability_middleware,
)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(observability_middleware)

    @app.get("/ok")
    async def ok_route():
        return {"ok": True}

    @app.get("/boom")
    async def boom_route():
        raise RuntimeError("boom")

    return app


def test_request_id_generated_when_missing():
    client = TestClient(_build_app())

    response = client.get("/ok")

    assert response.status_code == 200
    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert isinstance(request_id, str)
    assert len(request_id) >= 8


def test_request_id_preserved_when_provided():
    client = TestClient(_build_app())

    response = client.get("/ok", headers={REQUEST_ID_HEADER: "req_test_12345678"})

    assert response.status_code == 200
    assert response.headers.get(REQUEST_ID_HEADER) == "req_test_12345678"


def test_unhandled_exception_returns_request_id_header():
    client = TestClient(_build_app(), raise_server_exceptions=False)

    response = client.get("/boom")

    assert response.status_code == 500
    assert response.headers.get(REQUEST_ID_HEADER)


def test_expected_status_bucket_classification():
    assert _status_bucket("POST", "/api/kai/analyze/run/start", 409) == "4xx_expected"
    assert _status_bucket("GET", "/api/kai/analyze/run/active", 404) == "4xx_expected"
    assert _status_bucket("GET", "/api/kai/analyze/run/active", 401) == "4xx_unexpected"
    assert _status_bucket("GET", "/health", 200) == "2xx"


def test_unhandled_exception_response_body_does_not_leak_runtime_detail():
    client = TestClient(_build_app(), raise_server_exceptions=False)

    response = client.get("/boom")

    body = response.json()
    assert "boom" not in body.get("detail", "").lower()


def test_malformed_request_id_header_is_replaced_with_fresh_id():
    client = TestClient(_build_app())

    response = client.get("/ok", headers={REQUEST_ID_HEADER: "bad id!!!"})

    returned_id = response.headers.get(REQUEST_ID_HEADER)
    assert returned_id is not None
    assert returned_id != "bad id!!!"
    assert len(returned_id) >= 8


@pytest.mark.parametrize(
    "method,route,status,expected_bucket",
    [
        ("GET", "/anything", 200, "2xx"),
        ("POST", "/anything", 201, "2xx"),
        ("GET", "/anything", 301, "3xx"),
        ("GET", "/anything", 302, "3xx"),
        ("GET", "/anything", 400, "4xx_unexpected"),
        ("GET", "/anything", 422, "4xx_unexpected"),
        ("GET", "/anything", 500, "5xx"),
        ("GET", "/anything", 503, "5xx"),
        ("GET", "/api/pkm/metadata/{user_id}", 401, "4xx_expected"),
        ("GET", "/api/pkm/metadata/{user_id}", 404, "4xx_expected"),
        ("GET", "/api/kai/market/insights/{user_id}", 401, "4xx_expected"),
        ("POST", "/db/vault/get", 404, "4xx_expected"),
        ("POST", "/db/vault/bootstrap-state", 404, "4xx_expected"),
        ("GET", "/api/kai/analyze/run/start", 409, "4xx_unexpected"),
    ],
)
def test_status_bucket_parametrized(method, route, status, expected_bucket):
    assert _status_bucket(method, route, status) == expected_bucket
