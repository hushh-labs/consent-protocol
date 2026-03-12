from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import asyncpg

from api.utils.firebase_admin import ensure_firebase_admin
from db.connection import get_database_ssl, get_database_url
from hushh_mcp.services.ria_verification import (
    FinraVerificationAdapter,
    VerificationGateway,
    VerificationResult,
)

logger = logging.getLogger(__name__)

PersonaType = Literal["investor", "ria"]
ActorType = Literal["investor", "ria"]

_ALLOWED_PERSONAS: set[str] = {"investor", "ria"}
_ALLOWED_ACTOR_TYPES: set[str] = {"investor", "ria"}
_DURATION_PRESETS_HOURS: set[int] = {24, 24 * 7, 24 * 30, 24 * 90}
_MAX_DURATION_HOURS = 24 * 365
_IAM_REQUIRED_TABLES: tuple[str, ...] = (
    "actor_profiles",
    "ria_profiles",
    "ria_firms",
    "ria_firm_memberships",
    "ria_verification_events",
    "advisor_investor_relationships",
    "ria_client_invites",
    "consent_scope_templates",
    "marketplace_public_profiles",
)
_RUNTIME_PERSONA_STATE_TABLE = "runtime_persona_state"


class RIAIAMPolicyError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class IAMSchemaNotReadyError(Exception):
    def __init__(
        self,
        message: str = (
            "IAM schema is not ready. Run `python db/migrate.py --iam` and "
            "`python scripts/verify_iam_schema.py`."
        ),
    ):
        super().__init__(message)
        self.code = "IAM_SCHEMA_NOT_READY"


@dataclass(frozen=True)
class ScopeTemplate:
    template_id: str
    requester_actor_type: ActorType
    subject_actor_type: ActorType
    template_name: str
    allowed_scopes: list[str]
    default_duration_hours: int
    max_duration_hours: int


