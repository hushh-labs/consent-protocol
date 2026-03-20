from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _env_truthy(name: str, fallback: str = "false") -> bool:
    raw = str(os.getenv(name, fallback)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _runtime_environment() -> str:
    for name in ("APP_ENV", "ENVIRONMENT", "HUSHH_ENV", "ENV"):
        value = str(os.getenv(name, "")).strip().lower()
        if value:
            return value
    return ""


def _is_production() -> bool:
    return _runtime_environment() in {"prod", "production"}


def validate_regulated_runtime_configuration() -> None:
    if not _is_production():
        return

    if not str(os.getenv("IAPD_VERIFY_BASE_URL", "")).strip():
        raise RuntimeError("IAPD_VERIFY_BASE_URL is required in production.")

    if not str(os.getenv("IAPD_VERIFY_API_KEY", "")).strip():
        raise RuntimeError("IAPD_VERIFY_API_KEY is required in production.")

    if _env_truthy("ADVISORY_VERIFICATION_BYPASS_ENABLED") or _env_truthy("RIA_DEV_BYPASS_ENABLED"):
        raise RuntimeError(
            "ADVISORY_VERIFICATION_BYPASS_ENABLED / RIA_DEV_BYPASS_ENABLED must remain false in production."
        )

    if _env_truthy("BROKER_VERIFICATION_BYPASS_ENABLED"):
        raise RuntimeError("BROKER_VERIFICATION_BYPASS_ENABLED must remain false in production.")

    if _env_truthy("BROKER_CAPABILITY_ENABLED"):
        if not str(os.getenv("BROKER_VERIFY_BASE_URL", "")).strip():
            raise RuntimeError(
                "BROKER_VERIFY_BASE_URL is required when BROKER_CAPABILITY_ENABLED=true in production."
            )
        if not str(os.getenv("BROKER_VERIFY_API_KEY", "")).strip():
            raise RuntimeError(
                "BROKER_VERIFY_API_KEY is required when BROKER_CAPABILITY_ENABLED=true in production."
            )


@dataclass(frozen=True)
class VerificationResult:
    verified: bool
    rejected: bool
    outcome: str
    message: str
    expires_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class IapdVerificationAdapter:
    """Official advisory verification path via the app's IAPD worker/service."""

    def __init__(self) -> None:
        self._base_url = str(os.getenv("IAPD_VERIFY_BASE_URL", "")).strip().rstrip("/")
        self._api_key = str(os.getenv("IAPD_VERIFY_API_KEY", "")).strip()
        self._timeout_seconds = float(os.getenv("IAPD_VERIFY_TIMEOUT_SECONDS", "5"))

    async def verify(
        self,
        *,
        individual_legal_name: str,
        individual_crd: str,
        advisory_firm_legal_name: str,
        advisory_firm_iapd_number: str,
    ) -> VerificationResult:
        if not self._base_url or not self._api_key:
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="IAPD verification provider not configured",
                metadata={"provider": "iapd", "reason": "not_configured"},
            )

        payload = {
            "individual_legal_name": individual_legal_name,
            "individual_crd": individual_crd,
            "advisory_firm_legal_name": advisory_firm_legal_name,
            "advisory_firm_iapd_number": advisory_firm_iapd_number,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    f"{self._base_url}/verify-advisory",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                if response.status_code >= 500:
                    return VerificationResult(
                        verified=False,
                        rejected=False,
                        outcome="provider_unavailable",
                        message="IAPD verification provider unavailable",
                        metadata={"provider": "iapd", "status_code": response.status_code},
                    )
                data = response.json() if response.content else {}
        except Exception as exc:  # noqa: BLE001
            logger.warning("ria.iapd_verification_request_failed: %s", exc)
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="IAPD verification provider request failed",
                metadata={"provider": "iapd", "error": type(exc).__name__},
            )

        verified = bool(data.get("verified") is True)
        rejected = bool(data.get("rejected") is True)
        if verified:
            ttl_days = int(data.get("ttl_days") or 30)
            return VerificationResult(
                verified=True,
                rejected=False,
                outcome="verified",
                message="IAPD verification successful",
                expires_at=datetime.now(timezone.utc) + timedelta(days=ttl_days),
                metadata={
                    "provider": "iapd",
                    "reference_id": data.get("reference_id"),
                    "source_url": data.get("source_url"),
                },
            )

        if rejected:
            return VerificationResult(
                verified=False,
                rejected=True,
                outcome="rejected",
                message=str(data.get("message") or "IAPD verification rejected"),
                metadata={
                    "provider": "iapd",
                    "reference_id": data.get("reference_id"),
                    "reason_code": data.get("reason_code"),
                    "source_url": data.get("source_url"),
                },
            )

        return VerificationResult(
            verified=False,
            rejected=False,
            outcome="provider_unavailable",
            message="IAPD verification did not return a terminal decision",
            metadata={"provider": "iapd"},
        )


