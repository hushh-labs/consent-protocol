# consent-protocol/hushh_mcp/consent/scope_generator.py
"""
Dynamic Scope Generator - Generates and validates consent scopes dynamically.

Scopes support nested paths:
- attr.{domain}.{attribute_key}
- attr.{domain}.*
- attr.{domain}.{subintent}.*
"""

import logging
from typing import Optional

from db.db_client import get_db

logger = logging.getLogger(__name__)


class DynamicScopeGenerator:
    """
    Generates and validates consent scopes dynamically based on stored attributes.

    Scope Format:
    - Specific: attr.{domain}.{attribute_key}
    - Wildcard: attr.{domain}.*
    - Domain-level: attr.{domain}

    Examples:
    - attr.financial.holdings
    - attr.subscriptions.netflix_plan
    - attr.health.*
    """

    SCOPE_PREFIX = "attr."
    WILDCARD_SUFFIX = ".*"

    def __init__(self):
        self._supabase = None
        self._scope_cache: dict[str, set[str]] = {}  # user_id -> set of scopes
        self._cache_ttl = 300  # 5 minutes

    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase

    def generate_scope(self, domain: str, attribute_key: str) -> str:
        """
        Generate a scope string for a specific attribute.

        Args:
            domain: The domain key (e.g., 'financial')
            attribute_key: The attribute key (e.g., 'holdings')

        Returns:
            Scope string (e.g., 'attr.financial.holdings')
        """
        domain = domain.lower().strip()
        attribute_key = attribute_key.lower().strip()
        return f"{self.SCOPE_PREFIX}{domain}.{attribute_key}"

    def generate_domain_wildcard(self, domain: str) -> str:
        """
        Generate a wildcard scope for an entire domain.

        Args:
            domain: The domain key (e.g., 'financial')

        Returns:
            Wildcard scope string (e.g., 'attr.financial.*')
        """
        domain = domain.lower().strip()
        return f"{self.SCOPE_PREFIX}{domain}{self.WILDCARD_SUFFIX}"

    def parse_scope(self, scope: str) -> tuple[Optional[str], Optional[str], bool]:
        """
        Parse a scope string into its components.

        Args:
            scope: The scope string to parse

        Returns:
            Tuple of (domain, attribute_key, is_wildcard)
            Returns (None, None, False) if invalid format
        """
        if not scope.startswith(self.SCOPE_PREFIX):
            return (None, None, False)

        remainder = scope[len(self.SCOPE_PREFIX) :].strip()
        if not remainder:
            return (None, None, False)

        parts = [part for part in remainder.split(".") if part]
        if not parts:
            return (None, None, False)

        domain = self._normalize_domain_key(parts[0])
        if not domain:
            return (None, None, False)

        if len(parts) == 1:
            # Domain-level scope (e.g., attr.financial)
            return (domain, None, False)

        if parts[-1] == "*":
            if len(parts) == 2:
                # Domain wildcard (e.g., attr.financial.*)
                return (domain, None, True)
            # Subintent/attribute wildcard (e.g., attr.financial.profile.*)
            path = self._normalize_scope_path(".".join(parts[1:-1]))
            return (domain, path or None, True)

        # Specific path (e.g., attr.financial.profile.risk_score)
        path = self._normalize_scope_path(".".join(parts[1:]))
        return (domain, path or None, False)

    def is_dynamic_scope(self, scope: str) -> bool:
        """Check if a scope is a dynamic attr.* scope."""
        return scope.startswith(self.SCOPE_PREFIX)

    @staticmethod
    def _normalize_domain_key(domain: str | None) -> str:
        return str(domain or "").strip().lower()

    @staticmethod
    def _normalize_scope_path(path: str | None) -> str:
        if not isinstance(path, str):
            return ""
        raw = path.strip().lower()
        if not raw:
            return ""
        segments: list[str] = []
        for part in raw.split("."):
            normalized_part = "".join(
                ch if (ch.isalnum() or ch == "_") else "_" for ch in part.strip()
            ).strip("_")
            if normalized_part:
                segments.append(normalized_part)
        return ".".join(segments)

    @classmethod
    def _normalize_domains(cls, domains: list[str] | None) -> list[str]:
        if not domains:
            return []
        return sorted(
            {
                cls._normalize_domain_key(domain)
                for domain in domains
                if cls._normalize_domain_key(domain)
            }
        )

    async def _get_user_scope_catalog(self, user_id: str) -> dict[str, set[str]]:
        result = (
            self.supabase.table("world_model_index_v2")
            .select("available_domains", "domain_summaries")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {}

        row = result.data[0]
        available_domains = self._normalize_domains(row.get("available_domains") or [])
        domain_summaries = row.get("domain_summaries")
        if not isinstance(domain_summaries, dict):
            domain_summaries = {}

        catalog: dict[str, set[str]] = {domain: set() for domain in available_domains}

        for domain in available_domains:
            summary = domain_summaries.get(domain)
            if not isinstance(summary, dict):
                continue
            for key in (
                "intent_map",
                "sub_intents",
                "subintents",
                "available_subintents",
                "available_sub_intents",
            ):
                raw_value = summary.get(key)
                if isinstance(raw_value, list):
                    for item in raw_value:
                        normalized = self._normalize_scope_path(str(item))
                        if normalized:
                            catalog[domain].add(normalized)

        # Optional domain_registry enrichment. This supports installations where
        # subintent metadata is modeled in registry parent-child rows or fields.
        if available_domains:
            try:
                parent_rows = (
                    self.supabase.table("domain_registry")
                    .select("*")
                    .in_("domain_key", available_domains)
                    .execute()
                )
                child_rows = (
                    self.supabase.table("domain_registry")
                    .select("*")
                    .in_("parent_domain", available_domains)
                    .execute()
                )
                registry_rows = [*(parent_rows.data or []), *(child_rows.data or [])]
                for row in registry_rows:
                    if not isinstance(row, dict):
                        continue
                    domain_key = self._normalize_domain_key(row.get("domain_key"))
                    parent_domain = self._normalize_domain_key(row.get("parent_domain"))

                    # Child rows imply subintents for their parent domain.
                    if parent_domain and parent_domain in catalog and domain_key:
                        if domain_key.startswith(f"{parent_domain}."):
                            inferred = domain_key[len(parent_domain) + 1 :]
                        else:
                            inferred = domain_key
                        normalized_inferred = self._normalize_scope_path(inferred)
                        if normalized_inferred:
                            catalog[parent_domain].add(normalized_inferred)

                    source_domain = domain_key if domain_key in catalog else parent_domain
                    if source_domain and source_domain in catalog:
                        for key in (
                            "intent_map",
                            "sub_intents",
                            "subintents",
                            "available_subintents",
                            "available_sub_intents",
                        ):
                            value = row.get(key)
                            if isinstance(value, list):
                                for item in value:
                                    normalized = self._normalize_scope_path(str(item))
                                    if normalized:
                                        catalog[source_domain].add(normalized)
                            elif isinstance(value, str):
                                normalized = self._normalize_scope_path(value)
                                if normalized:
                                    catalog[source_domain].add(normalized)
            except Exception as e:
                logger.warning(
                    "scope_catalog.registry_lookup_failed user=%s error=%s",
                    user_id,
                    e,
                )

        return catalog

    def matches_wildcard(self, scope: str, wildcard: str) -> bool:
        """
        Check if a specific scope matches a wildcard pattern.

        Args:
            scope: The specific scope (e.g., 'attr.financial.holdings')
            wildcard: The wildcard pattern (e.g., 'attr.financial.*')

        Returns:
            True if the scope matches the wildcard
        """
        granted_domain, granted_path, granted_wildcard = self.parse_scope(wildcard)
        requested_domain, requested_path, _requested_wildcard = self.parse_scope(scope)

        if granted_domain is None or requested_domain is None:
            return scope == wildcard
        if granted_domain != requested_domain:
            return False

        if not granted_wildcard:
            return scope == wildcard

        # attr.{domain}.* grants everything under that domain.
        if granted_path is None:
            return True

        # attr.{domain}.{subintent}.* grants everything under that subintent path.
        if requested_path is None:
            return False
        return requested_path == granted_path or requested_path.startswith(f"{granted_path}.")

    async def validate_scope(self, scope: str, user_id: Optional[str] = None) -> bool:
        """
        Validate that a scope is valid.

        Validates against user metadata from world_model_index_v2 plus optional
        domain_registry subintent metadata.

        Args:
            scope: The scope to validate
            user_id: Optional user ID to check against stored data

        Returns:
            True if the scope is valid
        """
        domain, _attribute_key, _is_wildcard = self.parse_scope(scope)

        if domain is None:
            return False
        domain = self._normalize_domain_key(domain)
        if not domain:
            return False

        # If no user_id, just validate format
        if user_id is None:
            return True

        try:
            scope_catalog = await self._get_user_scope_catalog(user_id)
            if not scope_catalog:
                logger.debug(f"No world model index for user {user_id}")
                return False

            domain_subintents = scope_catalog.get(domain)
            if domain_subintents is None:
                return False

            # Domain-level scope is valid when domain exists.
            if _attribute_key is None:
                return True

            # If no subintent metadata exists, remain permissive for attribute paths.
            if not domain_subintents:
                return True

            candidate_path = self._normalize_scope_path(_attribute_key)
            if not candidate_path:
                return True

            for subintent in domain_subintents:
                if candidate_path == subintent or candidate_path.startswith(f"{subintent}."):
                    return True

            # Backward compatibility for direct domain-root attributes.
            return "." not in candidate_path
        except Exception as e:
            logger.error(f"Error validating scope {scope}: {e}")
            return False

    async def get_available_scopes(self, user_id: str) -> list[str]:
        """
        Get all valid wildcard scopes for a user from world_model_index_v2.

        Returns wildcard scopes for domains and known subintent paths when available:
        - attr.{domain}.*
        - attr.{domain}.{subintent}.*

        Args:
            user_id: The user ID

        Returns:
            List of wildcard scope strings
        """
        try:
            scope_catalog = await self._get_user_scope_catalog(user_id)
            scopes: set[str] = set()
            for domain, subintents in scope_catalog.items():
                scopes.add(self.generate_domain_wildcard(domain))
                for subintent in sorted(subintents):
                    scopes.add(self.generate_domain_wildcard(f"{domain}.{subintent}"))
            return sorted(scopes)
        except Exception as e:
            logger.error(f"Error getting available scopes for {user_id}: {e}")
            return []

    async def get_available_wildcards(self, user_id: str) -> list[str]:
        """
        Get all valid wildcard scopes for a user from world_model_index_v2.

        Args:
            user_id: The user ID

        Returns:
            List of wildcard scope strings
        """
        return await self.get_available_scopes(user_id)

    async def check_scope_access(
        self,
        requested_scope: str,
        granted_scopes: list[str],
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Check if a requested scope is covered by granted scopes.

        Args:
            requested_scope: The scope being requested
            granted_scopes: List of scopes that have been granted
            user_id: Optional user ID for validation

        Returns:
            True if access should be granted
        """
        # Direct match
        if requested_scope in granted_scopes:
            return True

        # Check wildcard matches
        for granted in granted_scopes:
            if self.matches_wildcard(requested_scope, granted):
                return True

        # Check if vault.owner is granted (full access)
        if "vault.owner" in granted_scopes:
            return True

        return False

    async def expand_wildcard(self, wildcard: str, user_id: str) -> list[str]:
        """
        Expand a wildcard scope into specific scopes for a user.

        world_model_index_v2 does not store per-attribute keys, so we return
        the wildcard itself as the only scope.

        Args:
            wildcard: The wildcard scope (e.g., 'attr.financial.*')
            user_id: The user ID (unused; kept for API compatibility)

        Returns:
            List containing the wildcard (no per-attribute expansion)
        """
        _ = user_id
        domain, _, is_wildcard = self.parse_scope(wildcard)
        if not is_wildcard or domain is None:
            return [wildcard]
        return [wildcard]

    def get_scope_display_info(self, scope: str) -> dict:
        """
        Get display information for a scope.

        Args:
            scope: The scope string

        Returns:
            Dict with display_name, domain, attribute, is_wildcard
        """
        domain, attribute_key, is_wildcard = self.parse_scope(scope)

        if domain is None:
            return {
                "display_name": scope,
                "domain": None,
                "attribute": None,
                "is_wildcard": False,
            }

        if is_wildcard:
            display_name = f"All {domain.title()} Data"
        elif attribute_key:
            display_name = f"{domain.title()} - {attribute_key.replace('_', ' ').title()}"
        else:
            display_name = f"{domain.title()} Domain"

        return {
            "display_name": display_name,
            "domain": domain,
            "attribute": attribute_key,
            "is_wildcard": is_wildcard,
        }


# Singleton instance
_scope_generator: Optional[DynamicScopeGenerator] = None


def get_scope_generator() -> DynamicScopeGenerator:
    """Get singleton DynamicScopeGenerator instance."""
    global _scope_generator
    if _scope_generator is None:
        _scope_generator = DynamicScopeGenerator()
    return _scope_generator
