"""Plaid runtime configuration helpers.

This module isolates environment parsing and redirect/webhook validation from
Kai's higher-level brokerage orchestration service.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit

_PLAID_BASE_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}
_TX_HISTORY_DAYS_DEFAULT = 730
_DEFAULT_COUNTRY_CODES = ["US"]
_DEFAULT_LANGUAGE = "en"
_DEFAULT_CLIENT_NAME = "Hushh Kai"
_DEFAULT_MANUAL_ENTRY_ENABLED = False
_DEFAULT_CRYPTO_WALLET_ENABLED = False
_DEFAULT_REDIRECT_PATH = "/kai/plaid/oauth/return"


def _clean_text(value: Any, *, default: str = "") -> str:
    if not isinstance(value, str):
        return default
    text = value.strip()
    return text or default


def _to_bool(value: Any, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _to_int(value: Any, *, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


def _normalize_redirect_uri(value: str | None) -> str | None:
    raw = _clean_text(value)
    if not raw:
        return None
    parsed = urlsplit(raw)
    if not parsed.scheme or not parsed.netloc:
        return None
    path = parsed.path or "/"
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


@dataclass(frozen=True)
class PlaidRuntimeConfig:
    environment: str
    base_url: str
    client_id: str
    secret: str
    country_codes: list[str]
    language: str
    client_name: str
    webhook_url: str | None
    frontend_url: str | None
    redirect_path: str
    redirect_uri: str | None
    tx_history_days: int
    manual_entry_enabled: bool
    crypto_wallet_enabled: bool

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.secret)

    @classmethod
    def from_env(cls) -> "PlaidRuntimeConfig":
        environment = _clean_text(
            os.getenv("PLAID_ENV") or os.getenv("PLAID_ENVIRONMENT"),
            default="sandbox",
        ).lower()
        base_url = _PLAID_BASE_URLS.get(environment, _PLAID_BASE_URLS["sandbox"])
        frontend_url = _clean_text(os.getenv("FRONTEND_URL")) or None
        redirect_path = _clean_text(
            os.getenv("PLAID_REDIRECT_PATH"),
            default=_DEFAULT_REDIRECT_PATH,
        )
        if not redirect_path.startswith("/"):
            redirect_path = f"/{redirect_path}"
        redirect_path = redirect_path or _DEFAULT_REDIRECT_PATH

        explicit_redirect_uri = _normalize_redirect_uri(
            os.getenv("PLAID_REDIRECT_URI") or os.getenv("PLAID_OAUTH_REDIRECT_URI")
        )
        redirect_uri = explicit_redirect_uri
        if redirect_uri is None and frontend_url:
            parsed = urlsplit(frontend_url)
            if parsed.scheme and parsed.netloc:
                redirect_uri = urlunsplit((parsed.scheme, parsed.netloc, redirect_path, "", ""))

        raw_country_codes = _clean_text(os.getenv("PLAID_COUNTRY_CODES"))
        if raw_country_codes:
            country_codes = [
                chunk.strip().upper() for chunk in raw_country_codes.split(",") if chunk.strip()
            ]
        else:
            country_codes = list(_DEFAULT_COUNTRY_CODES)

        tx_history_days = max(
            30,
            _to_int(
                os.getenv("PLAID_TX_HISTORY_DAYS"),
                default=_TX_HISTORY_DAYS_DEFAULT,
            ),
        )

        return cls(
            environment=environment,
            base_url=base_url,
            client_id=_clean_text(os.getenv("PLAID_CLIENT_ID")),
            secret=_clean_text(os.getenv("PLAID_SECRET")),
            country_codes=country_codes or list(_DEFAULT_COUNTRY_CODES),
            language=_clean_text(os.getenv("PLAID_LANGUAGE"), default=_DEFAULT_LANGUAGE),
            client_name=_clean_text(
                os.getenv("PLAID_CLIENT_NAME"),
                default=_DEFAULT_CLIENT_NAME,
            ),
            webhook_url=_clean_text(os.getenv("PLAID_WEBHOOK_URL")) or None,
            frontend_url=frontend_url,
            redirect_path=redirect_path,
            redirect_uri=redirect_uri,
            tx_history_days=tx_history_days,
            manual_entry_enabled=_to_bool(
                os.getenv("PLAID_INVESTMENTS_MANUAL_ENTRY_ENABLED"),
                default=_DEFAULT_MANUAL_ENTRY_ENABLED,
            ),
            crypto_wallet_enabled=_to_bool(
                os.getenv("PLAID_INVESTMENTS_CRYPTO_WALLET_ENABLED"),
                default=_DEFAULT_CRYPTO_WALLET_ENABLED,
            ),
        )

    def to_status(self) -> dict[str, Any]:
        return {
            "configured": self.configured,
            "environment": self.environment,
            "base_url": self.base_url,
            "redirect_path": self.redirect_path,
            "redirect_uri": self.redirect_uri,
            "webhook_configured": bool(self.webhook_url),
            "webhook_url": self.webhook_url,
        }

    def resolve_redirect_uri(self, requested_redirect_uri: str | None = None) -> str | None:
        default_redirect_uri = self.redirect_uri
        requested = _normalize_redirect_uri(requested_redirect_uri)
        if requested is None:
            return default_redirect_uri

        requested_parts = urlsplit(requested)
        if requested_parts.path != self.redirect_path:
            raise RuntimeError(
                f"Plaid redirect URI must use the configured callback path {self.redirect_path}."
            )

        allowed = _normalize_redirect_uri(default_redirect_uri)
        if allowed is not None:
            allowed_parts = urlsplit(allowed)
            if (
                requested_parts.scheme != allowed_parts.scheme
                or requested_parts.netloc != allowed_parts.netloc
            ):
                raise RuntimeError(
                    "Plaid redirect URI does not match the configured frontend origin."
                )

        return requested
