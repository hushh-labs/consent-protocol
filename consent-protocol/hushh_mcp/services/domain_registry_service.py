# consent-protocol/hushh_mcp/services/domain_registry_service.py
"""
Domain Registry Service - Dynamic domain discovery and management.

This service manages the domain_registry table which tracks all domains
dynamically without hardcoded enums. Domains are auto-registered on first use.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from db.db_client import get_db

logger = logging.getLogger(__name__)


@dataclass
class DomainInfo:
    """Information about a registered domain."""
    domain_key: str
    display_name: str
    description: Optional[str] = None
    icon_name: str = "folder"
    color_hex: str = "#6B7280"
    parent_domain: Optional[str] = None
    attribute_count: int = 0
    user_count: int = 0
    first_seen_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None


# Default domain metadata for common domains
DEFAULT_DOMAIN_METADATA = {
    "financial": {
        "display_name": "Financial",
        "icon_name": "wallet",
        "color_hex": "#D4AF37",
        "description": "Investment portfolio, risk profile, and financial preferences",
    },
    "subscriptions": {
        "display_name": "Subscriptions",
        "icon_name": "credit-card",
        "color_hex": "#6366F1",
        "description": "Streaming services, memberships, and recurring payments",
    },
    "health": {
        "display_name": "Health & Wellness",
        "icon_name": "heart",
        "color_hex": "#EF4444",
        "description": "Fitness data, health metrics, and wellness preferences",
    },
    "travel": {
        "display_name": "Travel",
        "icon_name": "plane",
        "color_hex": "#0EA5E9",
        "description": "Travel preferences, loyalty programs, and trip history",
    },
    "food": {
        "display_name": "Food & Dining",
        "icon_name": "utensils",
        "color_hex": "#F97316",
        "description": "Dietary preferences, favorite cuisines, and restaurant history",
    },
    "professional": {
        "display_name": "Professional",
        "icon_name": "briefcase",
        "color_hex": "#8B5CF6",
        "description": "Career information, skills, and work preferences",
    },
    "entertainment": {
        "display_name": "Entertainment",
        "icon_name": "tv",
        "color_hex": "#EC4899",
        "description": "Movies, music, games, and media preferences",
    },
    "shopping": {
        "display_name": "Shopping",
        "icon_name": "shopping-bag",
        "color_hex": "#14B8A6",
        "description": "Purchase history, brand preferences, and wishlists",
    },
    "general": {
        "display_name": "General",
        "icon_name": "folder",
        "color_hex": "#6B7280",
        "description": "Miscellaneous preferences and attributes",
    },
}


class DomainRegistryService:
    """
    Service for managing dynamic domain discovery and registration.
    
    Domains are auto-registered on first use, with metadata inferred
    from the domain key or provided explicitly.
    """
    
    def __init__(self):
        self._supabase = None
        self._cache: dict[str, DomainInfo] = {}
        self._cache_ttl = 300  # 5 minutes
        self._cache_time: Optional[datetime] = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase
    
    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid."""
        if self._cache_time is None:
            return False
        elapsed = (datetime.utcnow() - self._cache_time).total_seconds()
        return elapsed < self._cache_ttl
    
    def _invalidate_cache(self):
        """Invalidate the domain cache."""
        self._cache.clear()
        self._cache_time = None
    
    async def register_domain(
        self,
        domain_key: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        icon_name: Optional[str] = None,
        color_hex: Optional[str] = None,
        parent_domain: Optional[str] = None,
    ) -> DomainInfo:
        """
        Register a new domain or return existing one.
        
        If the domain already exists, returns the existing info.
        If not, creates it with provided or inferred metadata.
        """
        # Normalize domain key
        domain_key = domain_key.lower().strip().replace(" ", "_")
        
        # Check cache first
        if domain_key in self._cache and self._is_cache_valid():
            return self._cache[domain_key]
        
        # Get default metadata if available
        defaults = DEFAULT_DOMAIN_METADATA.get(domain_key, {})
        
        # Build metadata with fallbacks
        final_display_name = display_name or defaults.get("display_name") or self._generate_display_name(domain_key)
        final_icon = icon_name or defaults.get("icon_name", "folder")
        final_color = color_hex or defaults.get("color_hex", "#6B7280")
        final_description = description or defaults.get("description")
        
        try:
            # Use RPC function for atomic upsert
            result = self.supabase.rpc(
                "auto_register_domain",
                {
                    "p_domain_key": domain_key,
                    "p_display_name": final_display_name,
                    "p_icon_name": final_icon,
                    "p_color_hex": final_color,
                }
            ).execute()
            
            if result.data:
                domain_info = DomainInfo(
                    domain_key=result.data.get("domain_key", domain_key),
                    display_name=result.data.get("display_name", final_display_name),
                    icon_name=result.data.get("icon_name", final_icon),
                    color_hex=result.data.get("color_hex", final_color),
                    description=final_description,
                    attribute_count=result.data.get("attribute_count", 0),
                    user_count=result.data.get("user_count", 0),
                )
                self._cache[domain_key] = domain_info
                self._cache_time = datetime.utcnow()
                return domain_info
        except Exception as e:
            logger.warning(f"RPC auto_register_domain failed, falling back to direct insert: {e}")
        
        # Fallback: Direct upsert
        try:
            data = {
                "domain_key": domain_key,
                "display_name": final_display_name,
                "icon_name": final_icon,
                "color_hex": final_color,
                "description": final_description,
                "parent_domain": parent_domain,
            }
            
            self.supabase.table("domain_registry").upsert(
                data,
                on_conflict="domain_key"
            ).execute()
            
            # Fetch the result
            result = self.supabase.table("domain_registry").select("*").eq(
                "domain_key", domain_key
            ).execute()
            
            if result.data:
                row = result.data[0]
                domain_info = self._row_to_domain_info(row)
                self._cache[domain_key] = domain_info
                self._cache_time = datetime.utcnow()
                return domain_info
        except Exception as e:
            logger.error(f"Error registering domain {domain_key}: {e}")
        
        # Return minimal info if all else fails
        return DomainInfo(
            domain_key=domain_key,
            display_name=final_display_name,
            icon_name=final_icon,
            color_hex=final_color,
        )
    
    async def get_domain(self, domain_key: str) -> Optional[DomainInfo]:
        """Get domain metadata by key."""
        domain_key = domain_key.lower().strip()
        
        # Check cache
        if domain_key in self._cache and self._is_cache_valid():
            return self._cache[domain_key]
        
        try:
            result = self.supabase.table("domain_registry").select("*").eq(
                "domain_key", domain_key
            ).execute()
            
            if not result.data:
                return None
            
            domain_info = self._row_to_domain_info(result.data[0])
            self._cache[domain_key] = domain_info
            return domain_info
        except Exception as e:
            logger.error(f"Error getting domain {domain_key}: {e}")
            return None
    
    async def list_domains(self, include_empty: bool = False) -> list[DomainInfo]:
        """
        List all registered domains.
        
        Args:
            include_empty: If True, include domains with no attributes
        """
        try:
            query = self.supabase.table("domain_registry").select("*").order("display_name")
            
            if not include_empty:
                query = query.gt("attribute_count", 0)
            
            result = query.execute()
            
            domains = [self._row_to_domain_info(row) for row in (result.data or [])]
            
            # Update cache
            for domain in domains:
                self._cache[domain.domain_key] = domain
            self._cache_time = datetime.utcnow()
            
            return domains
        except Exception as e:
            logger.error(f"Error listing domains: {e}")
            return []
    
    async def get_user_domains(self, user_id: str) -> list[DomainInfo]:
        """Get domains that have data for a specific user."""
        try:
            # Get distinct domains for user
            result = self.supabase.table("world_model_attributes").select(
                "domain"
            ).eq("user_id", user_id).execute()
            
            if not result.data:
                return []
            
            # Get unique domains
            domain_keys = list(set(row["domain"] for row in result.data))
            
            # Fetch domain info for each
            domains = []
            for key in domain_keys:
                domain_info = await self.get_domain(key)
                if domain_info:
                    # Get user-specific attribute count
                    count_result = self.supabase.table("world_model_attributes").select(
                        "id", count="exact"
                    ).eq("user_id", user_id).eq("domain", key).execute()
                    
                    domain_info.attribute_count = count_result.count or 0
                    domains.append(domain_info)
            
            return sorted(domains, key=lambda d: d.display_name)
        except Exception as e:
            logger.error(f"Error getting user domains for {user_id}: {e}")
            return []
    
    async def update_domain(
        self,
        domain_key: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        icon_name: Optional[str] = None,
        color_hex: Optional[str] = None,
    ) -> bool:
        """Update domain metadata."""
        try:
            data = {}
            if display_name is not None:
                data["display_name"] = display_name
            if description is not None:
                data["description"] = description
            if icon_name is not None:
                data["icon_name"] = icon_name
            if color_hex is not None:
                data["color_hex"] = color_hex
            
            if not data:
                return True
            
            self.supabase.table("domain_registry").update(data).eq(
                "domain_key", domain_key
            ).execute()
            
            # Invalidate cache
            self._invalidate_cache()
            return True
        except Exception as e:
            logger.error(f"Error updating domain {domain_key}: {e}")
            return False
    
    async def delete_domain(self, domain_key: str) -> bool:
        """
        Delete a domain from the registry.
        
        Note: This does NOT delete associated attributes.
        """
        try:
            self.supabase.table("domain_registry").delete().eq(
                "domain_key", domain_key
            ).execute()
            
            # Invalidate cache
            self._invalidate_cache()
            return True
        except Exception as e:
            logger.error(f"Error deleting domain {domain_key}: {e}")
            return False
    
    def _row_to_domain_info(self, row: dict) -> DomainInfo:
        """Convert database row to DomainInfo."""
        return DomainInfo(
            domain_key=row["domain_key"],
            display_name=row.get("display_name", row["domain_key"]),
            description=row.get("description"),
            icon_name=row.get("icon_name", "folder"),
            color_hex=row.get("color_hex", "#6B7280"),
            parent_domain=row.get("parent_domain"),
            attribute_count=row.get("attribute_count", 0),
            user_count=row.get("user_count", 0),
            first_seen_at=row.get("first_seen_at"),
            last_updated_at=row.get("last_updated_at"),
        )
    
    def _generate_display_name(self, domain_key: str) -> str:
        """Generate a display name from domain key."""
        # Replace underscores with spaces and title case
        return domain_key.replace("_", " ").title()


# Singleton instance
_domain_registry_service: Optional[DomainRegistryService] = None


def get_domain_registry_service() -> DomainRegistryService:
    """Get singleton DomainRegistryService instance."""
    global _domain_registry_service
    if _domain_registry_service is None:
        _domain_registry_service = DomainRegistryService()
    return _domain_registry_service
