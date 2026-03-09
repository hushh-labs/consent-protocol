from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import asyncpg

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
    ) -> dict[str, Any]:
        safe_personas = [persona for persona in personas if persona in _ALLOWED_PERSONAS]
        if not safe_personas:
            safe_personas = ["investor"]
        safe_last = (
            last_active_persona if last_active_persona in safe_personas else safe_personas[0]
        )
        return {
            "user_id": user_id,
            "personas": safe_personas,
            "last_active_persona": safe_last,
            "investor_marketplace_opt_in": bool(investor_marketplace_opt_in),
            "iam_schema_ready": iam_schema_ready,
            "mode": mode,
        }

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
                    )

                row = await self._ensure_actor_profile_row(conn, user_id)
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
                    )
                row = await conn.fetchrow(
                    """
                    INSERT INTO actor_profiles (
                        user_id,
                        personas,
                        last_active_persona,
                        investor_marketplace_opt_in
                    )
                    VALUES ($1, ARRAY[$2]::text[], $2, FALSE)
                    ON CONFLICT (user_id) DO UPDATE
                    SET
                      personas = CASE
                        WHEN $2 = ANY(actor_profiles.personas) THEN actor_profiles.personas
                        ELSE array_append(actor_profiles.personas, $2)
                      END,
                      last_active_persona = $2,
                      updated_at = NOW()
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
            rows = await conn.fetch(
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
                  mp.headline AS investor_headline
                FROM ria_profiles rp
                JOIN advisor_investor_relationships rel ON rel.ria_profile_id = rp.id
                LEFT JOIN marketplace_public_profiles mp
                  ON mp.user_id = rel.investor_user_id AND mp.profile_type = 'investor'
                WHERE rp.user_id = $1
                ORDER BY rel.updated_at DESC
                """,
                user_id,
            )
            return [dict(row) for row in rows]
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
                  request_id,
                  user_id,
                  scope,
                  action,
                  issued_at,
                  expires_at,
                  metadata
                FROM consent_audit
                WHERE agent_id = $1
                  AND request_id IS NOT NULL
                  AND action IN ('REQUESTED', 'CONSENT_GRANTED', 'CONSENT_DENIED', 'CANCELLED', 'REVOKED', 'TIMEOUT')
                ORDER BY issued_at DESC
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
                SELECT id, status, granted_scope, last_request_id, consent_granted_at, revoked_at
                FROM advisor_investor_relationships
                WHERE investor_user_id = $1
                  AND ria_profile_id = $2
                ORDER BY updated_at DESC
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
                    "relationship_status": relationship["status"],
                    "scope": relationship["granted_scope"],
                }

            return {
                "investor_user_id": investor_user_id,
                "workspace_ready": True,
                "available_domains": list(metadata["available_domains"] or []),
                "domain_summaries": dict(metadata["domain_summaries"] or {}),
                "total_attributes": int(metadata["total_attributes"] or 0),
                "updated_at": metadata["updated_at"],
                "relationship_status": relationship["status"],
                "scope": relationship["granted_scope"],
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
