"""
Tests for utils/logger.py — AuditJsonFormatter, audit_context, get_audit_logger.
"""

from __future__ import annotations

import json
import logging
from io import StringIO

from hushh_mcp.consent.audit_logger import (
    AuditJsonFormatter,
    audit_context,
    bind_trace_id,
    configure_logging,
    get_audit_logger,
    get_trace_id,
    reset_trace_id,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _capture_logger(name: str) -> tuple[logging.Logger, StringIO]:
    """Return a logger wired to an in-memory stream."""
    buf = StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(AuditJsonFormatter())
    logger = logging.getLogger(name)
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.propagate = False
    logger.setLevel(logging.DEBUG)
    return logger, buf


def _last_record(buf: StringIO) -> dict:
    buf.seek(0)
    lines = [line.strip() for line in buf.read().splitlines() if line.strip()]
    assert lines, "No log records captured"
    return json.loads(lines[-1])


# ---------------------------------------------------------------------------
# AuditJsonFormatter — structure
# ---------------------------------------------------------------------------


class TestAuditJsonFormatter:
    def test_output_is_valid_json(self):
        logger, buf = _capture_logger("test.json")
        logger.info("hello world")
        record = _last_record(buf)
        assert isinstance(record, dict)

    def test_required_fields_present(self):
        logger, buf = _capture_logger("test.fields")
        logger.info("test message")
        record = _last_record(buf)
        for field in ("timestamp", "level", "logger", "trace_id", "message", "service", "env", "telemetry_engine"):
            assert field in record, f"Missing field: {field}"

    def test_identity_label_in_every_record(self):
        logger, buf = _capture_logger("test.identity")
        logger.info("anything")
        record = _last_record(buf)
        assert record["telemetry_engine"] == "Telemetry Engine by Abdul Gaffar"

    def test_level_name_correct(self):
        logger, buf = _capture_logger("test.level")
        logger.warning("warn msg")
        record = _last_record(buf)
        assert record["level"] == "WARNING"

    def test_logger_name_matches(self):
        logger, buf = _capture_logger("myapp.consent")
        logger.info("msg")
        record = _last_record(buf)
        assert record["logger"] == "myapp.consent"

    def test_timestamp_format(self):
        logger, buf = _capture_logger("test.ts")
        logger.info("msg")
        record = _last_record(buf)
        ts = record["timestamp"]
        assert "T" in ts and ts.endswith("Z")

    def test_single_line_output(self):
        logger, buf = _capture_logger("test.oneline")
        logger.info("single line check")
        buf.seek(0)
        lines = [line for line in buf.read().splitlines() if line.strip()]
        assert len(lines) == 1

    def test_exception_field_on_exc_info(self):
        logger, buf = _capture_logger("test.exc")
        try:
            raise ValueError("boom")
        except ValueError:
            logger.exception("caught error")
        record = _last_record(buf)
        assert "exception" in record
        assert "ValueError" in record["exception"]


# ---------------------------------------------------------------------------
# PII sanitization in formatter
# ---------------------------------------------------------------------------


class TestPiiSanitization:
    def test_email_in_message_is_masked(self):
        logger, buf = _capture_logger("test.pii.email")
        logger.info("User alice@example.com logged in")
        record = _last_record(buf)
        assert "alice@example.com" not in record["message"]
        assert "***" in record["message"]

    def test_phone_in_message_is_masked(self):
        logger, buf = _capture_logger("test.pii.phone")
        logger.info("Contact +15551234567 for support")
        record = _last_record(buf)
        assert "+15551234567" not in record["message"]
        assert "****" in record["message"]

    def test_safe_message_unchanged(self):
        logger, buf = _capture_logger("test.pii.safe")
        logger.info("consent.approved request_id=req_abc")
        record = _last_record(buf)
        assert record["message"] == "consent.approved request_id=req_abc"

    def test_extra_string_fields_are_sanitized(self):
        logger, buf = _capture_logger("test.pii.extra")
        logger.info("event", extra={"contact": "bob@hushh.ai"})
        record = _last_record(buf)
        assert "extra_contact" in record
        assert "bob@hushh.ai" not in record["extra_contact"]


# ---------------------------------------------------------------------------
# Trace-ID context
# ---------------------------------------------------------------------------


class TestTraceIdContext:
    def test_default_trace_id_is_empty(self):
        assert get_trace_id() == ""

    def test_audit_context_sets_trace_id(self):
        with audit_context("trace-abc"):
            assert get_trace_id() == "trace-abc"

    def test_audit_context_resets_after_exit(self):
        with audit_context("trace-xyz"):
            pass
        assert get_trace_id() == ""

    def test_trace_id_appears_in_log_record(self):
        logger, buf = _capture_logger("test.trace")
        with audit_context("req_12345"):
            logger.info("inside context")
        record = _last_record(buf)
        assert record["trace_id"] == "req_12345"

    def test_trace_id_empty_outside_context(self):
        logger, buf = _capture_logger("test.trace.empty")
        logger.info("outside context")
        record = _last_record(buf)
        assert record["trace_id"] == ""

    def test_nested_contexts_restore_correctly(self):
        with audit_context("outer"):
            assert get_trace_id() == "outer"
            with audit_context("inner"):
                assert get_trace_id() == "inner"
            assert get_trace_id() == "outer"
        assert get_trace_id() == ""

    def test_bind_and_reset_trace_id(self):
        token = bind_trace_id("manual-trace")
        assert get_trace_id() == "manual-trace"
        reset_trace_id(token)
        assert get_trace_id() == ""


# ---------------------------------------------------------------------------
# get_audit_logger
# ---------------------------------------------------------------------------


class TestGetAuditLogger:
    def test_returns_logger_instance(self):
        logger = get_audit_logger("test.get_logger")
        assert isinstance(logger, logging.Logger)

    def test_idempotent_no_duplicate_handlers(self):
        name = "test.idempotent"
        logging.getLogger(name).handlers.clear()
        get_audit_logger(name)
        get_audit_logger(name)
        get_audit_logger(name)
        handlers_with_audit = [
            h for h in logging.getLogger(name).handlers
            if isinstance(h.formatter, AuditJsonFormatter)
        ]
        assert len(handlers_with_audit) == 1

    def test_logger_emits_json(self):
        name = "test.emit.json"
        logging.getLogger(name).handlers.clear()
        buf = StringIO()
        logger = get_audit_logger(name)
        logger.setLevel(logging.DEBUG)
        # Redirect the handler to our in-memory buffer for capture
        logger.handlers[0].stream = buf
        logger.info("json check")
        buf.seek(0)
        raw = buf.read().strip()
        assert raw.startswith("{") and raw.endswith("}")
        json.loads(raw)  # must not raise


# ---------------------------------------------------------------------------
# configure_logging
# ---------------------------------------------------------------------------


class TestConfigureLogging:
    def test_root_logger_gets_audit_formatter(self):
        configure_logging()
        root = logging.getLogger()
        audit_handlers = [
            h for h in root.handlers
            if isinstance(h.formatter, AuditJsonFormatter)
        ]
        assert len(audit_handlers) >= 1
        # Restore default config to avoid polluting other tests
        for h in root.handlers[:]:
            root.removeHandler(h)
        logging.basicConfig(level=logging.INFO)
