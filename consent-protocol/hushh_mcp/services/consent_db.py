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
from datetime import datetime
from typing import Dict, List, Optional

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)


class ConsentDBService:
    """
    Service layer for consent database operations.
    
    All consent-related database queries go through this service.
    """
    
    def __init__(self):
        self._supabase = None
    
    def _get_supabase(self):
        """Get Supabase client (private - ONLY for internal service use)."""
        if self._supabase is None:
            self._supabase = get_supabase()
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
        response = supabase.table("consent_audit")\
            .select("*")\
            .eq("user_id", user_id)\
            .not_.is_("request_id", "null")\
            .order("issued_at", desc=True)\
            .execute()
        
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
                    
                    results.append({
                        "id": row.get("request_id"),
                        "developer": row.get("agent_id"),
                        "scope": row.get("scope"),
                        "scopeDescription": row.get("scope_description"),
                        "requestedAt": row.get("issued_at"),
                        "pollTimeoutAt": poll_timeout_at,
                        "expiryHours": expiry_hours,
                    })
        
        # Sort by issued_at descending
        results.sort(key=lambda x: x.get("requestedAt", 0), reverse=True)
        
        return results
    
    async def get_pending_by_request_id(self, user_id: str, request_id: str) -> Optional[Dict]:
        """Get a specific pending request by request_id."""
        supabase = self._get_supabase()
        
        response = supabase.table("consent_audit")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("request_id", request_id)\
            .order("issued_at", desc=True)\
            .limit(1)\
            .execute()
        
        if response.data and len(response.data) > 0:
            row = response.data[0]
            if row.get("action") == "REQUESTED":
                return {
                    "request_id": row.get("request_id"),
                    "developer": row.get("agent_id"),
                    "scope": row.get("scope"),
                    "scope_description": row.get("scope_description"),
                    "poll_timeout_at": row.get("poll_timeout_at"),
                    "issued_at": row.get("issued_at"),
                }
        return None
    
    # =========================================================================
    # Active Tokens
    # =========================================================================
    
    async def get_active_tokens(self, user_id: str) -> List[Dict]:
        """
        Get active consent tokens for a user.
        Active = CONSENT_GRANTED with no subsequent REVOKED and not expired.
        
        Note: Uses Python post-processing to handle DISTINCT ON logic.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)
        
        # Fetch all CONSENT_GRANTED and REVOKED actions
        response = supabase.table("consent_audit")\
            .select("*")\
            .eq("user_id", user_id)\
            .in_("action", ["CONSENT_GRANTED", "REVOKED"])\
            .order("issued_at", desc=True)\
            .execute()
        
        # Post-process to get latest per scope (DISTINCT ON equivalent)
        latest_per_scope = {}
        for row in response.data:
            scope = row.get("scope")
            if not scope:
                continue
            
            # Keep only the latest entry per scope
            if scope not in latest_per_scope:
                latest_per_scope[scope] = row
            else:
                # Compare issued_at timestamps
                current_issued = latest_per_scope[scope].get("issued_at", 0)
                new_issued = row.get("issued_at", 0)
                if new_issued > current_issued:
                    latest_per_scope[scope] = row
        
        # Filter to only active (CONSENT_GRANTED and not expired)
        results = []
        for row in latest_per_scope.values():
            if row.get("action") == "CONSENT_GRANTED":
                expires_at = row.get("expires_at")
                if expires_at is None or expires_at > now_ms:
                    token_id = row.get("token_id")
                    results.append({
                        "id": token_id[:20] + "..." if token_id and len(token_id) > 20 else str(row.get("id")),
                        "scope": row.get("scope"),
                        "developer": row.get("agent_id"),
                        "agent_id": row.get("agent_id"),
                        "issued_at": row.get("issued_at"),
                        "expires_at": expires_at,
                        "time_remaining_ms": (expires_at - now_ms) if expires_at else 0,
                        "request_id": row.get("request_id"),
                        "token_id": token_id,
                    })
        
        return results
    
    async def is_token_active(self, user_id: str, scope: str) -> bool:
        """Check if there's an active token for user+scope."""
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)
        
        response = supabase.table("consent_audit")\
            .select("action,expires_at")\
            .eq("user_id", user_id)\
            .eq("scope", scope)\
            .in_("action", ["CONSENT_GRANTED", "REVOKED"])\
            .order("issued_at", desc=True)\
            .limit(1)\
            .execute()
        
        if response.data and len(response.data) > 0:
            row = response.data[0]
            if row.get("action") == "CONSENT_GRANTED":
                expires_at = row.get("expires_at")
                return expires_at is None or expires_at > now_ms
        
        return False
    
    async def was_recently_denied(self, user_id: str, scope: str, cooldown_seconds: int = 60) -> bool:
        """
        Check if consent was recently denied for user+scope.
        
        This prevents MCP from immediately re-requesting after a denial,
        which would cause duplicate toast notifications.
        """
        supabase = self._get_supabase()
        now_ms = int(datetime.now().timestamp() * 1000)
        cooldown_ms = cooldown_seconds * 1000
        cutoff_ms = now_ms - cooldown_ms
        
        response = supabase.table("consent_audit")\
            .select("action,issued_at")\
            .eq("user_id", user_id)\
            .eq("scope", scope)\
            .eq("action", "CONSENT_DENIED")\
            .gt("issued_at", cutoff_ms)\
            .order("issued_at", desc=True)\
            .limit(1)\
            .execute()
        
        return len(response.data) > 0 if response.data else False
    
    # =========================================================================
    # Audit Log
    # =========================================================================
    
    async def get_audit_log(self, user_id: str, page: int = 1, limit: int = 50) -> Dict:
        """Get paginated audit log for a user."""
        supabase = self._get_supabase()
        offset = (page - 1) * limit
        now_ms = int(datetime.now().timestamp() * 1000)
        
        # Get paginated results with count
        response = supabase.table("consent_audit")\
            .select("*", count="exact")\
            .eq("user_id", user_id)\
            .order("issued_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        # Get total count
        total = 0
        if hasattr(response, 'count') and response.count is not None:
            total = response.count
        else:
            # Fallback: fetch count separately
            count_response = supabase.table("consent_audit")\
                .select("id", count="exact")\
                .eq("user_id", user_id)\
                .limit(0)\
                .execute()
            if hasattr(count_response, 'count') and count_response.count is not None:
                total = count_response.count
            else:
                # Last resort: count data length (not accurate for pagination)
                total = len(response.data) if response.data else 0
        
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
            items.append({
                "id": str(row.get("id")),
                "token_id": token_id[:20] + "..." if token_id and len(token_id) > 20 else token_id or "N/A",
                "agent_id": row.get("agent_id"),
                "scope": row.get("scope"),
                "action": row.get("action"),
                "issued_at": row.get("issued_at"),
                "expires_at": row.get("expires_at"),
                "request_id": row.get("request_id"),
                "scope_description": row.get("scope_description"),
                "metadata": metadata,
                # Detect timed out: REQUESTED with poll_timeout_at in the past
                "is_timed_out": row.get("action") == "REQUESTED" and row.get("poll_timeout_at") and row.get("poll_timeout_at") < now_ms,
            })
        
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
        metadata: Optional[Dict] = None
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
            "metadata": metadata_json
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
            logger.warning(f"Inserted {action} event but no ID returned, using issued_at: {issued_at}")
            return issued_at
    
    async def log_operation(
        self,
        user_id: str,
        operation: str,
        target: Optional[str] = None,
        metadata: Optional[Dict] = None
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
            **(metadata or {})
        }
        
        return await self.insert_event(
            user_id=user_id,
            agent_id="self",
            scope="vault.owner",
            action="OPERATION_PERFORMED",
            scope_description=operation,
            metadata=operation_metadata
        )
    
    # =========================================================================
    # SSE Event Helpers
    # =========================================================================
    
    async def get_recent_consent_events(
        self,
        user_id: str,
        after_timestamp_ms: int,
        limit: int = 10
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
        
        response = supabase.table("consent_audit")\
            .select("token_id,request_id,action,scope,agent_id,issued_at")\
            .eq("user_id", user_id)\
            .in_("action", ["REQUESTED", "CONSENT_GRANTED", "CONSENT_DENIED", "REVOKED"])\
            .gt("issued_at", after_timestamp_ms)\
            .order("issued_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return response.data or []
    
    async def get_resolved_request(
        self,
        user_id: str,
        request_id: str
    ) -> Optional[Dict]:
        """
        Check if a specific consent request has been resolved.
        
        Args:
            user_id: The user ID
            request_id: The request ID to check
            
        Returns:
            Resolution event if found, None otherwise
        """
        supabase = self._get_supabase()
        
        response = supabase.table("consent_audit")\
            .select("action,scope,agent_id,issued_at")\
            .eq("user_id", user_id)\
            .eq("request_id", request_id)\
            .in_("action", ["CONSENT_GRANTED", "CONSENT_DENIED"])\
            .order("issued_at", desc=True)\
            .limit(1)\
            .execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
