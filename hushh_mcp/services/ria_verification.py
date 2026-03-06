from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VerificationResult:
    verified: bool
    rejected: bool
    outcome: str
    message: str
    expires_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class VerificationProvider(Protocol):
    async def verify(
        self,
        *,
        legal_name: str,
        finra_crd: str | None,
        sec_iard: str | None,
    ) -> VerificationResult: ...


class FinraVerificationAdapter:
    """
    FINRA verification adapter.

    This adapter is intentionally fail-closed. If provider config is missing or
    unreachable, it returns provider_unavailable instead of granting access.
    """

    def __init__(self) -> None:
        self._base_url = str(os.getenv("FINRA_VERIFY_BASE_URL", "")).strip().rstrip("/")
        self._api_key = str(os.getenv("FINRA_VERIFY_API_KEY", "")).strip()
        self._timeout_seconds = float(os.getenv("FINRA_VERIFY_TIMEOUT_SECONDS", "5"))

    async def verify(
        self,
        *,
        legal_name: str,
        finra_crd: str | None,
        sec_iard: str | None,
    ) -> VerificationResult:
        if not self._base_url or not self._api_key:
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="FINRA verification provider not configured",
                metadata={"provider": "finra", "reason": "not_configured"},
            )

        payload = {
            "legal_name": legal_name,
            "finra_crd": finra_crd,
            "sec_iard": sec_iard,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    f"{self._base_url}/verify-ria",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                if response.status_code >= 500:
                    return VerificationResult(
                        verified=False,
                        rejected=False,
                        outcome="provider_unavailable",
                        message="FINRA verification provider unavailable",
                        metadata={"provider": "finra", "status_code": response.status_code},
                    )
                data = response.json() if response.content else {}
        except Exception as exc:  # noqa: BLE001
            logger.warning("ria.finra_verification_request_failed: %s", exc)
            return VerificationResult(
                verified=False,
                rejected=False,
                outcome="provider_unavailable",
                message="FINRA verification provider request failed",
                metadata={"provider": "finra", "error": type(exc).__name__},
            )

        verified = bool(data.get("verified") is True)
        rejected = bool(data.get("rejected") is True)
        if verified:
            ttl_days = int(data.get("ttl_days") or 30)
            return VerificationResult(
                verified=True,
                rejected=False,
                outcome="verified",
                message="FINRA verification successful",
                expires_at=datetime.now(timezone.utc) + timedelta(days=ttl_days),
                metadata={
                    "provider": "finra",
                    "reference_id": data.get("reference_id"),
                },
            )

        if rejected:
            return VerificationResult(
                verified=False,
                rejected=True,
                outcome="rejected",
                message=str(data.get("message") or "FINRA verification rejected"),
                metadata={
                    "provider": "finra",
                    "reference_id": data.get("reference_id"),
                },
            )

        return VerificationResult(
            verified=False,
            rejected=False,
            outcome="provider_unavailable",
            message="FINRA verification did not return a terminal decision",
            metadata={"provider": "finra"},
        )


class VerificationGateway:
    def __init__(self, provider: VerificationProvider) -> None:
        self._provider = provider

    async def verify(
        self,
        *,
        legal_name: str,
        finra_crd: str | None,
        sec_iard: str | None,
    ) -> VerificationResult:
        return await self._provider.verify(
            legal_name=legal_name,
            finra_crd=finra_crd,
            sec_iard=sec_iard,
        )
