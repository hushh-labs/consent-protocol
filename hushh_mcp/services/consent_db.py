# hushh_mcp/services/consent_db.py
"""
Consent Database Service
========================

Service layer for consent-related database operations.

CONSENT-FIRST ARCHITECTURE:
    All consent operations go through this service.
    Provides methods for pending requests, active tokens, and audit logs.

Usage:
    from hushh_mcp.services.consent_db import ConsentDBService

    service = ConsentDBService()

    # Get pending requests
    pending = await service.get_pending_requests(user_id)

    # Get active tokens
    active = await service.get_active_tokens(user_id)

    # Insert consent event
    event_id = await service.insert_event(
        user_id=user_id,
        agent_id=agent_id,
        scope=scope,
        action="CONSENT_GRANTED",
        consent_token=token
    )
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from db.db_client import get_db

logger = logging.getLogger(__name__)


class ConsentDBService:
    """
    Service layer for consent database operations.

    All consent-related database queries go through this service.
    """

    def __init__(self):
        self._supabase = None

    def _get_supabase(self):
        """Get database client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase

    # =========================================================================
    # Pending Requests
    # =========================================================================

    async def get_pending_requests(self, user_id: str) -> List[Dict]:
        """
        Get pending consent requests for a user.
        A request is pending if it has REQUESTED action with no resolution.

        Note: This uses Python post-processing to handle DISTINCT ON logic
        since Supabase REST API doesn't support complex SQL.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)

        # Fetch all relevant rows (we'll filter in Python)
        # Note: Cannot use .neq("request_id", None) - SQL "!= NULL" is always NULL (not true)
        # Instead, fetch all rows and filter request_id IS NOT NULL in Python
        response = (
            supabase.table("consent_audit")
            .select("*")
            .eq("user_id", user_id)
            .order("issued_at", desc=True)
            .execute()
        )

        # Post-process to get latest per request_id (DISTINCT ON equivalent)
        latest_per_request = {}
        for row in response.data:
            request_id = row.get("request_id")
            if not request_id:
                continue

            # Keep only the latest entry per request_id
            if request_id not in latest_per_request:
                latest_per_request[request_id] = row
            else:
                # Compare issued_at timestamps
                current_issued = latest_per_request[request_id].get("issued_at", 0)
                new_issued = row.get("issued_at", 0)
                if new_issued > current_issued:
                    latest_per_request[request_id] = row

        # Filter to only REQUESTED actions that haven't timed out
        results = []
        for row in latest_per_request.values():
            if row.get("action") == "REQUESTED":
                poll_timeout_at = row.get("poll_timeout_at")
                if poll_timeout_at is None or poll_timeout_at > now_ms:
                    # Extract expiryHours from metadata JSON
                    metadata = row.get("metadata") or {}
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata) if metadata else {}
                        except json.JSONDecodeError:
                            metadata = {}
                    expiry_hours = metadata.get("expiry_hours", 24)

                    results.append(
                        {
                            "id": row.get("request_id"),
                            "developer": row.get("agent_id"),
                            "scope": row.get("scope"),
                            "scopeDescription": row.get("scope_description"),
                            "requestedAt": row.get("issued_at"),
                            "pollTimeoutAt": poll_timeout_at,
                            "expiryHours": expiry_hours,
                        }
                    )

        # Sort by issued_at descending
        results.sort(key=lambda x: x.get("requestedAt", 0), reverse=True)

        return results

    async def get_pending_by_request_id(self, user_id: str, request_id: str) -> Optional[Dict]:
        """Get a specific pending request by request_id."""
        supabase = self._get_supabase()

        response = (
            supabase.table("consent_audit")
            .select("*")
            .eq("user_id", user_id)
            .eq("request_id", request_id)
            .order("issued_at", desc=True)
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            row = response.data[0]
            if row.get("action") == "REQUESTED":
                metadata = row.get("metadata") or {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata) if metadata else {}
                    except json.JSONDecodeError:
                        metadata = {}
                return {
                    "request_id": row.get("request_id"),
                    "developer": row.get("agent_id"),
                    "scope": row.get("scope"),
                    "scope_description": row.get("scope_description"),
                    "poll_timeout_at": row.get("poll_timeout_at"),
                    "issued_at": row.get("issued_at"),
                    "metadata": metadata,
                }
        return None

    # =========================================================================
    # Active Tokens
    # =========================================================================

    async def get_active_tokens(
        self,
        user_id: str,
        agent_id: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> List[Dict]:
        """
        Get active consent tokens for a user.
        Active = CONSENT_GRANTED with no subsequent REVOKED and not expired.

        Note: Uses Python post-processing to handle DISTINCT ON logic.
        Uniqueness is keyed by (agent_id, scope), not just scope.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)

        # Fetch all CONSENT_GRANTED and REVOKED actions
        response = (
            supabase.table("consent_audit")
            .select("*")
            .eq("user_id", user_id)
            .in_("action", ["CONSENT_GRANTED", "REVOKED"])
            .order("issued_at", desc=True)
            .execute()
        )

        # Post-process to get latest per (agent_id, scope) (DISTINCT ON equivalent)
        latest_per_agent_scope = {}
        for row in response.data:
            row_scope = row.get("scope")
            row_agent_id = row.get("agent_id") or ""
            if not row_scope:
                continue

            if agent_id and row_agent_id != agent_id:
                continue
            if scope and row_scope != scope:
                continue

            key = (row_agent_id, row_scope)
            if key not in latest_per_agent_scope:
                latest_per_agent_scope[key] = row
                continue

            current_issued = latest_per_agent_scope[key].get("issued_at", 0)
            new_issued = row.get("issued_at", 0)
            if new_issued > current_issued:
                latest_per_agent_scope[key] = row

        # Filter to only active (CONSENT_GRANTED and not expired)
        results = []
        for row in latest_per_agent_scope.values():
            if row.get("action") == "CONSENT_GRANTED":
                expires_at = row.get("expires_at")
                if expires_at is None or expires_at > now_ms:
                    token_id = row.get("token_id")
                    results.append(
                        {
                            "id": token_id[:20] + "..."
                            if token_id and len(token_id) > 20
                            else str(row.get("id")),
                            "scope": row.get("scope"),
                            "developer": row.get("agent_id"),
                            "agent_id": row.get("agent_id"),
                            "issued_at": row.get("issued_at"),
                            "expires_at": expires_at,
                            "time_remaining_ms": (expires_at - now_ms) if expires_at else 0,
                            "request_id": row.get("request_id"),
                            "token_id": token_id,
                        }
                    )

        return results

    async def is_token_active(
        self, user_id: str, scope: str, agent_id: Optional[str] = None
    ) -> bool:
        """Check if there's an active token for user+scope (+agent_id when provided)."""
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)

        query = (
            supabase.table("consent_audit")
            .select("action,expires_at")
            .eq("user_id", user_id)
            .eq("scope", scope)
            .in_("action", ["CONSENT_GRANTED", "REVOKED"])
        )
        if agent_id:
            query = query.eq("agent_id", agent_id)

        response = query.order("issued_at", desc=True).limit(1).execute()

        if response.data and len(response.data) > 0:
            row = response.data[0]
            if row.get("action") == "CONSENT_GRANTED":
                expires_at = row.get("expires_at")
                return expires_at is None or expires_at > now_ms

        return False

    async def was_recently_denied(
        self, user_id: str, scope: str, cooldown_seconds: int = 60
    ) -> bool:
        """
        Check if consent was recently denied for user+scope.

        This prevents MCP from immediately re-requesting after a denial,
        which would cause duplicate toast notifications.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)
        cooldown_ms = cooldown_seconds * 1000
        cutoff_ms = now_ms - cooldown_ms

        response = (
            supabase.table("consent_audit")
            .select("action,issued_at")
            .eq("user_id", user_id)
            .eq("scope", scope)
            .eq("action", "CONSENT_DENIED")
            .gt("issued_at", cutoff_ms)
            .order("issued_at", desc=True)
            .limit(1)
            .execute()
        )

        return len(response.data) > 0 if response.data else False

    # =========================================================================
    # Audit Log
    # =========================================================================

    async def get_audit_log(self, user_id: str, page: int = 1, limit: int = 50) -> Dict:
        """Get paginated audit log for a user."""
        supabase = self._get_supabase()
        offset = (page - 1) * limit
        now_ms = int(datetime.now().timestamp() * 1000)

        # Get paginated results (TableQuery uses .limit/.offset, not .range)
        response = (
            supabase.table("consent_audit")
            .select("*")
            .eq("user_id", user_id)
            .order("issued_at", desc=True)
            .limit(limit)
            .offset(offset)
            .execute()
        )

        # Get total count via separate query (capped at 5000 for display)
        count_response = (
            supabase.table("consent_audit")
            .select("id")
            .eq("user_id", user_id)
            .limit(5000)
            .execute()
        )
        total = len(count_response.data or [])

        items = []
        for row in response.data or []:
            # Parse metadata JSON if present
            metadata = None
            if row.get("metadata"):
                try:
                    metadata_str = row.get("metadata")
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str
                except (json.JSONDecodeError, TypeError):
                    metadata = None

            token_id = row.get("token_id")
            items.append(
                {
                    "id": str(row.get("id")),
                    "token_id": token_id[:20] + "..."
                    if token_id and len(token_id) > 20
                    else token_id or "N/A",
                    "agent_id": row.get("agent_id"),
                    "scope": row.get("scope"),
                    "action": row.get("action"),
                    "issued_at": row.get("issued_at"),
                    "expires_at": row.get("expires_at"),
                    "request_id": row.get("request_id"),
                    "scope_description": row.get("scope_description"),
                    "metadata": metadata,
                    # Detect timed out: REQUESTED with poll_timeout_at in the past
                    "is_timed_out": row.get("action") == "REQUESTED"
                    and row.get("poll_timeout_at")
                    and row.get("poll_timeout_at") < now_ms,
                }
            )

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
        }

    # =========================================================================
    # Event Insertion
    # =========================================================================

    async def insert_event(
        self,
        user_id: str,
        agent_id: str,
        scope: str,
        action: str,
        token_id: Optional[str] = None,
        request_id: Optional[str] = None,
        scope_description: Optional[str] = None,
        expires_at: Optional[int] = None,
        poll_timeout_at: Optional[int] = None,
        metadata: Optional[Dict] = None,
    ) -> int:
        """
        Insert a consent event into consent_audit table.

        Uses event-sourcing pattern - all actions (REQUESTED, GRANTED, DENIED, REVOKED)
        are separate events. The latest event per scope determines current state.

        Returns the event ID.
        """
        supabase = self._get_supabase()

        issued_at = int(datetime.now().timestamp() * 1000)
        token_id = token_id or f"evt_{issued_at}"

        # Prepare metadata as JSON string
        metadata_json = json.dumps(metadata) if metadata else None

        data = {
            "token_id": token_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "scope": scope,
            "action": action,
            "request_id": request_id,
            "scope_description": scope_description,
            "issued_at": issued_at,
            "expires_at": expires_at,
            "poll_timeout_at": poll_timeout_at,
            "metadata": metadata_json,
        }

        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        response = supabase.table("consent_audit").insert(data).execute()

        # Extract event ID from response
        if response.data and len(response.data) > 0:
            event_id = response.data[0].get("id")
            logger.info(f"Inserted {action} event: {event_id}")
            return event_id
        else:
            # Fallback: return issued_at as ID if response doesn't have id
            logger.warning(
                f"Inserted {action} event but no ID returned, using issued_at: {issued_at}"
            )
            return issued_at

    async def get_timed_out_requests(self) -> List[Dict]:
        """
        Return REQUESTED rows that have passed poll_timeout_at and do not yet have a TIMEOUT event.
        Used by the optional timeout job to emit TIMEOUT events over SSE.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)
        # poll_timeout_at < now_ms excludes null (SQL: null < x is false)
        response = (
            supabase.table("consent_audit")
            .select("request_id, user_id, scope, agent_id, scope_description, issued_at")
            .eq("action", "REQUESTED")
            .lt("poll_timeout_at", now_ms)
            .execute()
        )
        if not response.data:
            return []
        # Dedupe by request_id (keep latest by issued_at)
        by_req: Dict[str, Dict] = {}
        for row in response.data:
            rid = row.get("request_id")
            if not rid:
                continue
            if rid not in by_req or (row.get("issued_at") or 0) > (
                by_req[rid].get("issued_at") or 0
            ):
                by_req[rid] = row
        request_ids = list(by_req.keys())
        if not request_ids:
            return []
        # Which of these already have a TIMEOUT?
        timeout_resp = (
            supabase.table("consent_audit")
            .select("request_id")
            .eq("action", "TIMEOUT")
            .in_("request_id", request_ids)
            .execute()
        )
        already = {r.get("request_id") for r in (timeout_resp.data or []) if r.get("request_id")}
        return [by_req[rid] for rid in request_ids if rid not in already]

    async def emit_timeout_events(self) -> int:
        """
        Find REQUESTED rows that have timed out, insert TIMEOUT events (triggers NOTIFY → SSE).
        Returns the number of TIMEOUT events inserted.
        """
        rows = await self.get_timed_out_requests()
        count = 0
        for row in rows:
            try:
                await self.insert_event(
                    user_id=row["user_id"],
                    agent_id=row.get("agent_id") or "system",
                    scope=row.get("scope") or "",
                    action="TIMEOUT",
                    request_id=row.get("request_id"),
                    scope_description=row.get("scope_description"),
                )
                count += 1
            except Exception as e:
                logger.warning(
                    "Emit TIMEOUT event failed for request_id=%s: %s", row.get("request_id"), e
                )
        return count

    async def log_operation(
        self,
        user_id: str,
        operation: str,
        target: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> int:
        """
        Log an operation performed using vault.owner token.

        This provides granular audit logging for vault owner operations,
        showing WHAT operation was performed (e.g., kai.analyze) and
        on WHAT target (e.g., AAPL ticker).

        Args:
            user_id: The user performing the operation
            operation: The operation type (e.g., "kai.analyze", "kai.preferences.read")
            target: Optional target of the operation (e.g., "AAPL" for ticker analysis)
            metadata: Additional context to store

        Returns:
            The event ID
        """
        operation_metadata = {
            "operation": operation,
            **({"target": target} if target else {}),
            **(metadata or {}),
        }

        return await self.insert_event(
            user_id=user_id,
            agent_id="self",
            scope="vault.owner",
            action="OPERATION_PERFORMED",
            scope_description=operation,
            metadata=operation_metadata,
        )

    # =========================================================================
    # SSE Event Helpers
    # =========================================================================

    async def get_recent_consent_events(
        self, user_id: str, after_timestamp_ms: int, limit: int = 10
    ) -> List[Dict]:
        """
        Get recent consent events after a timestamp for SSE streaming.

        Args:
            user_id: The user ID
            after_timestamp_ms: Only get events after this timestamp (ms)
            limit: Maximum events to return

        Returns:
            List of consent events
        """
        supabase = self._get_supabase()

        response = (
            supabase.table("consent_audit")
            .select("token_id,request_id,action,scope,agent_id,issued_at")
            .eq("user_id", user_id)
            .in_("action", ["REQUESTED", "CONSENT_GRANTED", "CONSENT_DENIED", "REVOKED"])
            .gt("issued_at", after_timestamp_ms)
            .order("issued_at", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data or []

    async def get_resolved_request(self, user_id: str, request_id: str) -> Optional[Dict]:
        """
        Check if a specific consent request has been resolved.

        Args:
            user_id: The user ID
            request_id: The request ID to check

        Returns:
            Resolution event if found, None otherwise
        """
        supabase = self._get_supabase()

        response = (
            supabase.table("consent_audit")
            .select("action,scope,agent_id,issued_at")
            .eq("user_id", user_id)
            .eq("request_id", request_id)
            .in_("action", ["CONSENT_GRANTED", "CONSENT_DENIED"])
            .order("issued_at", desc=True)
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]
        return None

    # =========================================================================
    # Consent Exports (MCP Zero-Knowledge Flow)
    # =========================================================================

    async def store_consent_export(
        self,
        consent_token: str,
        user_id: str,
        encrypted_data: str,
        iv: str,
        tag: str,
        export_key: str,
        scope: str,
        expires_at_ms: int,
    ) -> bool:
        """
        Store encrypted export data for MCP zero-knowledge flow.

        This persists the encrypted data to the database so it survives
        server restarts and is available across all instances.

        Args:
            consent_token: The consent token this export is for
            user_id: The user ID
            encrypted_data: Base64-encoded ciphertext
            iv: Base64-encoded initialization vector
            tag: Base64-encoded authentication tag
            export_key: Hex-encoded AES-256 key for MCP decryption
            scope: The scope this export is for
            expires_at_ms: Expiry timestamp in milliseconds

        Returns:
            True if stored successfully, False otherwise
        """
        supabase = self._get_supabase()

        # Convert ms timestamp to ISO format for Supabase
        from datetime import datetime, timezone

        expires_at = datetime.fromtimestamp(expires_at_ms / 1000, tz=timezone.utc).isoformat()

        try:
            # Upsert to handle re-approvals
            supabase.table("consent_exports").upsert(
                {
                    "consent_token": consent_token,
                    "user_id": user_id,
                    "encrypted_data": encrypted_data,
                    "iv": iv,
                    "tag": tag,
                    "export_key": export_key,
                    "scope": scope,
                    "expires_at": expires_at,
                },
                on_conflict="consent_token",
            ).execute()

            logger.info(f"Stored consent export for token: {consent_token[:30]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to store consent export: {e}")
            return False

    async def get_consent_export(self, consent_token: str) -> Optional[Dict]:
        """
        Retrieve encrypted export data for a consent token.

        Args:
            consent_token: The consent token to look up

        Returns:
            Export data dict if found and not expired, None otherwise
        """
        supabase = self._get_supabase()

        try:
            response = (
                supabase.table("consent_exports")
                .select("*")
                .eq("consent_token", consent_token)
                .gt("expires_at", datetime.now(timezone.utc).isoformat())
                .limit(1)
                .execute()
            )

            if response.data and len(response.data) > 0:
                row = response.data[0]
                return {
                    "encrypted_data": row.get("encrypted_data"),
                    "iv": row.get("iv"),
                    "tag": row.get("tag"),
                    "export_key": row.get("export_key"),
                    "scope": row.get("scope"),
                    "created_at": row.get("created_at"),
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get consent export: {e}")
            return None

    async def delete_consent_export(self, consent_token: str) -> bool:
        """
        Delete a consent export (e.g., when consent is revoked).

        Args:
            consent_token: The consent token to delete export for

        Returns:
            True if deleted, False otherwise
        """
        supabase = self._get_supabase()

        try:
            supabase.table("consent_exports").delete().eq("consent_token", consent_token).execute()

            logger.info(f"Deleted consent export for token: {consent_token[:30]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to delete consent export: {e}")
            return False

    async def cleanup_expired_exports(self) -> int:
        """
        Clean up expired consent exports.

        Returns:
            Number of exports deleted
        """
        supabase = self._get_supabase()

        try:
            # Call the cleanup function
            response = supabase.rpc("cleanup_expired_consent_exports").execute()

            if response.data is not None:
                deleted_count = response.data
                logger.info(f"Cleaned up {deleted_count} expired consent exports")
                return deleted_count
            return 0
        except Exception as e:
            logger.error(f"Failed to cleanup expired exports: {e}")
            return 0