class BrokerVerificationAdapter:
    """Broker capability verification with official verification and evidence-only fallback."""

    def __init__(self) -> None:
        self._base_url = str(os.getenv("BROKER_VERIFY_BASE_URL", "")).strip().rstrip("/")
        self._api_key = str(os.getenv("BROKER_VERIFY_API_KEY", "")).strip()
        self._timeout_seconds = float(os.getenv("BROKER_VERIFY_TIMEOUT_SECONDS", "5"))
        self._public_fallback_enabled = str(
            os.getenv("BROKER_PUBLIC_FALLBACK_ENABLED", "false")
        ).strip().lower() in {"1", "true", "yes", "on"}

    async def verify(
        self,
        *,
        individual_legal_name: str,
        individual_crd: str,
        broker_firm_legal_name: str,
        broker_firm_crd: str,
    ) -> VerificationResult:
        if not self._base_url or not self._api_key:
            if self._public_fallback_enabled:
                return VerificationResult(
                    verified=False,
                    rejected=False,
                    outcome="evidence_only",
                    message="Broker capability is awaiting official verification configuration",
                    metadata={
                        "provider": "broker_public_fallback",
                        "reason": "official_not_configured",
                    },
                )
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="Broker verification provider not configured",
                metadata={"provider": "broker", "reason": "not_configured"},
            )

        payload = {
            "individual_legal_name": individual_legal_name,
            "individual_crd": individual_crd,
            "broker_firm_legal_name": broker_firm_legal_name,
            "broker_firm_crd": broker_firm_crd,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    f"{self._base_url}/verify-broker-capability",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                if response.status_code >= 500:
                    return VerificationResult(
                        verified=False,
                        rejected=False,
                        outcome="provider_unavailable",
                        message="Broker verification provider unavailable",
                        metadata={"provider": "broker", "status_code": response.status_code},
                    )
                data = response.json() if response.content else {}
        except Exception as exc:  # noqa: BLE001
            logger.warning("ria.broker_verification_request_failed: %s", exc)
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="Broker verification provider request failed",
                metadata={"provider": "broker", "error": type(exc).__name__},
            )

        verified = bool(data.get("verified") is True)
        rejected = bool(data.get("rejected") is True)
        if verified:
            ttl_days = int(data.get("ttl_days") or 30)
            return VerificationResult(
                verified=True,
                rejected=False,
                outcome="verified",
                message="Broker verification successful",
                expires_at=datetime.now(timezone.utc) + timedelta(days=ttl_days),
                metadata={
                    "provider": "broker",
                    "reference_id": data.get("reference_id"),
                    "source_url": data.get("source_url"),
                },
            )

        if rejected:
            return VerificationResult(
                verified=False,
                rejected=True,
                outcome="rejected",
                message=str(data.get("message") or "Broker verification rejected"),
                metadata={
                    "provider": "broker",
                    "reference_id": data.get("reference_id"),
                    "reason_code": data.get("reason_code"),
                    "source_url": data.get("source_url"),
                },
            )

        return VerificationResult(
            verified=False,
            rejected=False,
            outcome="provider_unavailable",
            message="Broker verification did not return a terminal decision",
            metadata={"provider": "broker"},
        )


class RegulatoryVerificationGateway:
    def __init__(self) -> None:
        self._advisory_provider = IapdVerificationAdapter()
        self._broker_provider = BrokerVerificationAdapter()

    async def verify_advisory(
        self,
        *,
        individual_legal_name: str,
        individual_crd: str,
        advisory_firm_legal_name: str,
        advisory_firm_iapd_number: str,
    ) -> VerificationResult:
        return await self._advisory_provider.verify(
            individual_legal_name=individual_legal_name,
            individual_crd=individual_crd,
            advisory_firm_legal_name=advisory_firm_legal_name,
            advisory_firm_iapd_number=advisory_firm_iapd_number,
        )

    async def verify_brokerage(
        self,
        *,
        individual_legal_name: str,
        individual_crd: str,
        broker_firm_legal_name: str,
        broker_firm_crd: str,
    ) -> VerificationResult:
        return await self._broker_provider.verify(
            individual_legal_name=individual_legal_name,
            individual_crd=individual_crd,
            broker_firm_legal_name=broker_firm_legal_name,
            broker_firm_crd=broker_firm_crd,
        )
