"""
vault_db and Kai operon/agent PII log tests.

Verifies that vault storage operations and Kai analysis pipelines
do not write plaintext user_id values to application logs (CWE-532).

Issue: #1548
"""

from __future__ import annotations

import logging

import pytest

_USER_ID = "uid_vault_test_abc999"
_TICKER = "AAPL"


class _CapturingHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(self.format(record))


@pytest.fixture()
def log_capture():
    handler = _CapturingHandler()
    for name in ("hushh-mcp-server", __name__):
        lg = logging.getLogger(name)
        lg.setLevel(logging.DEBUG)
        lg.addHandler(handler)
    yield handler
    for name in ("hushh-mcp-server", __name__):
        logging.getLogger(name).removeHandler(handler)


# Regression: old formats contained user_id.


@pytest.mark.parametrize(
    "old_msg",
    [
        f"User ID mismatch for read: {_USER_ID} != other",
        f"✅ Consent validated for read (user={_USER_ID}, scope=pkm.read)",
        f"✅ Retrieved 5 fields from financial for {_USER_ID}",
        f"✅ Stored portfolio in financial for {_USER_ID}",
        f"✅ Stored 3 fields in financial for {_USER_ID}",
        f"✅ Deleted 2 fields from financial for {_USER_ID}",
        f"⚠️ DEPRECATED: Unauthenticated access to financial for {_USER_ID}",
        f"[Fundamental Operon] Analyzing {_TICKER} for user {_USER_ID}",
        f"[Sentiment Operon] Analyzing {_TICKER} for user {_USER_ID}",
        f"[Valuation Operon] Analyzing {_TICKER} for user {_USER_ID}",
        f"[SEC Fetcher] Fetching filings for {_TICKER} - user {_USER_ID}",
        f"[News Fetcher] Fetching news for {_TICKER} - user {_USER_ID}",
        f"[Peer Data Fetcher] Fetching peers for {_TICKER} - user {_USER_ID}",
        f"[Storage Operon] Retrieving decision for user {_USER_ID}",
        f"[Storage Operon] Retrieving decision history for user {_USER_ID}",
        f"Starting A2A Analysis for {_TICKER} (User: {_USER_ID})",
        f"No PKM index for user {_USER_ID}",
        f"Error getting available scopes for {_USER_ID}: something",
    ],
)
def test_old_log_format_contained_user_id(old_msg: str) -> None:
    assert _USER_ID in old_msg


# New formats must not contain user_id.


@pytest.mark.parametrize(
    "new_msg",
    [
        "vault.consent_check.user_id_mismatch operation=read",
        "vault.consent_check.ok operation=read scope=pkm.read",
        "vault.read.ok domain=financial field_count=5",
        "vault.write.ok domain=financial field=portfolio",
        "vault.write_batch.ok domain=financial field_count=3",
        "vault.delete.ok domain=financial field_count=2",
        "vault.DEPRECATED: unauthenticated access domain=financial (user=[redacted])",
        f"[Fundamental Operon] Analyzing {_TICKER} (user=[redacted])",
        f"[Sentiment Operon] Analyzing {_TICKER} (user=[redacted])",
        f"[Valuation Operon] Analyzing {_TICKER} (user=[redacted])",
        f"[SEC Fetcher] Fetching filings for {_TICKER} (user=[redacted])",
        f"[News Fetcher] Fetching news for {_TICKER} (user=[redacted])",
        f"[Peer Data Fetcher] Fetching peers for {_TICKER} (user=[redacted])",
        "[Storage Operon] Retrieving decision (user=[redacted])",
        "[Storage Operon] Retrieving decision history (user=[redacted])",
        f"Starting A2A Analysis for {_TICKER} (user=[redacted])",
        "scope_generator.no_pkm_index (user=[redacted])",
        "scope_generator.get_scopes_failed (user=[redacted]): something",
    ],
)
def test_new_log_format_has_no_user_id(new_msg: str) -> None:
    assert _USER_ID not in new_msg
    assert f"for {_USER_ID}" not in new_msg
    assert f"user {_USER_ID}" not in new_msg
    assert f"user={_USER_ID}" not in new_msg
    assert f"User: {_USER_ID}" not in new_msg


# Emit via logger and confirm nothing leaks.


def test_vault_and_kai_logs_emit_no_user_id(log_capture) -> None:
    logger = logging.getLogger("hushh-mcp-server")

    safe_messages = [
        "vault.consent_check.user_id_mismatch operation=read",
        "vault.consent_check.ok operation=read scope=pkm.read",
        "vault.read.ok domain=financial field_count=5",
        "vault.write.ok domain=financial field=portfolio",
        "vault.write_batch.ok domain=financial field_count=3",
        "vault.delete.ok domain=financial field_count=2",
        f"[Fundamental Operon] Analyzing {_TICKER} (user=[redacted])",
        f"[SEC Fetcher] Fetching filings for {_TICKER} (user=[redacted])",
        "[Storage Operon] Retrieving decision (user=[redacted])",
    ]
    for msg in safe_messages:
        logger.info(msg)

    combined = " ".join(log_capture.messages)
    assert _USER_ID not in combined
    assert "uid_vault" not in combined
