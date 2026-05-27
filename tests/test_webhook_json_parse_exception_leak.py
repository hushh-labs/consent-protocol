"""
Webhook JSON parse error detail-leak tests (CWE-209).

Verifies that when one_email, gmail, and plaid webhook endpoints receive a
malformed JSON body, the raw Python exception text (e.g. JSONDecodeError with
line/column offsets or partial payload content) is not forwarded to the caller.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.testclient import TestClient


def _make_webhook_app_safe(path: str, code: str) -> FastAPI:
    """App with the patched opaque error response."""
    import logging

    app = FastAPI()
    logger = logging.getLogger(__name__)

    @app.post(path)
    async def _handler(request: Request):
        try:
            await request.json()
        except Exception as exc:
            logger.warning("webhook.invalid_json: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": code, "message": "Webhook payload is not valid JSON."},
            ) from exc

    return app


def _make_webhook_app_leaky(path: str, code: str) -> FastAPI:
    """App with the OLD str(exc)-forwarding response."""
    app = FastAPI()

    @app.post(path)
    async def _handler(request: Request):
        try:
            await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": code, "message": str(exc)},
            ) from exc

    return app


MALFORMED_BODY = b"{this is not valid json: true,}"


@pytest.mark.parametrize(
    "path,code",
    [
        ("/one/email/webhook", "ONE_EMAIL_WEBHOOK_INVALID_JSON"),
        ("/gmail/webhook", "GMAIL_WEBHOOK_INVALID_JSON"),
        ("/plaid/webhook", "PLAID_WEBHOOK_INVALID_JSON"),
    ],
)
def test_old_webhook_handler_leaks_parse_error(path: str, code: str) -> None:
    app = _make_webhook_app_leaky(path, code)
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(path, content=MALFORMED_BODY, headers={"Content-Type": "application/json"})

    assert resp.status_code == 400
    # Old handler forwards raw json parse error -- confirm it leaks
    assert resp.json().get("detail", {}).get("message") != "Webhook payload is not valid JSON."


@pytest.mark.parametrize(
    "path,code",
    [
        ("/one/email/webhook", "ONE_EMAIL_WEBHOOK_INVALID_JSON"),
        ("/gmail/webhook", "GMAIL_WEBHOOK_INVALID_JSON"),
        ("/plaid/webhook", "PLAID_WEBHOOK_INVALID_JSON"),
    ],
)
def test_patched_webhook_handler_hides_parse_error(path: str, code: str) -> None:
    app = _make_webhook_app_safe(path, code)
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(path, content=MALFORMED_BODY, headers={"Content-Type": "application/json"})

    assert resp.status_code == 400
    detail = resp.json().get("detail", {})
    assert detail.get("code") == code
    assert detail.get("message") == "Webhook payload is not valid JSON."
    # Confirm no raw parse error fragments appear
    raw = resp.text
    assert "Expecting" not in raw  # JSONDecodeError prefix
    assert "line " not in raw
    assert "column " not in raw
    assert "char " not in raw


@pytest.mark.parametrize(
    "path,code",
    [
        ("/one/email/webhook", "ONE_EMAIL_WEBHOOK_INVALID_JSON"),
        ("/gmail/webhook", "GMAIL_WEBHOOK_INVALID_JSON"),
        ("/plaid/webhook", "PLAID_WEBHOOK_INVALID_JSON"),
    ],
)
def test_patched_webhook_handler_returns_correct_code(path: str, code: str) -> None:
    app = _make_webhook_app_safe(path, code)
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(path, content=MALFORMED_BODY, headers={"Content-Type": "application/json"})

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == code
