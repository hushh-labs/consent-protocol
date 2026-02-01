# consent-protocol/hushh_mcp/consent/scope_generator.py
"""
Dynamic Scope Generator - Generates and validates consent scopes dynamically.

Scopes follow the pattern: attr.{domain}.{attribute_key}
Supports wildcard patterns: attr.{domain}.*
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
        
        # Remove prefix
        remainder = scope[len(self.SCOPE_PREFIX):]
        
        # Check for wildcard
        if remainder.endswith(self.WILDCARD_SUFFIX):
            domain = remainder[:-len(self.WILDCARD_SUFFIX)]
            return (domain, None, True)
        
        # Split into domain and attribute
        parts = remainder.split(".", 1)
        if len(parts) == 1:
            # Domain-level scope (e.g., attr.financial)
            return (parts[0], None, False)
        
        return (parts[0], parts[1], False)
    
    def is_dynamic_scope(self, scope: str) -> bool:
        """Check if a scope is a dynamic attr.* scope."""
        return scope.startswith(self.SCOPE_PREFIX)
    
    def matches_wildcard(self, scope: str, wildcard: str) -> bool:
        """
        Check if a specific scope matches a wildcard pattern.
        
        Args:
            scope: The specific scope (e.g., 'attr.financial.holdings')
            wildcard: The wildcard pattern (e.g., 'attr.financial.*')
        
        Returns:
            True if the scope matches the wildcard
        """
        if not wildcard.endswith(self.WILDCARD_SUFFIX):
            return scope == wildcard
        
        # Get the prefix before the wildcard
        prefix = wildcard[:-len(self.WILDCARD_SUFFIX)]
        
        # Check if scope starts with the prefix
        return scope.startswith(prefix + ".")
    
    async def validate_scope(self, scope: str, user_id: Optional[str] = None) -> bool:
        """
        Validate that a scope is valid.
        
        For specific scopes, checks if the attribute exists for the user.
        For wildcards, checks if the domain has any attributes.
        
        Args:
            scope: The scope to validate
            user_id: Optional user ID to check against stored attributes
        
        Returns:
            True if the scope is valid
        """
        domain, attribute_key, is_wildcard = self.parse_scope(scope)
        
        if domain is None:
            return False
        
        # If no user_id, just validate format
        if user_id is None:
            return True
        
        try:
            if is_wildcard or attribute_key is None:
                # Check if user has any attributes in this domain
                result = self.supabase.table("world_model_attributes").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("domain", domain).limit(1).execute()
                return (result.count or 0) > 0
            else:
                # Check if specific attribute exists
                result = self.supabase.table("world_model_attributes").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("domain", domain).eq(
                    "attribute_key", attribute_key
                ).execute()
                return (result.count or 0) > 0
        except Exception as e:
            logger.error(f"Error validating scope {scope}: {e}")
            return False
    
    async def get_available_scopes(self, user_id: str) -> list[str]:
        """
        Get all valid scopes for a user based on stored attributes.
        
        Args:
            user_id: The user ID
        
        Returns:
            List of scope strings
        """
        try:
            result = self.supabase.table("world_model_attributes").select(
                "domain", "attribute_key"
            ).eq("user_id", user_id).execute()
            
            scopes = []
            for row in (result.data or []):
                scope = self.generate_scope(row["domain"], row["attribute_key"])
                scopes.append(scope)
            
            return sorted(scopes)
        except Exception as e:
            logger.error(f"Error getting available scopes for {user_id}: {e}")
            return []
    
    async def get_available_wildcards(self, user_id: str) -> list[str]:
        """
        Get all valid wildcard scopes for a user.
        
        Args:
            user_id: The user ID
        
        Returns:
            List of wildcard scope strings
        """
        try:
            result = self.supabase.table("world_model_attributes").select(
                "domain"
            ).eq("user_id", user_id).execute()
            
            # Get unique domains
            domains = set(row["domain"] for row in (result.data or []))
            
            return sorted([self.generate_domain_wildcard(d) for d in domains])
        except Exception as e:
            logger.error(f"Error getting available wildcards for {user_id}: {e}")
            return []
    
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
        
        Args:
            wildcard: The wildcard scope (e.g., 'attr.financial.*')
            user_id: The user ID
        
        Returns:
            List of specific scopes covered by the wildcard
        """
        domain, _, is_wildcard = self.parse_scope(wildcard)
        
        if not is_wildcard or domain is None:
            return [wildcard]
        
        try:
            result = self.supabase.table("world_model_attributes").select(
                "attribute_key"
            ).eq("user_id", user_id).eq("domain", domain).execute()
            
            return [
                self.generate_scope(domain, row["attribute_key"])
                for row in (result.data or [])
            ]
        except Exception as e:
            logger.error(f"Error expanding wildcard {wildcard}: {e}")
            return []
    
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