class RIAIAMService:
    def __init__(self) -> None:
        self._verification_gateway = VerificationGateway(FinraVerificationAdapter())

    @staticmethod
    def _env_truthy(name: str, fallback: str = "false") -> bool:
        raw = str(os.getenv(name, fallback)).strip().lower()
        return raw in {"1", "true", "yes", "on"}

    @staticmethod
    def _csv_env_values(name: str) -> set[str]:
        raw = str(os.getenv(name, "")).strip()
        if not raw:
            return set()
        return {item.strip() for item in raw.split(",") if item.strip()}

    def _runtime_environment(self) -> str:
        for name in ("APP_ENV", "ENVIRONMENT", "HUSHH_ENV", "ENV"):
            value = str(os.getenv(name, "")).strip().lower()
            if value:
                return value
        return ""

    def _is_ria_dev_bypass_enabled(self) -> bool:
        if not self._env_truthy("RIA_DEV_BYPASS_ENABLED"):
            return False
        return self._runtime_environment() not in {"prod", "production"}

    def _lookup_user_email(self, user_id: str) -> str | None:
        configured, _ = ensure_firebase_admin()
        if not configured:
            return None
        try:
            from firebase_admin import auth as firebase_auth

            user_record = firebase_auth.get_user(user_id)
            email = str(user_record.email or "").strip().lower()
            return email or None
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "ria.dev_bypass_lookup_failed user_id=%s error=%s", user_id, type(exc).__name__
            )
            return None

    def _is_dev_bypass_allowed(self, user_id: str) -> bool:
        if not self._is_ria_dev_bypass_enabled():
            return False
        if user_id in self._csv_env_values("RIA_DEV_ALLOWLIST_UIDS"):
            return True
        allowlisted_emails = {
            email.strip().lower()
            for email in self._csv_env_values("RIA_DEV_ALLOWLIST_EMAILS")
            if email.strip()
        }
        if not allowlisted_emails:
            return False
        email = self._lookup_user_email(user_id)
        return bool(email and email in allowlisted_emails)

    @staticmethod
    def _normalize_persona(value: str) -> PersonaType:
        normalized = (value or "").strip().lower()
        if normalized not in _ALLOWED_PERSONAS:
            raise RIAIAMPolicyError("Invalid persona", status_code=400)
        return normalized  # type: ignore[return-value]

    @staticmethod
    def _normalize_actor(value: str) -> ActorType:
        normalized = (value or "").strip().lower()
        if normalized not in _ALLOWED_ACTOR_TYPES:
            raise RIAIAMPolicyError("Invalid actor type", status_code=400)
        return normalized  # type: ignore[return-value]

    @staticmethod
    def _now_ms() -> int:
        return int(datetime.now(tz=timezone.utc).timestamp() * 1000)

    async def _conn(self) -> asyncpg.Connection:
        return await asyncpg.connect(get_database_url(), ssl=get_database_ssl())

    @staticmethod
    async def _table_exists(conn: asyncpg.Connection, table_name: str) -> bool:
        return bool(await conn.fetchval("SELECT to_regclass($1)", f"public.{table_name}"))

    async def _is_iam_schema_ready(self, conn: asyncpg.Connection) -> bool:
        for table_name in _IAM_REQUIRED_TABLES:
            if not await self._table_exists(conn, table_name):
                return False
        return True

    async def _ensure_iam_schema_ready(self, conn: asyncpg.Connection) -> None:
        if not await self._is_iam_schema_ready(conn):
            raise IAMSchemaNotReadyError()

    @staticmethod
    def _persona_response(
        *,
        user_id: str,
        personas: list[str],
        last_active_persona: str,
        investor_marketplace_opt_in: bool,
        iam_schema_ready: bool,
        mode: Literal["full", "compat_investor"],
        dev_ria_bypass_allowed: bool = False,
    ) -> dict[str, Any]:
        safe_personas = [persona for persona in personas if persona in _ALLOWED_PERSONAS]
        if not safe_personas:
            safe_personas = ["investor"]
        ria_switch_available = bool(iam_schema_ready and "ria" in safe_personas)
        ria_setup_available = bool(iam_schema_ready and not ria_switch_available)
        safe_last = last_active_persona if last_active_persona in _ALLOWED_PERSONAS else "investor"
        if safe_last == "ria" and not (ria_switch_available or ria_setup_available):
            safe_last = "investor"
        if safe_last == "investor" and "investor" not in safe_personas:
            safe_last = safe_personas[0]
        return {
            "user_id": user_id,
            "personas": safe_personas,
            "last_active_persona": safe_last,
            "active_persona": safe_last,
            "primary_nav_persona": safe_last,
            "ria_setup_available": ria_setup_available,
            "ria_switch_available": ria_switch_available,
            "dev_ria_bypass_allowed": bool(dev_ria_bypass_allowed and iam_schema_ready),
            "investor_marketplace_opt_in": bool(investor_marketplace_opt_in),
            "iam_schema_ready": iam_schema_ready,
            "mode": mode,
        }

    @staticmethod
    def _resolve_full_mode_last_persona(
        *,
        personas: list[str],
        actor_last_persona: str,
        runtime_last_persona: str,
    ) -> PersonaType:
        safe_personas = [persona for persona in personas if persona in _ALLOWED_PERSONAS]
        if not safe_personas:
            safe_personas = ["investor"]

        # `actor_profiles` is the canonical persisted persona state. The runtime table
        # remains only as transitional compatibility for the "same account, entering
        # RIA setup" path before the actor has earned the real `ria` persona.
        if actor_last_persona in safe_personas:
            if (
                actor_last_persona == "investor"
                and "ria" not in safe_personas
                and runtime_last_persona == "ria"
            ):
                return "ria"
            return actor_last_persona  # type: ignore[return-value]

        if "ria" not in safe_personas and runtime_last_persona == "ria":
            return "ria"

        if "investor" in safe_personas:
            return "investor"
        return safe_personas[0]  # type: ignore[return-value]

    async def _runtime_persona_table_ready(self, conn: asyncpg.Connection) -> bool:
        return await self._table_exists(conn, _RUNTIME_PERSONA_STATE_TABLE)

    async def _get_runtime_last_persona(
        self,
        conn: asyncpg.Connection,
        user_id: str,
    ) -> str:
        if not await self._runtime_persona_table_ready(conn):
            return "investor"
        row = await conn.fetchrow(
            """
            SELECT last_active_persona
            FROM runtime_persona_state
            WHERE user_id = $1
            """,
            user_id,
        )
        if row is None:
            return "investor"
        candidate = str(row["last_active_persona"] or "").strip().lower()
        return candidate if candidate in _ALLOWED_PERSONAS else "investor"

    async def _set_runtime_last_persona(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        persona: str,
    ) -> None:
        normalized = self._normalize_persona(persona)
        if not await self._runtime_persona_table_ready(conn):
            return
        await conn.execute(
            """
            INSERT INTO runtime_persona_state (user_id, last_active_persona)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE
            SET
              last_active_persona = $2,
              updated_at = NOW()
            """,
            user_id,
            normalized,
        )

    async def _ensure_vault_user_row(self, conn: asyncpg.Connection, user_id: str) -> None:
        now_ms = self._now_ms()
        await conn.execute(
            """
            INSERT INTO vault_keys (
                user_id,
                vault_status,
                vault_key_hash,
                primary_method,
                primary_wrapper_id,
                recovery_encrypted_vault_key,
                recovery_salt,
                recovery_iv,
                first_login_at,
                last_login_at,
                login_count,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                'placeholder',
                NULL,
                'passphrase',
                'default',
                NULL,
                NULL,
                NULL,
                $2,
                $2,
                1,
                $2,
                $2
            )
            ON CONFLICT (user_id) DO NOTHING
            """,
            user_id,
            now_ms,
        )

    async def _ensure_actor_profile_row(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        *,
        include_ria_persona: bool = False,
    ) -> asyncpg.Record:
        personas = ["investor", "ria"] if include_ria_persona else ["investor"]
        last_active_persona = "ria" if include_ria_persona else "investor"
        row = await conn.fetchrow(
            """
            INSERT INTO actor_profiles (
                user_id,
                personas,
                last_active_persona,
                investor_marketplace_opt_in
            )
            VALUES ($1, $2::text[], $3, FALSE)
            ON CONFLICT (user_id) DO UPDATE
            SET
              personas = CASE
                WHEN $4::boolean = TRUE AND NOT ('ria' = ANY(actor_profiles.personas))
                  THEN array_append(actor_profiles.personas, 'ria')
                ELSE actor_profiles.personas
              END,
              last_active_persona = CASE
                WHEN $4::boolean = TRUE THEN 'ria'
                ELSE actor_profiles.last_active_persona
              END,
              updated_at = NOW()
            RETURNING user_id, personas, last_active_persona, investor_marketplace_opt_in
            """,
            user_id,
            personas,
            last_active_persona,
            include_ria_persona,
        )
        if row is None:
            raise RuntimeError("Failed to ensure actor profile row")
        return row

    async def ensure_actor_profile(self, user_id: str) -> dict[str, Any]:
        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_iam_schema_ready(conn)
                row = await self._ensure_actor_profile_row(conn, user_id)
                return dict(row)
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def get_persona_state(self, user_id: str) -> dict[str, Any]:
        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                schema_ready = await self._is_iam_schema_ready(conn)
                if not schema_ready:
                    # Compatibility mode: preserve investor continuity while IAM schema is unavailable.
                    last_persona = await self._get_runtime_last_persona(conn, user_id)
                    safe_last = "investor" if last_persona == "ria" else last_persona
                    await self._set_runtime_last_persona(conn, user_id, safe_last)
                    return self._persona_response(
                        user_id=user_id,
                        personas=["investor"],
                        last_active_persona=safe_last,
                        investor_marketplace_opt_in=False,
                        iam_schema_ready=False,
                        mode="compat_investor",
                        dev_ria_bypass_allowed=False,
                    )

                row = await self._ensure_actor_profile_row(conn, user_id)
                actor_last_persona = self._normalize_persona(str(row["last_active_persona"]))
                runtime_last_persona = await self._get_runtime_last_persona(conn, user_id)
                effective_last_persona = self._resolve_full_mode_last_persona(
                    personas=list(row["personas"] or []),
                    actor_last_persona=actor_last_persona,
                    runtime_last_persona=runtime_last_persona,
                )
                await self._set_runtime_last_persona(
                    conn,
                    user_id,
                    effective_last_persona,
                )
                return self._persona_response(
                    user_id=str(row["user_id"]),
                    personas=list(row["personas"] or []),
                    last_active_persona=effective_last_persona,
                    investor_marketplace_opt_in=bool(row["investor_marketplace_opt_in"]),
                    iam_schema_ready=True,
                    mode="full",
                    dev_ria_bypass_allowed=self._is_dev_bypass_allowed(user_id),
                )
        except asyncpg.exceptions.UndefinedTableError as exc:
            logger.warning("iam.schema_not_ready fallback user_id=%s", user_id)
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def switch_persona(self, user_id: str, persona: str) -> dict[str, Any]:
        target = self._normalize_persona(persona)
        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                schema_ready = await self._is_iam_schema_ready(conn)
                if not schema_ready:
                    if target != "investor":
                        raise IAMSchemaNotReadyError(
                            "RIA persona is unavailable until IAM schema migration is applied."
                        )
                    await self._set_runtime_last_persona(conn, user_id, "investor")
                    return self._persona_response(
                        user_id=user_id,
                        personas=["investor"],
                        last_active_persona="investor",
                        investor_marketplace_opt_in=False,
                        iam_schema_ready=False,
                        mode="compat_investor",
                        dev_ria_bypass_allowed=False,
                    )
                current = await self._ensure_actor_profile_row(conn, user_id)
                current_personas = list(current["personas"] or [])

                if target == "ria" and "ria" not in current_personas:
                    await self._set_runtime_last_persona(conn, user_id, "ria")
                    return self._persona_response(
                        user_id=str(current["user_id"]),
                        personas=current_personas,
                        last_active_persona="ria",
                        investor_marketplace_opt_in=bool(current["investor_marketplace_opt_in"]),
                        iam_schema_ready=True,
                        mode="full",
                        dev_ria_bypass_allowed=self._is_dev_bypass_allowed(user_id),
                    )

                row = await conn.fetchrow(
                    """
                    UPDATE actor_profiles
                    SET
                      last_active_persona = $2,
                      updated_at = NOW()
                    WHERE user_id = $1
                    RETURNING user_id, personas, last_active_persona, investor_marketplace_opt_in
                    """,
                    user_id,
                    target,
                )
                if row is None:
                    raise RuntimeError("Failed to switch persona")
                await self._set_runtime_last_persona(
                    conn,
                    user_id,
                    str(row["last_active_persona"]),
                )
                return self._persona_response(
                    user_id=str(row["user_id"]),
                    personas=list(row["personas"] or []),
                    last_active_persona=str(row["last_active_persona"]),
                    investor_marketplace_opt_in=bool(row["investor_marketplace_opt_in"]),
                    iam_schema_ready=True,
                    mode="full",
                    dev_ria_bypass_allowed=self._is_dev_bypass_allowed(user_id),
                )
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def set_marketplace_opt_in(self, user_id: str, enabled: bool) -> dict[str, Any]:
        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_iam_schema_ready(conn)
                profile = await conn.fetchrow(
                    """
                    INSERT INTO actor_profiles (
                        user_id,
                        personas,
                        last_active_persona,
                        investor_marketplace_opt_in
                    )
                    VALUES ($1, ARRAY['investor']::text[], 'investor', $2)
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      investor_marketplace_opt_in = $2,
                      updated_at = NOW()
                    RETURNING user_id, investor_marketplace_opt_in
                    """,
                    user_id,
                    enabled,
                )
                if profile is None:
                    raise RuntimeError("Failed to update marketplace opt-in")

                await conn.execute(
                    """
                    INSERT INTO marketplace_public_profiles (
                        user_id,
                        profile_type,
                        display_name,
                        is_discoverable,
                        updated_at
                    )
                    VALUES ($1, 'investor', $3, $2, NOW())
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      profile_type = 'investor',
                      is_discoverable = $2,
                      updated_at = NOW()
                    """,
                    user_id,
                    enabled,
                    f"Investor {user_id[:8]}",
                )
                return {
                    "user_id": profile["user_id"],
                    "investor_marketplace_opt_in": bool(profile["investor_marketplace_opt_in"]),
                }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def _load_scope_template(
        self,
        conn: asyncpg.Connection,
        template_id: str,
    ) -> ScopeTemplate:
        row = await conn.fetchrow(
            """
            SELECT
              template_id,
              requester_actor_type,
              subject_actor_type,
              template_name,
              allowed_scopes,
              default_duration_hours,
              max_duration_hours
            FROM consent_scope_templates
            WHERE template_id = $1 AND active = TRUE
            """,
            template_id,
        )
        if row is None:
            raise RIAIAMPolicyError("Unknown scope template", status_code=404)
        return ScopeTemplate(
            template_id=str(row["template_id"]),
            requester_actor_type=self._normalize_actor(str(row["requester_actor_type"])),
            subject_actor_type=self._normalize_actor(str(row["subject_actor_type"])),
            template_name=str(row["template_name"]),
            allowed_scopes=list(row["allowed_scopes"] or []),
            default_duration_hours=int(row["default_duration_hours"]),
            max_duration_hours=int(row["max_duration_hours"]),
        )

    @staticmethod
    def _parse_metadata(value: Any) -> dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                return {}
        return {}

    @staticmethod
    def _next_action_for_relationship_status(status: str) -> str:
        normalized = (status or "").strip().lower()
        if normalized == "approved":
            return "open_workspace"
        if normalized == "request_pending":
            return "await_consent"
        if normalized in {"revoked", "expired"}:
            return "re_request"
        if normalized == "blocked":
            return "resolve_block"
        return "request_access"

    @staticmethod
    def _resolve_duration_hours(
        template: ScopeTemplate,
        *,
        duration_mode: str,
        duration_hours: int | None,
    ) -> tuple[str, int]:
        mode = (duration_mode or "preset").strip().lower()
        resolved_duration_hours: int
        if mode == "preset":
            resolved_duration_hours = int(duration_hours or template.default_duration_hours)
            if resolved_duration_hours not in _DURATION_PRESETS_HOURS:
                raise RIAIAMPolicyError("Invalid preset duration", status_code=400)
        elif mode == "custom":
            if duration_hours is None:
                raise RIAIAMPolicyError(
                    "duration_hours is required for custom mode", status_code=400
                )
            resolved_duration_hours = int(duration_hours)
            if resolved_duration_hours <= 0:
                raise RIAIAMPolicyError("duration_hours must be positive", status_code=400)
            cap = min(template.max_duration_hours, _MAX_DURATION_HOURS)
            if resolved_duration_hours > cap:
                raise RIAIAMPolicyError("duration exceeds allowed cap", status_code=400)
        else:
            raise RIAIAMPolicyError("Invalid duration_mode", status_code=400)
        return mode, resolved_duration_hours

    async def submit_ria_onboarding(
        self,
        user_id: str,
        *,
        display_name: str,
        legal_name: str | None,
        finra_crd: str | None,
        sec_iard: str | None,
        bio: str | None,
        strategy: str | None,
        disclosures_url: str | None,
        primary_firm_name: str | None,
        primary_firm_role: str | None,
    ) -> dict[str, Any]:
        if not display_name.strip():
            raise RIAIAMPolicyError("display_name is required", status_code=400)

        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_iam_schema_ready(conn)
                await conn.execute(
                    """
                    INSERT INTO actor_profiles (
                        user_id,
                        personas,
                        last_active_persona,
                        investor_marketplace_opt_in
                    )
                    VALUES ($1, ARRAY['investor','ria']::text[], 'ria', FALSE)
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      personas = CASE
                        WHEN 'ria' = ANY(actor_profiles.personas) THEN actor_profiles.personas
                        ELSE array_append(actor_profiles.personas, 'ria')
                      END,
                      last_active_persona = 'ria',
                      updated_at = NOW()
                    """,
                    user_id,
                )
                await self._set_runtime_last_persona(conn, user_id, "ria")

                ria = await conn.fetchrow(
                    """
                    INSERT INTO ria_profiles (
                      user_id,
                      display_name,
                      legal_name,
                      finra_crd,
                      sec_iard,
                      verification_status,
                      verification_provider,
                      bio,
                      strategy,
                      disclosures_url
                    )
                    VALUES (
                      $1,
                      $2,
                      NULLIF($3, ''),
                      NULLIF($4, ''),
                      NULLIF($5, ''),
                      'submitted',
                      'finra',
                      NULLIF($6, ''),
                      NULLIF($7, ''),
                      NULLIF($8, '')
                    )
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      display_name = EXCLUDED.display_name,
                      legal_name = EXCLUDED.legal_name,
                      finra_crd = EXCLUDED.finra_crd,
                      sec_iard = EXCLUDED.sec_iard,
                      verification_status = 'submitted',
                      verification_provider = 'finra',
                      bio = EXCLUDED.bio,
                      strategy = EXCLUDED.strategy,
                      disclosures_url = EXCLUDED.disclosures_url,
                      updated_at = NOW()
                    RETURNING id, user_id, display_name, legal_name, finra_crd, sec_iard, verification_status
                    """,
                    user_id,
                    display_name.strip(),
                    (legal_name or "").strip(),
                    (finra_crd or "").strip(),
                    (sec_iard or "").strip(),
                    (bio or "").strip(),
                    (strategy or "").strip(),
                    (disclosures_url or "").strip(),
                )
                if ria is None:
                    raise RuntimeError("Failed to create RIA profile")

                firm_id: str | None = None
                if primary_firm_name and primary_firm_name.strip():
                    firm_row = await conn.fetchrow(
                        """
                        INSERT INTO ria_firms (legal_name)
                        VALUES ($1)
                        ON CONFLICT (legal_name) DO UPDATE
                        SET updated_at = NOW()
                        RETURNING id
                        """,
                        primary_firm_name.strip(),
                    )
                    if firm_row:
                        firm_id = str(firm_row["id"])
                        await conn.execute(
                            """
                            INSERT INTO ria_firm_memberships (
                              ria_profile_id,
                              firm_id,
                              role_title,
                              membership_status,
                              is_primary
                            )
                            VALUES ($1, $2, NULLIF($3, ''), 'active', TRUE)
                            ON CONFLICT (ria_profile_id, firm_id) DO UPDATE
                            SET
                              role_title = EXCLUDED.role_title,
                              membership_status = 'active',
                              is_primary = TRUE,
                              updated_at = NOW()
                            """,
                            ria["id"],
                            firm_row["id"],
                            (primary_firm_role or "").strip(),
                        )

                verification_result: VerificationResult = await self._verification_gateway.verify(
                    legal_name=(legal_name or "").strip() or display_name.strip(),
                    finra_crd=(finra_crd or "").strip() or None,
                    sec_iard=(sec_iard or "").strip() or None,
                )

                next_status = "submitted"
                if verification_result.verified:
                    next_status = "finra_verified"
                elif verification_result.rejected:
                    next_status = "rejected"

                await conn.execute(
                    """
                    UPDATE ria_profiles
                    SET
                      verification_status = $2,
                      verification_provider = 'finra',
                      verification_expires_at = $3,
                      updated_at = NOW()
                    WHERE id = $1
                    """,
                    ria["id"],
                    next_status,
                    verification_result.expires_at,
                )

                await conn.execute(
                    """
                    INSERT INTO ria_verification_events (
                      ria_profile_id,
                      provider,
                      outcome,
                      checked_at,
                      expires_at,
                      reference_metadata
                    )
                    VALUES ($1, 'finra', $2, NOW(), $3, $4::jsonb)
                    """,
                    ria["id"],
                    verification_result.outcome,
                    verification_result.expires_at,
                    json.dumps(verification_result.metadata),
                )

                await conn.execute(
                    """
                    INSERT INTO marketplace_public_profiles (
                      user_id,
                      profile_type,
                      display_name,
                      headline,
                      strategy_summary,
                      verification_badge,
                      is_discoverable,
                      updated_at
                    )
                    VALUES (
                      $1,
                      'ria',
                      $2,
                      COALESCE(NULLIF($3, ''), NULLIF($4, ''), 'Registered Investment Advisor'),
                      NULLIF($4, ''),
                      CASE WHEN $5 IN ('finra_verified', 'active') THEN 'finra_verified' ELSE 'pending' END,
                      TRUE,
                      NOW()
                    )
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      profile_type = 'ria',
                      display_name = EXCLUDED.display_name,
                      headline = EXCLUDED.headline,
                      strategy_summary = EXCLUDED.strategy_summary,
                      verification_badge = EXCLUDED.verification_badge,
                      is_discoverable = TRUE,
                      updated_at = NOW()
                    """,
                    user_id,
                    display_name.strip(),
                    (bio or "").strip(),
                    (strategy or "").strip(),
                    next_status,
                )

                return {
                    "ria_profile_id": str(ria["id"]),
                    "user_id": str(ria["user_id"]),
                    "display_name": str(ria["display_name"]),
                    "verification_status": next_status,
                    "verification_outcome": verification_result.outcome,
                    "verification_message": verification_result.message,
                    "firm_id": firm_id,
                }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def activate_ria_dev_onboarding(
        self,
        user_id: str,
        *,
        display_name: str,
        legal_name: str | None,
        finra_crd: str | None,
        sec_iard: str | None,
        bio: str | None,
        strategy: str | None,
        disclosures_url: str | None,
        primary_firm_name: str | None,
        primary_firm_role: str | None,
    ) -> dict[str, Any]:
        if not self._is_dev_bypass_allowed(user_id):
            raise RIAIAMPolicyError(
                "RIA dev activation is not allowed for this account", status_code=403
            )
        if not display_name.strip():
            raise RIAIAMPolicyError("display_name is required", status_code=400)

        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_iam_schema_ready(conn)
                await conn.execute(
                    """
                    INSERT INTO actor_profiles (
                        user_id,
                        personas,
                        last_active_persona,
                        investor_marketplace_opt_in
                    )
                    VALUES ($1, ARRAY['investor','ria']::text[], 'ria', FALSE)
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      personas = CASE
                        WHEN 'ria' = ANY(actor_profiles.personas) THEN actor_profiles.personas
                        ELSE array_append(actor_profiles.personas, 'ria')
                      END,
                      last_active_persona = 'ria',
                      updated_at = NOW()
                    """,
                    user_id,
                )
                await self._set_runtime_last_persona(conn, user_id, "ria")

                ria = await conn.fetchrow(
                    """
                    INSERT INTO ria_profiles (
                      user_id,
                      display_name,
                      legal_name,
                      finra_crd,
                      sec_iard,
                      verification_status,
                      verification_provider,
                      bio,
                      strategy,
                      disclosures_url
                    )
                    VALUES (
                      $1,
                      $2,
                      NULLIF($3, ''),
                      NULLIF($4, ''),
                      NULLIF($5, ''),
                      'active',
                      'dev_allowlist',
                      NULLIF($6, ''),
                      NULLIF($7, ''),
                      NULLIF($8, '')
                    )
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      display_name = EXCLUDED.display_name,
                      legal_name = EXCLUDED.legal_name,
                      finra_crd = EXCLUDED.finra_crd,
                      sec_iard = EXCLUDED.sec_iard,
                      verification_status = 'active',
                      verification_provider = 'dev_allowlist',
                      verification_expires_at = NULL,
                      bio = EXCLUDED.bio,
                      strategy = EXCLUDED.strategy,
                      disclosures_url = EXCLUDED.disclosures_url,
                      updated_at = NOW()
                    RETURNING id, user_id, display_name
                    """,
                    user_id,
                    display_name.strip(),
                    (legal_name or "").strip(),
                    (finra_crd or "").strip(),
                    (sec_iard or "").strip(),
                    (bio or "").strip(),
                    (strategy or "").strip(),
                    (disclosures_url or "").strip(),
                )
                if ria is None:
                    raise RuntimeError("Failed to create RIA profile")

                firm_id: str | None = None
                if primary_firm_name and primary_firm_name.strip():
                    firm_row = await conn.fetchrow(
                        """
                        INSERT INTO ria_firms (legal_name)
                        VALUES ($1)
                        ON CONFLICT (legal_name) DO UPDATE
                        SET updated_at = NOW()
                        RETURNING id
                        """,
                        primary_firm_name.strip(),
                    )
                    if firm_row:
                        firm_id = str(firm_row["id"])
                        await conn.execute(
                            """
                            INSERT INTO ria_firm_memberships (
                              ria_profile_id,
                              firm_id,
                              role_title,
                              membership_status,
                              is_primary
                            )
                            VALUES ($1, $2, NULLIF($3, ''), 'active', TRUE)
                            ON CONFLICT (ria_profile_id, firm_id) DO UPDATE
                            SET
                              role_title = EXCLUDED.role_title,
                              membership_status = 'active',
                              is_primary = TRUE,
                              updated_at = NOW()
                            """,
                            ria["id"],
                            firm_row["id"],
                            (primary_firm_role or "").strip(),
                        )

                await conn.execute(
                    """
                    INSERT INTO ria_verification_events (
                      ria_profile_id,
                      provider,
                      outcome,
                      checked_at,
                      expires_at,
                      reference_metadata
                    )
                    VALUES ($1, 'dev_allowlist', 'dev_allowlist', NOW(), NULL, $2::jsonb)
                    """,
                    ria["id"],
                    json.dumps({"source": "dev_allowlist", "user_id": user_id}),
                )

                await conn.execute(
                    """
                    INSERT INTO marketplace_public_profiles (
                      user_id,
                      profile_type,
                      display_name,
                      headline,
                      strategy_summary,
                      verification_badge,
                      is_discoverable,
                      updated_at
                    )
                    VALUES (
                      $1,
                      'ria',
                      $2,
                      COALESCE(NULLIF($3, ''), NULLIF($4, ''), 'Registered Investment Advisor'),
                      NULLIF($4, ''),
                      'dev_allowlist',
                      TRUE,
                      NOW()
                    )
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      profile_type = 'ria',
                      display_name = EXCLUDED.display_name,
                      headline = EXCLUDED.headline,
                      strategy_summary = EXCLUDED.strategy_summary,
                      verification_badge = EXCLUDED.verification_badge,
                      is_discoverable = TRUE,
                      updated_at = NOW()
                    """,
                    user_id,
                    display_name.strip(),
                    (bio or "").strip(),
                    (strategy or "").strip(),
                )

                return {
                    "ria_profile_id": str(ria["id"]),
                    "user_id": str(ria["user_id"]),
                    "display_name": str(ria["display_name"]),
                    "verification_status": "active",
                    "verification_outcome": "dev_allowlist",
                    "verification_message": "RIA activated for an allowlisted development account",
                    "firm_id": firm_id,
                }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def get_ria_onboarding_status(self, user_id: str) -> dict[str, Any]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            await self._ensure_vault_user_row(conn, user_id)
            await self._ensure_actor_profile_row(conn, user_id)
            ria = await conn.fetchrow(
                """
                SELECT
                  id,
                  user_id,
                  display_name,
                  legal_name,
                  finra_crd,
                  sec_iard,
                  verification_status,
                  verification_provider,
                  verification_expires_at,
                  created_at,
                  updated_at
                FROM ria_profiles
                WHERE user_id = $1
                """,
                user_id,
            )
            if ria is None:
                return {
                    "exists": False,
                    "verification_status": "draft",
                    "dev_ria_bypass_allowed": self._is_dev_bypass_allowed(user_id),
                }

            latest_event = await conn.fetchrow(
                """
                SELECT outcome, checked_at, expires_at, reference_metadata
                FROM ria_verification_events
                WHERE ria_profile_id = $1
                ORDER BY checked_at DESC
                LIMIT 1
                """,
                ria["id"],
            )
            event = dict(latest_event) if latest_event else None
            if event and "reference_metadata" in event:
                event["reference_metadata"] = self._parse_metadata(event["reference_metadata"])

            return {
                "exists": True,
                "ria_profile_id": str(ria["id"]),
                "display_name": ria["display_name"],
                "legal_name": ria["legal_name"],
                "finra_crd": ria["finra_crd"],
                "sec_iard": ria["sec_iard"],
                "verification_status": ria["verification_status"],
                "verification_provider": ria["verification_provider"],
                "verification_expires_at": ria["verification_expires_at"],
                "dev_ria_bypass_allowed": self._is_dev_bypass_allowed(user_id),
                "latest_verification_event": event,
            }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def list_ria_firms(self, user_id: str) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            rows = await conn.fetch(
                """
                SELECT
                  f.id,
                  f.legal_name,
                  f.finra_firm_crd,
                  f.sec_iard,
                  f.website_url,
                  m.role_title,
                  m.membership_status,
                  m.is_primary
                FROM ria_profiles rp
                JOIN ria_firm_memberships m ON m.ria_profile_id = rp.id
                JOIN ria_firms f ON f.id = m.firm_id
                WHERE rp.user_id = $1
                ORDER BY m.is_primary DESC, f.legal_name ASC
                """,
                user_id,
            )
            return [dict(row) for row in rows]
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def list_ria_clients(self, user_id: str) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            relationship_rows = await conn.fetch(
                """
                SELECT
                  rel.id,
                  rel.investor_user_id,
                  rel.status,
                  rel.granted_scope,
                  rel.last_request_id,
                  rel.consent_granted_at,
                  rel.revoked_at,
                  mp.display_name AS investor_display_name,
                  mp.headline AS investor_headline,
                  invite.id AS invite_id,
                  invite.invite_token,
                  invite.source AS acquisition_source,
                  invite.status AS invite_status,
                  invite.delivery_channel,
                  consent.expires_at AS consent_expires_at
                FROM ria_profiles rp
                JOIN advisor_investor_relationships rel ON rel.ria_profile_id = rp.id
                LEFT JOIN marketplace_public_profiles mp
                  ON mp.user_id = rel.investor_user_id AND mp.profile_type = 'investor'
                LEFT JOIN LATERAL (
                  SELECT
                    i.id,
                    i.invite_token,
                    i.source,
                    i.status,
                    i.delivery_channel
                  FROM ria_client_invites i
                  WHERE i.ria_profile_id = rp.id
                    AND (
                      i.accepted_by_user_id = rel.investor_user_id
                      OR (
                        i.target_investor_user_id IS NOT NULL
                        AND i.target_investor_user_id = rel.investor_user_id
                      )
                    )
                  ORDER BY i.accepted_at DESC NULLS LAST, i.created_at DESC
                  LIMIT 1
                ) invite ON TRUE
                LEFT JOIN LATERAL (
                  SELECT expires_at
                  FROM consent_audit
                  WHERE user_id = rel.investor_user_id
                    AND agent_id = ('ria:' || rp.id::text)
                    AND scope = rel.granted_scope
                    AND action = 'CONSENT_GRANTED'
                  ORDER BY issued_at DESC
                  LIMIT 1
                ) consent ON TRUE
                WHERE rp.user_id = $1
                ORDER BY rel.updated_at DESC
                """,
                user_id,
            )
            invite_rows = await conn.fetch(
                """
                SELECT
                  i.id,
                  i.invite_token,
                  i.target_investor_user_id,
                  i.target_display_name,
                  i.target_email,
                  i.target_phone,
                  i.source,
                  i.status,
                  i.delivery_channel,
                  i.scope_template_id,
                  i.expires_at,
                  i.created_at
                FROM ria_profiles rp
                JOIN ria_client_invites i ON i.ria_profile_id = rp.id
                LEFT JOIN advisor_investor_relationships rel
                  ON rel.ria_profile_id = rp.id
                  AND rel.investor_user_id = COALESCE(i.accepted_by_user_id, i.target_investor_user_id)
                WHERE rp.user_id = $1
                  AND i.status = 'sent'
                  AND i.expires_at > NOW()
                  AND rel.id IS NULL
                ORDER BY i.created_at DESC
                """,
                user_id,
            )

            items: list[dict[str, Any]] = []
            for row in relationship_rows:
                payload = dict(row)
                payload["acquisition_source"] = payload.get("acquisition_source") or (
                    "marketplace" if payload.get("investor_display_name") else "manual"
                )
                payload["next_action"] = self._next_action_for_relationship_status(
                    str(payload.get("status") or "")
                )
                payload["is_invite_only"] = False
                items.append(payload)

            for row in invite_rows:
                payload = dict(row)
                headline = (
                    payload.get("target_email") or payload.get("target_phone") or "Invite pending"
                )
                items.append(
                    {
                        "id": f"invite:{payload['id']}",
                        "invite_id": str(payload["id"]),
                        "invite_token": payload["invite_token"],
                        "investor_user_id": payload.get("target_investor_user_id"),
                        "status": "invited",
                        "granted_scope": None,
                        "last_request_id": None,
                        "consent_granted_at": None,
                        "revoked_at": None,
                        "investor_display_name": payload.get("target_display_name")
                        or payload.get("target_email")
                        or payload.get("target_phone")
                        or "Invited investor",
                        "investor_headline": headline,
                        "acquisition_source": payload.get("source") or "manual",
                        "invite_status": payload.get("status"),
                        "delivery_channel": payload.get("delivery_channel"),
                        "consent_expires_at": None,
                        "invite_expires_at": payload.get("expires_at"),
                        "next_action": "await_acceptance",
                        "scope_template_id": payload.get("scope_template_id"),
                        "is_invite_only": True,
                    }
                )

            return items
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def list_ria_requests(self, user_id: str) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            ria = await conn.fetchrow(
                "SELECT id FROM ria_profiles WHERE user_id = $1",
                user_id,
            )
            if ria is None:
                return []

            agent_id = f"ria:{ria['id']}"
            rows = await conn.fetch(
                """
                SELECT
                  audit.request_id,
                  audit.user_id,
                  audit.scope,
                  audit.action,
                  audit.issued_at,
                  audit.expires_at,
                  audit.metadata,
                  mp.display_name AS subject_display_name,
                  mp.headline AS subject_headline
                FROM consent_audit audit
                LEFT JOIN marketplace_public_profiles mp
                  ON mp.user_id = audit.user_id
                  AND mp.profile_type = 'investor'
                WHERE audit.agent_id = $1
                  AND audit.request_id IS NOT NULL
                  AND audit.action IN (
                    'REQUESTED',
                    'CONSENT_GRANTED',
                    'CONSENT_DENIED',
                    'CANCELLED',
                    'REVOKED',
                    'TIMEOUT'
                  )
                ORDER BY audit.issued_at DESC
                """,
                agent_id,
            )

            latest_by_request: dict[str, dict[str, Any]] = {}
            for row in rows:
                request_id = row["request_id"]
                if not request_id:
                    continue
                if request_id in latest_by_request:
                    continue
                payload = dict(row)
                payload["metadata"] = self._parse_metadata(payload.get("metadata"))
                latest_by_request[str(request_id)] = payload

            return list(latest_by_request.values())
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def list_ria_invites(self, user_id: str) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            rows = await conn.fetch(
                """
                SELECT
                  i.id,
                  i.invite_token,
                  i.target_display_name,
                  i.target_email,
                  i.target_phone,
                  i.target_investor_user_id,
                  i.source,
                  i.delivery_channel,
                  i.status,
                  i.scope_template_id,
                  i.duration_mode,
                  i.duration_hours,
                  i.reason,
                  i.accepted_by_user_id,
                  i.accepted_request_id,
                  i.expires_at,
                  i.accepted_at,
                  i.created_at
                FROM ria_profiles rp
                JOIN ria_client_invites i ON i.ria_profile_id = rp.id
                WHERE rp.user_id = $1
                ORDER BY i.created_at DESC
                """,
                user_id,
            )
            return [dict(row) for row in rows]
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def create_ria_invites(
        self,
        user_id: str,
        *,
        scope_template_id: str,
        duration_mode: str,
        duration_hours: int | None,
        firm_id: str | None,
        reason: str | None,
        targets: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not targets:
            raise RIAIAMPolicyError("At least one invite target is required", status_code=400)

        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_iam_schema_ready(conn)
                await self._ensure_actor_profile_row(conn, user_id, include_ria_persona=True)

                ria = await self._get_ria_profile_by_user(conn, user_id)
                if ria["verification_status"] not in {"finra_verified", "active"}:
                    raise RIAIAMPolicyError(
                        "RIA verification incomplete; cannot send invites",
                        status_code=403,
                    )

                template = await self._load_scope_template(conn, scope_template_id)
                if (
                    template.requester_actor_type != "ria"
                    or template.subject_actor_type != "investor"
                ):
                    raise RIAIAMPolicyError(
                        "Scope template actor direction mismatch",
                        status_code=400,
                    )

                mode, resolved_duration_hours = self._resolve_duration_hours(
                    template,
                    duration_mode=duration_mode,
                    duration_hours=duration_hours,
                )

                if firm_id:
                    membership = await conn.fetchrow(
                        """
                        SELECT 1
                        FROM ria_firm_memberships
                        WHERE ria_profile_id = $1
                          AND firm_id = $2::uuid
                          AND membership_status = 'active'
                        """,
                        ria["id"],
                        firm_id,
                    )
                    if membership is None:
                        raise RIAIAMPolicyError("Firm membership is not active", status_code=403)

                created_items: list[dict[str, Any]] = []
                expires_at = datetime.now(tz=timezone.utc) + timedelta(
                    hours=resolved_duration_hours
                )

                for raw_target in targets:
                    display_name = str(raw_target.get("display_name") or "").strip() or None
                    email = str(raw_target.get("email") or "").strip().lower() or None
                    phone = str(raw_target.get("phone") or "").strip() or None
                    investor_user_id = str(raw_target.get("investor_user_id") or "").strip() or None
                    source = str(raw_target.get("source") or "manual").strip().lower() or "manual"
                    delivery_channel = (
                        str(raw_target.get("delivery_channel") or "share_link").strip().lower()
                        or "share_link"
                    )
                    if source not in {"manual", "marketplace", "csv"}:
                        raise RIAIAMPolicyError("Invalid invite source", status_code=400)
                    if delivery_channel not in {"share_link", "email", "sms"}:
                        raise RIAIAMPolicyError("Invalid invite delivery channel", status_code=400)
                    if not any([display_name, email, phone, investor_user_id]):
                        raise RIAIAMPolicyError(
                            "Invite target requires a name, contact, or investor user id",
                            status_code=400,
                        )

                    if investor_user_id:
                        await self._ensure_vault_user_row(conn, investor_user_id)
                        await self._ensure_actor_profile_row(conn, investor_user_id)

                    invite_token = uuid.uuid4().hex
                    invite_row = await conn.fetchrow(
                        """
                        INSERT INTO ria_client_invites (
                          invite_token,
                          ria_profile_id,
                          firm_id,
                          target_display_name,
                          target_email,
                          target_phone,
                          target_investor_user_id,
                          source,
                          delivery_channel,
                          status,
                          scope_template_id,
                          duration_mode,
                          duration_hours,
                          reason,
                          expires_at,
                          metadata
                        )
                        VALUES (
                          $1,
                          $2,
                          $3::uuid,
                          NULLIF($4, ''),
                          NULLIF($5, ''),
                          NULLIF($6, ''),
                          $7,
                          $8,
                          $9,
                          'sent',
                          $10,
                          $11,
                          $12,
                          NULLIF($13, ''),
                          $14,
                          $15::jsonb
                        )
                        RETURNING id, invite_token, status, expires_at
                        """,
                        invite_token,
                        ria["id"],
                        firm_id,
                        display_name or "",
                        email or "",
                        phone or "",
                        investor_user_id,
                        source,
                        delivery_channel,
                        template.template_id,
                        mode,
                        resolved_duration_hours,
                        (reason or "").strip(),
                        expires_at,
                        json.dumps(
                            {
                                "template_name": template.template_name,
                                "requester_actor_type": "ria",
                                "subject_actor_type": "investor",
                            }
                        ),
                    )
                    if invite_row is None:
                        raise RuntimeError("Failed to create invite")

                    created_items.append(
                        {
                            "invite_id": str(invite_row["id"]),
                            "invite_token": invite_row["invite_token"],
                            "invite_path": f"/kai/onboarding?invite={invite_row['invite_token']}",
                            "status": invite_row["status"],
                            "expires_at": invite_row["expires_at"],
                            "scope_template_id": template.template_id,
                            "duration_mode": mode,
                            "duration_hours": resolved_duration_hours,
                            "source": source,
                            "delivery_channel": delivery_channel,
                            "target_display_name": display_name,
                            "target_email": email,
                            "target_phone": phone,
                            "target_investor_user_id": investor_user_id,
                        }
                    )

                return {"items": created_items}
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def set_ria_marketplace_discoverability(
        self,
        user_id: str,
        *,
        enabled: bool,
        headline: str | None = None,
        strategy_summary: str | None = None,
    ) -> dict[str, Any]:
        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_iam_schema_ready(conn)
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_actor_profile_row(conn, user_id, include_ria_persona=True)

                ria = await conn.fetchrow(
                    """
                    SELECT id, display_name, verification_status, strategy
                    FROM ria_profiles
                    WHERE user_id = $1
                    """,
                    user_id,
                )
                if ria is None:
                    raise RIAIAMPolicyError("RIA profile not found", status_code=404)

                await conn.execute(
                    """
                    INSERT INTO marketplace_public_profiles (
                      user_id,
                      profile_type,
                      display_name,
                      headline,
                      strategy_summary,
                      verification_badge,
                      metadata,
                      is_discoverable
                    )
                    VALUES (
                      $1,
                      'ria',
                      $2,
                      NULLIF($3, ''),
                      NULLIF($4, ''),
                      $5,
                      '{}'::jsonb,
                      $6
                    )
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      display_name = EXCLUDED.display_name,
                      headline = COALESCE(EXCLUDED.headline, marketplace_public_profiles.headline),
                      strategy_summary = COALESCE(
                        EXCLUDED.strategy_summary,
                        marketplace_public_profiles.strategy_summary
                      ),
                      verification_badge = EXCLUDED.verification_badge,
                      is_discoverable = EXCLUDED.is_discoverable,
                      updated_at = NOW()
                    """,
                    user_id,
                    ria["display_name"],
                    (headline or "").strip(),
                    (strategy_summary or str(ria["strategy"] or "")).strip(),
                    str(ria["verification_status"] or ""),
                    bool(enabled),
                )

                return {
                    "user_id": user_id,
                    "is_discoverable": bool(enabled),
                    "verification_status": str(ria["verification_status"] or ""),
                }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def get_ria_invite(self, invite_token: str) -> dict[str, Any]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            row = await conn.fetchrow(
                """
                SELECT
                  i.id,
                  i.invite_token,
                  i.status,
                  i.firm_id,
                  i.scope_template_id,
                  i.duration_mode,
                  i.duration_hours,
                  i.reason,
                  i.expires_at,
                  i.target_display_name,
                  i.target_email,
                  i.target_phone,
                  i.accepted_by_user_id,
                  i.accepted_request_id,
                  rp.id AS ria_profile_id,
                  rp.user_id AS ria_user_id,
                  rp.display_name AS ria_display_name,
                  rp.verification_status,
                  rp.bio,
                  rp.strategy,
                  mp.headline,
                  mp.strategy_summary,
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'firm_id', f.id,
                        'legal_name', f.legal_name,
                        'role_title', m.role_title,
                        'is_primary', m.is_primary
                      )
                    ) FILTER (WHERE f.id IS NOT NULL),
                    '[]'::json
                  ) AS firms
                FROM ria_client_invites i
                JOIN ria_profiles rp ON rp.id = i.ria_profile_id
                LEFT JOIN marketplace_public_profiles mp
                  ON mp.user_id = rp.user_id
                  AND mp.profile_type = 'ria'
                LEFT JOIN ria_firm_memberships m
                  ON m.ria_profile_id = rp.id
                  AND m.membership_status = 'active'
                LEFT JOIN ria_firms f ON f.id = m.firm_id
                WHERE i.invite_token = $1
                GROUP BY
                  i.id,
                  i.invite_token,
                  i.status,
                  i.firm_id,
                  i.scope_template_id,
                  i.duration_mode,
                  i.duration_hours,
                  i.reason,
                  i.expires_at,
                  i.target_display_name,
                  i.target_email,
                  i.target_phone,
                  i.accepted_by_user_id,
                  i.accepted_request_id,
                  rp.id,
                  rp.user_id,
                  rp.display_name,
                  rp.verification_status,
                  rp.bio,
                  rp.strategy,
                  mp.headline,
                  mp.strategy_summary
                """,
                invite_token,
            )
            if row is None:
                raise RIAIAMPolicyError("Invite not found", status_code=404)

            payload = dict(row)
            if payload["status"] == "cancelled":
                raise RIAIAMPolicyError("Invite is no longer available", status_code=410)
            if payload["status"] == "sent" and payload["expires_at"] <= datetime.now(
                tz=timezone.utc
            ):
                await conn.execute(
                    """
                    UPDATE ria_client_invites
                    SET status = 'expired', updated_at = NOW()
                    WHERE id = $1
                    """,
                    payload["id"],
                )
                payload["status"] = "expired"
            if payload["status"] == "expired":
                raise RIAIAMPolicyError("Invite has expired", status_code=410)

            return {
                "invite_id": str(payload["id"]),
                "invite_token": payload["invite_token"],
                "status": payload["status"],
                "firm_id": str(payload["firm_id"]) if payload.get("firm_id") else None,
                "scope_template_id": payload["scope_template_id"],
                "duration_mode": payload["duration_mode"],
                "duration_hours": payload["duration_hours"],
                "reason": payload["reason"],
                "expires_at": payload["expires_at"],
                "target_display_name": payload["target_display_name"],
                "target_email": payload["target_email"],
                "target_phone": payload["target_phone"],
                "accepted_by_user_id": payload["accepted_by_user_id"],
                "accepted_request_id": payload["accepted_request_id"],
                "ria": {
                    "id": str(payload["ria_profile_id"]),
                    "user_id": payload["ria_user_id"],
                    "display_name": payload["ria_display_name"],
                    "verification_status": payload["verification_status"],
                    "headline": payload["headline"],
                    "strategy_summary": payload["strategy_summary"] or payload["strategy"],
                    "bio": payload["bio"],
                    "firms": payload["firms"] or [],
                },
            }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def accept_ria_invite(self, invite_token: str, user_id: str) -> dict[str, Any]:
        invite = await self.get_ria_invite(invite_token)
        if invite["status"] == "accepted":
            if invite.get("accepted_by_user_id") == user_id and invite.get("accepted_request_id"):
                return {
                    "invite_token": invite_token,
                    "request_id": invite["accepted_request_id"],
                    "status": "accepted",
                    "ria": invite["ria"],
                }
            raise RIAIAMPolicyError("Invite has already been accepted", status_code=409)
        ria_user_id = str(invite["ria"]["user_id"])
        request = await self.create_ria_consent_request(
            ria_user_id,
            subject_user_id=user_id,
            requester_actor_type="ria",
            subject_actor_type="investor",
            scope_template_id=str(invite["scope_template_id"]),
            selected_scope=None,
            duration_mode=str(invite["duration_mode"]),
            duration_hours=int(invite["duration_hours"]) if invite["duration_hours"] else None,
            firm_id=invite.get("firm_id"),
            reason=str(invite.get("reason") or "") or None,
            invite_id=str(invite["invite_id"]),
            invite_token=invite_token,
            request_origin="invite_acceptance",
        )

        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            updated = await conn.execute(
                """
                UPDATE ria_client_invites
                SET
                  status = 'accepted',
                  accepted_by_user_id = $2,
                  accepted_request_id = $3,
                  accepted_at = NOW(),
                  updated_at = NOW()
                WHERE invite_token = $1
                  AND status = 'sent'
                """,
                invite_token,
                user_id,
                request["request_id"],
            )
            if updated.endswith("0"):
                logger.warning("RIA invite accept race detected for token=%s", invite_token)
            return {
                "invite_token": invite_token,
                "request_id": request["request_id"],
                "status": "accepted",
                "scope": request["scope"],
                "expires_at": request["expires_at"],
                "ria": invite["ria"],
            }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def _get_ria_profile_by_user(
        self, conn: asyncpg.Connection, user_id: str
    ) -> asyncpg.Record:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, verification_status
            FROM ria_profiles
            WHERE user_id = $1
            """,
            user_id,
        )
        if row is None:
            raise RIAIAMPolicyError("RIA profile not found", status_code=404)
        return row

    async def create_ria_consent_request(
        self,
        user_id: str,
        *,
        subject_user_id: str,
        requester_actor_type: str,
        subject_actor_type: str,
        scope_template_id: str,
        selected_scope: str | None,
        duration_mode: str,
        duration_hours: int | None,
        firm_id: str | None,
        reason: str | None,
        invite_id: str | None = None,
        invite_token: str | None = None,
        request_origin: str | None = None,
    ) -> dict[str, Any]:
        requester = self._normalize_actor(requester_actor_type)
        subject = self._normalize_actor(subject_actor_type)
        if requester != "ria" or subject != "investor":
            raise RIAIAMPolicyError("Only ria -> investor requests are allowed in this phase")

        conn = await self._conn()
        try:
            async with conn.transaction():
                await self._ensure_vault_user_row(conn, user_id)
                await self._ensure_vault_user_row(conn, subject_user_id)
                await self._ensure_iam_schema_ready(conn)
                await self._ensure_actor_profile_row(conn, user_id, include_ria_persona=True)
                await self._ensure_actor_profile_row(conn, subject_user_id)

                ria = await self._get_ria_profile_by_user(conn, user_id)
                if ria["verification_status"] not in {"finra_verified", "active"}:
                    raise RIAIAMPolicyError(
                        "RIA verification incomplete; cannot create consent requests",
                        status_code=403,
                    )

                template = await self._load_scope_template(conn, scope_template_id)
                if (
                    template.requester_actor_type != requester
                    or template.subject_actor_type != subject
                ):
                    raise RIAIAMPolicyError(
                        "Scope template actor direction mismatch", status_code=400
                    )

                chosen_scope = (selected_scope or "").strip() or (
                    template.allowed_scopes[0] if template.allowed_scopes else ""
                )
                if not chosen_scope:
                    raise RIAIAMPolicyError("No scope available for template", status_code=400)
                if chosen_scope not in template.allowed_scopes:
                    raise RIAIAMPolicyError(
                        "Selected scope is not allowed for this template", status_code=400
                    )

                mode, resolved_duration_hours = self._resolve_duration_hours(
                    template,
                    duration_mode=duration_mode,
                    duration_hours=duration_hours,
                )

                if firm_id:
                    membership = await conn.fetchrow(
                        """
                        SELECT 1
                        FROM ria_firm_memberships
                        WHERE ria_profile_id = $1
                          AND firm_id = $2::uuid
                          AND membership_status = 'active'
                        """,
                        ria["id"],
                        firm_id,
                    )
                    if membership is None:
                        raise RIAIAMPolicyError("Firm membership is not active", status_code=403)

                request_id = uuid.uuid4().hex
                now_ms = self._now_ms()
                expires_at_ms = now_ms + (resolved_duration_hours * 60 * 60 * 1000)
                agent_id = f"ria:{ria['id']}"

                metadata = {
                    "requester_actor_type": requester,
                    "subject_actor_type": subject,
                    "requester_entity_id": str(ria["id"]),
                    "firm_id": firm_id,
                    "scope_template_id": template.template_id,
                    "duration_mode": mode,
                    "duration_hours": resolved_duration_hours,
                    "reason": (reason or "").strip() or None,
                    "request_origin": (request_origin or "").strip() or "direct_ria_request",
                    "invite_id": invite_id,
                    "invite_token": invite_token,
                }

                await conn.execute(
                    """
                    INSERT INTO consent_audit (
                      token_id,
                      user_id,
                      agent_id,
                      scope,
                      action,
                      issued_at,
                      expires_at,
                      request_id,
                      scope_description,
                      metadata
                    )
                    VALUES (
                      $1,
                      $2,
                      $3,
                      $4,
                      'REQUESTED',
                      $5,
                      $6,
                      $7,
                      $8,
                      $9::jsonb
                    )
                    """,
                    f"req_{request_id}",
                    subject_user_id,
                    agent_id,
                    chosen_scope,
                    now_ms,
                    expires_at_ms,
                    request_id,
                    template.template_name,
                    json.dumps(metadata),
                )

                relationship = await conn.fetchrow(
                    """
                    SELECT id
                    FROM advisor_investor_relationships
                    WHERE investor_user_id = $1
                      AND ria_profile_id = $2
                      AND (
                        (firm_id IS NULL AND $3::uuid IS NULL)
                        OR firm_id = $3::uuid
                      )
                    LIMIT 1
                    """,
                    subject_user_id,
                    ria["id"],
                    firm_id,
                )

                if relationship is None:
                    await conn.execute(
                        """
                        INSERT INTO advisor_investor_relationships (
                          investor_user_id,
                          ria_profile_id,
                          firm_id,
                          status,
                          last_request_id,
                          granted_scope,
                          created_at,
                          updated_at
                        )
                        VALUES (
                          $1,
                          $2,
                          $3::uuid,
                          'request_pending',
                          $4,
                          $5,
                          NOW(),
                          NOW()
                        )
                        """,
                        subject_user_id,
                        ria["id"],
                        firm_id,
                        request_id,
                        chosen_scope,
                    )
                else:
                    await conn.execute(
                        """
                        UPDATE advisor_investor_relationships
                        SET
                          status = 'request_pending',
                          last_request_id = $2,
                          granted_scope = $3,
                          updated_at = NOW()
                        WHERE id = $1
                        """,
                        relationship["id"],
                        request_id,
                        chosen_scope,
                    )

                return {
                    "request_id": request_id,
                    "subject_user_id": subject_user_id,
                    "scope": chosen_scope,
                    "duration_hours": resolved_duration_hours,
                    "duration_mode": mode,
                    "expires_at": expires_at_ms,
                    "scope_template_id": template.template_id,
                    "requester_entity_id": str(ria["id"]),
                    "status": "REQUESTED",
                }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def get_ria_workspace(self, user_id: str, investor_user_id: str) -> dict[str, Any]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            ria = await self._get_ria_profile_by_user(conn, user_id)
            relationship = await conn.fetchrow(
                """
                SELECT
                  rel.id,
                  rel.status,
                  rel.granted_scope,
                  rel.last_request_id,
                  rel.consent_granted_at,
                  rel.revoked_at,
                  mp.display_name AS investor_display_name,
                  mp.headline AS investor_headline
                FROM advisor_investor_relationships rel
                LEFT JOIN marketplace_public_profiles mp
                  ON mp.user_id = rel.investor_user_id
                  AND mp.profile_type = 'investor'
                WHERE rel.investor_user_id = $1
                  AND rel.ria_profile_id = $2
                ORDER BY rel.updated_at DESC
                LIMIT 1
                """,
                investor_user_id,
                ria["id"],
            )
            if relationship is None or relationship["status"] != "approved":
                raise RIAIAMPolicyError(
                    "No approved relationship for investor workspace", status_code=403
                )

            agent_id = f"ria:{ria['id']}"
            consent_row = await conn.fetchrow(
                """
                SELECT action, expires_at, issued_at
                FROM consent_audit
                WHERE user_id = $1
                  AND agent_id = $2
                  AND scope = $3
                  AND action IN ('CONSENT_GRANTED', 'REVOKED', 'CONSENT_DENIED', 'CANCELLED', 'TIMEOUT')
                ORDER BY issued_at DESC
                LIMIT 1
                """,
                investor_user_id,
                agent_id,
                relationship["granted_scope"],
            )
            if consent_row is None or consent_row["action"] != "CONSENT_GRANTED":
                raise RIAIAMPolicyError("Consent is not active for this workspace", status_code=403)
            now_ms = self._now_ms()
            if consent_row["expires_at"] and int(consent_row["expires_at"]) <= now_ms:
                raise RIAIAMPolicyError("Consent has expired", status_code=403)

            metadata = await conn.fetchrow(
                """
                SELECT
                  user_id,
                  available_domains,
                  domain_summaries,
                  total_attributes,
                  updated_at
                FROM world_model_index_v2
                WHERE user_id = $1
                """,
                investor_user_id,
            )
            if metadata is None:
                return {
                    "investor_user_id": investor_user_id,
                    "workspace_ready": False,
                    "available_domains": [],
                    "domain_summaries": {},
                    "total_attributes": 0,
                    "investor_display_name": relationship["investor_display_name"],
                    "investor_headline": relationship["investor_headline"],
                    "relationship_status": relationship["status"],
                    "scope": relationship["granted_scope"],
                    "consent_expires_at": consent_row["expires_at"],
                }

            return {
                "investor_user_id": investor_user_id,
                "investor_display_name": relationship["investor_display_name"],
                "investor_headline": relationship["investor_headline"],
                "workspace_ready": True,
                "available_domains": list(metadata["available_domains"] or []),
                "domain_summaries": dict(metadata["domain_summaries"] or {}),
                "total_attributes": int(metadata["total_attributes"] or 0),
                "updated_at": metadata["updated_at"],
                "relationship_status": relationship["status"],
                "scope": relationship["granted_scope"],
                "consent_expires_at": consent_row["expires_at"],
            }
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def sync_relationship_from_consent_action(
        self,
        *,
        user_id: str,
        request_id: str | None,
        action: str,
        agent_id: str | None = None,
        scope: str | None = None,
    ) -> None:
        if action not in {"CONSENT_GRANTED", "CONSENT_DENIED", "CANCELLED", "REVOKED", "TIMEOUT"}:
            return

        conn = await self._conn()
        try:
            async with conn.transaction():
                if not await self._is_iam_schema_ready(conn):
                    return
                row: asyncpg.Record | None = None
                if request_id:
                    row = await conn.fetchrow(
                        """
                        SELECT request_id, user_id, agent_id, scope, metadata
                        FROM consent_audit
                        WHERE request_id = $1
                          AND action = 'REQUESTED'
                        ORDER BY issued_at DESC
                        LIMIT 1
                        """,
                        request_id,
                    )
                if row is None and action == "REVOKED" and agent_id and scope:
                    row = await conn.fetchrow(
                        """
                        SELECT request_id, user_id, agent_id, scope, metadata
                        FROM consent_audit
                        WHERE user_id = $1
                          AND agent_id = $2
                          AND scope = $3
                          AND action = 'REQUESTED'
                        ORDER BY issued_at DESC
                        LIMIT 1
                        """,
                        user_id,
                        agent_id,
                        scope,
                    )

                if row is None:
                    return

                metadata = self._parse_metadata(row["metadata"])
                if metadata.get("requester_actor_type") != "ria":
                    return

                requester_entity_id = metadata.get("requester_entity_id")
                if not requester_entity_id:
                    return

                relationship = await conn.fetchrow(
                    """
                    SELECT id
                    FROM advisor_investor_relationships
                    WHERE investor_user_id = $1
                      AND ria_profile_id = $2::uuid
                      AND (
                        last_request_id = $3
                        OR ($3 IS NULL AND granted_scope = $4)
                      )
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    user_id,
                    requester_entity_id,
                    row["request_id"],
                    row["scope"],
                )
                if relationship is None:
                    return

                if action == "CONSENT_GRANTED":
                    await conn.execute(
                        """
                        UPDATE advisor_investor_relationships
                        SET
                          status = 'approved',
                          consent_granted_at = NOW(),
                          revoked_at = NULL,
                          updated_at = NOW()
                        WHERE id = $1
                        """,
                        relationship["id"],
                    )
                elif action == "REVOKED":
                    await conn.execute(
                        """
                        UPDATE advisor_investor_relationships
                        SET
                          status = 'revoked',
                          revoked_at = NOW(),
                          updated_at = NOW()
                        WHERE id = $1
                        """,
                        relationship["id"],
                    )
                elif action == "TIMEOUT":
                    await conn.execute(
                        """
                        UPDATE advisor_investor_relationships
                        SET
                          status = 'expired',
                          updated_at = NOW()
                        WHERE id = $1
                        """,
                        relationship["id"],
                    )
                else:
                    await conn.execute(
                        """
                        UPDATE advisor_investor_relationships
                        SET
                          status = 'discovered',
                          updated_at = NOW()
                        WHERE id = $1
                        """,
                        relationship["id"],
                    )
        except asyncpg.exceptions.UndefinedTableError:
            # Non-blocking path: consent lifecycle should not fail for investor flows.
            return
        finally:
            await conn.close()

    async def search_marketplace_rias(
        self,
        *,
        query: str | None,
        limit: int,
        firm: str | None,
        verification_status: str | None,
    ) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            limit_safe = max(1, min(limit, 50))
            rows = await conn.fetch(
                """
                SELECT
                  rp.id,
                  rp.user_id,
                  mp.display_name,
                  mp.headline,
                  mp.strategy_summary,
                  rp.verification_status,
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'firm_id', f.id,
                        'legal_name', f.legal_name,
                        'role_title', m.role_title,
                        'is_primary', m.is_primary
                      )
                    ) FILTER (WHERE f.id IS NOT NULL),
                    '[]'::json
                  ) AS firms
                FROM ria_profiles rp
                JOIN marketplace_public_profiles mp
                  ON mp.user_id = rp.user_id
                  AND mp.profile_type = 'ria'
                  AND mp.is_discoverable = TRUE
                LEFT JOIN ria_firm_memberships m
                  ON m.ria_profile_id = rp.id
                  AND m.membership_status = 'active'
                LEFT JOIN ria_firms f
                  ON f.id = m.firm_id
                WHERE
                  ($1::text IS NULL OR mp.display_name ILIKE ('%' || $1 || '%'))
                  AND ($2::text IS NULL OR rp.verification_status = $2)
                  AND (
                    $3::text IS NULL
                    OR EXISTS (
                      SELECT 1
                      FROM ria_firm_memberships m2
                      JOIN ria_firms f2 ON f2.id = m2.firm_id
                      WHERE m2.ria_profile_id = rp.id
                        AND m2.membership_status = 'active'
                        AND f2.legal_name ILIKE ('%' || $3 || '%')
                    )
                  )
                GROUP BY rp.id, rp.user_id, mp.display_name, mp.headline, mp.strategy_summary, rp.verification_status
                ORDER BY
                  CASE WHEN rp.verification_status IN ('active', 'finra_verified') THEN 0 ELSE 1 END,
                  mp.display_name ASC
                LIMIT $4
                """,
                (query or "").strip() or None,
                (verification_status or "").strip() or None,
                (firm or "").strip() or None,
                limit_safe,
            )
            return [dict(row) for row in rows]
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def get_marketplace_ria_profile(self, ria_id: str) -> dict[str, Any] | None:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            row = await conn.fetchrow(
                """
                SELECT
                  rp.id,
                  rp.user_id,
                  mp.display_name,
                  mp.headline,
                  mp.strategy_summary,
                  rp.verification_status,
                  rp.bio,
                  rp.strategy,
                  rp.disclosures_url,
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'firm_id', f.id,
                        'legal_name', f.legal_name,
                        'role_title', m.role_title,
                        'is_primary', m.is_primary
                      )
                    ) FILTER (WHERE f.id IS NOT NULL),
                    '[]'::json
                  ) AS firms
                FROM ria_profiles rp
                JOIN marketplace_public_profiles mp
                  ON mp.user_id = rp.user_id
                  AND mp.profile_type = 'ria'
                  AND mp.is_discoverable = TRUE
                LEFT JOIN ria_firm_memberships m
                  ON m.ria_profile_id = rp.id
                  AND m.membership_status = 'active'
                LEFT JOIN ria_firms f
                  ON f.id = m.firm_id
                WHERE rp.id = $1::uuid
                GROUP BY rp.id, rp.user_id, mp.display_name, mp.headline, mp.strategy_summary, rp.verification_status, rp.bio, rp.strategy, rp.disclosures_url
                """,
                ria_id,
            )
            return dict(row) if row else None
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()

    async def search_marketplace_investors(
        self,
        *,
        query: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        conn = await self._conn()
        try:
            await self._ensure_iam_schema_ready(conn)
            limit_safe = max(1, min(limit, 50))
            rows = await conn.fetch(
                """
                SELECT
                  ap.user_id,
                  mp.display_name,
                  mp.headline,
                  mp.location_hint,
                  mp.strategy_summary
                FROM actor_profiles ap
                JOIN marketplace_public_profiles mp
                  ON mp.user_id = ap.user_id
                  AND mp.profile_type = 'investor'
                  AND mp.is_discoverable = TRUE
                WHERE
                  ap.investor_marketplace_opt_in = TRUE
                  AND ($1::text IS NULL OR mp.display_name ILIKE ('%' || $1 || '%'))
                ORDER BY mp.display_name ASC
                LIMIT $2
                """,
                (query or "").strip() or None,
                limit_safe,
            )
            return [dict(row) for row in rows]
        except asyncpg.exceptions.UndefinedTableError as exc:
            raise IAMSchemaNotReadyError() from exc
        finally:
            await conn.close()
