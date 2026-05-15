"""
Tests for Temporal Consent Control (TTL & Auto-Revocation).

Temporal Governance by Abdul Gaffar — verifies that:
  1. ConsentApprovalPayload rejects payloads whose expires_at is in the past
  2. Valid and absent expires_at values are accepted
  3. ConsentRevocationWorker correctly scans and revokes expired consents
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from hushh_mcp.consent.consent_schemas import ConsentApprovalPayload, ConsentExpiredError
from hushh_mcp.services.revocation_worker import (
    ConsentRevocationWorker,
    ExpiredConsent,
    RevocationReport,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)
_PAST = _NOW - timedelta(hours=1)
_FAR_PAST = _NOW - timedelta(days=30)
_FUTURE = _NOW + timedelta(hours=1)
_FAR_FUTURE = _NOW + timedelta(days=365)

_BASE = {"userId": "user_abc", "requestId": "req_xyz"}


def _expired_consent(cid: str = "c1", scope: str = "pkm.read") -> ExpiredConsent:
    return ExpiredConsent(
        consent_id=cid,
        token_id=f"HCT:{cid}",
        scope=scope,
        expired_at=_PAST,
    )


# ---------------------------------------------------------------------------
# ConsentExpiredError
# ---------------------------------------------------------------------------


class TestConsentExpiredError:
    def test_is_value_error_subclass(self):
        err = ConsentExpiredError(_PAST)
        assert isinstance(err, ValueError)

    def test_message_contains_timestamp(self):
        err = ConsentExpiredError(_PAST)
        assert _PAST.isoformat() in str(err)

    def test_message_contains_identity_label(self):
        err = ConsentExpiredError(_PAST)
        assert "Abdul Gaffar" in str(err)
        assert "Temporal Governance" in str(err)

    def test_stores_expires_at(self):
        err = ConsentExpiredError(_PAST)
        assert err.expires_at == _PAST


# ---------------------------------------------------------------------------
# expires_at field validation
# ---------------------------------------------------------------------------


class TestExpiresAtValidation:
    def test_past_expires_at_raises_validation_error(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": _PAST})
        errors = exc_info.value.errors()
        assert any("expires_at" in str(e) or "expired" in str(e).lower() for e in errors)

    def test_far_past_expires_at_rejected(self):
        with pytest.raises(ValidationError):
            ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": _FAR_PAST})

    def test_future_expires_at_accepted(self):
        payload = ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": _FUTURE})
        assert payload.expires_at is not None
        assert payload.expires_at > _NOW

    def test_far_future_expires_at_accepted(self):
        payload = ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": _FAR_FUTURE})
        assert payload.expires_at == _FAR_FUTURE.replace(tzinfo=timezone.utc)

    def test_absent_expires_at_accepted(self):
        payload = ConsentApprovalPayload.model_validate(_BASE)
        assert payload.expires_at is None

    def test_none_expires_at_accepted(self):
        payload = ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": None})
        assert payload.expires_at is None

    def test_naive_datetime_treated_as_utc_past(self):
        # A naive past datetime should still be rejected
        naive_past = _PAST.replace(tzinfo=None)
        with pytest.raises(ValidationError):
            ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": naive_past})

    def test_naive_datetime_treated_as_utc_future(self):
        naive_future = _FUTURE.replace(tzinfo=None)
        payload = ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": naive_future})
        assert payload.expires_at is not None

    def test_iso_string_past_rejected(self):
        with pytest.raises(ValidationError):
            ConsentApprovalPayload.model_validate(
                {**_BASE, "expiresAt": _PAST.isoformat()}
            )

    def test_iso_string_future_accepted(self):
        payload = ConsentApprovalPayload.model_validate(
            {**_BASE, "expiresAt": _FUTURE.isoformat()}
        )
        assert payload.expires_at is not None

    def test_error_message_references_temporal_governance(self):
        with pytest.raises(ValidationError) as exc_info:
            ConsentApprovalPayload.model_validate({**_BASE, "expiresAt": _PAST})
        full_error = str(exc_info.value)
        assert "Temporal Governance" in full_error or "expired" in full_error.lower()


# ---------------------------------------------------------------------------
# ConsentRevocationWorker
# ---------------------------------------------------------------------------


class TestConsentRevocationWorker:
    async def test_scan_revokes_each_expired_consent(self):
        records = [_expired_consent("c1"), _expired_consent("c2"), _expired_consent("c3")]
        fetch = AsyncMock(return_value=records)
        revoke = AsyncMock()
        worker = ConsentRevocationWorker(fetch_expired=fetch, revoke=revoke)

        report = await worker.scan_and_revoke()

        assert report.revoked_count == 3
        assert report.failed_count == 0
        assert revoke.call_count == 3
        revoked_ids = {call.args[0] for call in revoke.call_args_list}
        assert revoked_ids == {"c1", "c2", "c3"}

    async def test_empty_fetch_returns_zero_counts(self):
        worker = ConsentRevocationWorker(
            fetch_expired=AsyncMock(return_value=[]),
            revoke=AsyncMock(),
        )
        report = await worker.scan_and_revoke()
        assert report.revoked_count == 0
        assert report.failed_count == 0

    async def test_revoke_failure_counted_and_scan_continues(self):
        records = [_expired_consent("c1"), _expired_consent("c2")]
        revoke = AsyncMock(side_effect=[RuntimeError("db error"), None])
        worker = ConsentRevocationWorker(
            fetch_expired=AsyncMock(return_value=records),
            revoke=revoke,
        )

        report = await worker.scan_and_revoke()

        assert report.revoked_count == 1
        assert report.failed_count == 1

    async def test_fetch_failure_returns_empty_report(self):
        worker = ConsentRevocationWorker(
            fetch_expired=AsyncMock(side_effect=ConnectionError("db down")),
            revoke=AsyncMock(),
        )
        report = await worker.scan_and_revoke()
        assert report.revoked_count == 0
        assert report.failed_count == 0

    async def test_report_has_timing(self):
        worker = ConsentRevocationWorker(
            fetch_expired=AsyncMock(return_value=[_expired_consent()]),
            revoke=AsyncMock(),
        )
        report = await worker.scan_and_revoke()
        elapsed = (report.scan_end - report.scan_start).total_seconds()
        assert elapsed >= 0

    async def test_report_summary_contains_identity_label(self):
        worker = ConsentRevocationWorker(
            fetch_expired=AsyncMock(return_value=[_expired_consent()]),
            revoke=AsyncMock(),
        )
        report = await worker.scan_and_revoke()
        assert "Abdul Gaffar" in report.summary()
        assert "Temporal Governance" in report.summary()


# ---------------------------------------------------------------------------
# RevocationReport
# ---------------------------------------------------------------------------


class TestRevocationReport:
    def test_total_scanned(self):
        report = RevocationReport(
            revoked_count=7,
            failed_count=3,
            scan_start=_NOW,
            scan_end=_NOW,
        )
        assert report.total_scanned == 10

    def test_summary_contains_counts(self):
        report = RevocationReport(
            revoked_count=5,
            failed_count=0,
            scan_start=_NOW,
            scan_end=_NOW + timedelta(seconds=1),
        )
        summary = report.summary()
        assert "5/5" in summary

    def test_label_present(self):
        report = RevocationReport(
            revoked_count=0,
            failed_count=0,
            scan_start=_NOW,
            scan_end=_NOW,
        )
        assert "Temporal Governance" in report.label
        assert "Abdul Gaffar" in report.label
