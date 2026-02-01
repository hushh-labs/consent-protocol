# consent-protocol/hushh_mcp/services/world_model_service.py
"""
World Model Service - Unified user data model with BYOK encryption.

This service manages the two-table world model architecture:

1. world_model_index_v2 (ONE row per user)
   - Queryable, non-encrypted metadata
   - Used for MCP scope generation and UI display
   - Structure: { domain_summaries: {...}, available_domains: [...], ... }

2. world_model_data (ONE row per user) - NEW
   - Single encrypted JSONB blob containing ALL user data
   - Client-side encryption (BYOK) - backend cannot decrypt
   - Structure: { ciphertext, iv, tag }
   - Decrypted structure: { financial: {...}, food: {...}, health: {...} }

DEPRECATED TABLES (DO NOT USE):
- world_model_attributes (replaced by world_model_data)
- vault_portfolios (merged into world_model_data.financial)
- vault_food (merged into world_model_data.food)
- vault_professional (merged into world_model_data.professional)
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from db.db_client import get_db

logger = logging.getLogger(__name__)


class AttributeSource(str, Enum):
    """Source of attribute data."""
    EXPLICIT = "explicit"      # User provided directly
    INFERRED = "inferred"      # Inferred by Kai
    IMPORTED = "imported"      # From portfolio import
    COMPUTED = "computed"      # Calculated from other data


class EmbeddingType(str, Enum):
    """Types of user profile embeddings."""
    FINANCIAL_PROFILE = "financial_profile"
    LIFESTYLE_PROFILE = "lifestyle_profile"
    INTEREST_PROFILE = "interest_profile"
    COMPOSITE = "composite"


@dataclass
class DomainSummary:
    """Summary of a domain for a user."""
    domain_key: str
    display_name: str
    icon: str
    color: str
    attribute_count: int
    summary: dict = field(default_factory=dict)
    available_scopes: list[str] = field(default_factory=list)
    last_updated: Optional[datetime] = None


@dataclass
class WorldModelIndexV2:
    """Dynamic world model index with JSONB flexibility."""
    user_id: str
    domain_summaries: dict = field(default_factory=dict)
    available_domains: list[str] = field(default_factory=list)
    computed_tags: list[str] = field(default_factory=list)
    activity_score: Optional[float] = None
    last_active_at: Optional[datetime] = None
    total_attributes: int = 0
    model_version: int = 2


@dataclass
class UserWorldModelMetadata:
    """Complete metadata about a user's world model for UI."""
    user_id: str
    domains: list[DomainSummary] = field(default_factory=list)
    total_attributes: int = 0
    model_completeness: float = 0.0
    suggested_domains: list[str] = field(default_factory=list)
    last_updated: Optional[datetime] = None


@dataclass
class EncryptedAttribute:
    """Encrypted attribute with BYOK encryption."""
    user_id: str
    domain: str  # Now accepts any string (dynamic domains)
    attribute_key: str
    ciphertext: str
    iv: str
    tag: str
    algorithm: str = "aes-256-gcm"
    source: AttributeSource = AttributeSource.EXPLICIT
    confidence: Optional[float] = None
    inferred_at: Optional[datetime] = None
    display_name: Optional[str] = None
    data_type: str = "string"


class WorldModelService:
    """
    Service for managing the unified world model with dynamic domains.
    
    Follows BYOK principles - all sensitive attributes are encrypted
    with the user's vault key before storage.
    """
    
    def __init__(self):
        self._supabase = None
        self._domain_registry = None
        self._domain_inferrer = None
        self._scope_generator = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_db()
        return self._supabase
    
    @property
    def domain_registry(self):
        if self._domain_registry is None:
            from hushh_mcp.services.domain_registry_service import get_domain_registry_service
            self._domain_registry = get_domain_registry_service()
        return self._domain_registry
    
    @property
    def domain_inferrer(self):
        if self._domain_inferrer is None:
            from hushh_mcp.services.domain_inferrer import get_domain_inferrer
            self._domain_inferrer = get_domain_inferrer()
        return self._domain_inferrer
    
    @property
    def scope_generator(self):
        if self._scope_generator is None:
            from hushh_mcp.consent.scope_generator import get_scope_generator
            self._scope_generator = get_scope_generator()
        return self._scope_generator
    
    # ==================== INDEX V2 OPERATIONS ====================
    
    async def get_index_v2(self, user_id: str) -> Optional[WorldModelIndexV2]:
        """Get user's world model index (v2 with JSONB)."""
        try:
            result = self.supabase.table("world_model_index_v2").select("*").eq(
                "user_id", user_id
            ).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return WorldModelIndexV2(
                user_id=row["user_id"],
                domain_summaries=row.get("domain_summaries") or {},
                available_domains=row.get("available_domains") or [],
                computed_tags=row.get("computed_tags") or [],
                activity_score=row.get("activity_score"),
                last_active_at=row.get("last_active_at"),
                total_attributes=row.get("total_attributes", 0),
                model_version=row.get("model_version", 2),
            )
        except Exception as e:
            logger.error(f"Error getting world model index v2: {e}")
            return None
    
    async def upsert_index_v2(self, index: WorldModelIndexV2) -> bool:
        """Create or update user's world model index (v2)."""
        try:
            # Serialize dict fields to JSON strings for psycopg2 compatibility
            data = {
                "user_id": index.user_id,
                "domain_summaries": json.dumps(index.domain_summaries) if index.domain_summaries else "{}",
                "available_domains": index.available_domains,
                "computed_tags": index.computed_tags,
                "activity_score": index.activity_score,
                "last_active_at": index.last_active_at.isoformat() if index.last_active_at else None,
                "total_attributes": index.total_attributes,
                "model_version": index.model_version,
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            self.supabase.table("world_model_index_v2").upsert(data, on_conflict="user_id").execute()
            return True
        except Exception as e:
            logger.error(f"Error upserting world model index v2: {e}")
            return False
    
    async def update_domain_summary(
        self,
        user_id: str,
        domain: str,
        summary: dict,
    ) -> bool:
        """Update a specific domain summary in the index."""
        try:
            # Get current index
            index = await self.get_index_v2(user_id)
            if index is None:
                index = WorldModelIndexV2(user_id=user_id)
            
            # Update domain summary
            index.domain_summaries[domain] = summary
            
            # Update available domains
            if domain not in index.available_domains:
                index.available_domains.append(domain)
            
            return await self.upsert_index_v2(index)
        except Exception as e:
            logger.error(f"Error updating domain summary: {e}")
            return False
    
    # ==================== ATTRIBUTE OPERATIONS (DYNAMIC DOMAINS) ====================
    
    async def store_attribute(
        self,
        user_id: str,
        domain: Optional[str],
        attribute_key: str,
        ciphertext: str,
        iv: str,
        tag: str,
        algorithm: str = "aes-256-gcm",
        source: str = "explicit",
        confidence: Optional[float] = None,
        display_name: Optional[str] = None,
        data_type: str = "string",
    ) -> tuple[bool, str]:
        """
        Store an encrypted attribute with auto domain registration.
        
        If domain is None, it will be inferred from the attribute_key.
        
        Returns:
            Tuple of (success, generated_scope)
        """
        try:
            # Infer domain if not provided
            if domain is None or domain == "":
                domain = self.domain_inferrer.infer(attribute_key)
            
            # Normalize domain
            domain = domain.lower().strip()
            
            # Auto-register domain if new
            domain_metadata = self.domain_inferrer.get_domain_metadata(domain)
            await self.domain_registry.register_domain(
                domain_key=domain,
                display_name=domain_metadata.get("display_name"),
                icon_name=domain_metadata.get("icon"),
                color_hex=domain_metadata.get("color"),
            )
            
            # Store attribute
            data = {
                "user_id": user_id,
                "domain": domain,
                "attribute_key": attribute_key,
                "ciphertext": ciphertext,
                "iv": iv,
                "tag": tag,
                "algorithm": algorithm,
                "source": source,
                "confidence": confidence,
                "display_name": display_name or attribute_key.replace("_", " ").title(),
                "data_type": data_type,
            }
            
            self.supabase.table("world_model_attributes").upsert(
                data,
                on_conflict="user_id,domain,attribute_key"
            ).execute()
            
            # Generate scope for this attribute
            scope = self.scope_generator.generate_scope(domain, attribute_key)
            
            return (True, scope)
        except Exception as e:
            logger.error(f"Error storing attribute: {e}")
            return (False, "")
    
    async def store_attribute_obj(self, attr: EncryptedAttribute) -> tuple[bool, str]:
        """Store an encrypted attribute object."""
        return await self.store_attribute(
            user_id=attr.user_id,
            domain=attr.domain,
            attribute_key=attr.attribute_key,
            ciphertext=attr.ciphertext,
            iv=attr.iv,
            tag=attr.tag,
            algorithm=attr.algorithm,
            source=attr.source.value if isinstance(attr.source, AttributeSource) else attr.source,
            confidence=attr.confidence,
            display_name=attr.display_name,
            data_type=attr.data_type,
        )
    
    async def get_attribute(
        self,
        user_id: str,
        domain: str,
        attribute_key: str,
    ) -> Optional[EncryptedAttribute]:
        """Get a specific encrypted attribute."""
        try:
            result = self.supabase.table("world_model_attributes").select("*").eq(
                "user_id", user_id
            ).eq(
                "domain", domain.lower()
            ).eq(
                "attribute_key", attribute_key
            ).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return self._row_to_attribute(row)
        except Exception as e:
            logger.error(f"Error getting attribute: {e}")
            return None
    
    async def get_domain_attributes(
        self,
        user_id: str,
        domain: str,
    ) -> list[EncryptedAttribute]:
        """Get all attributes for a domain."""
        try:
            result = self.supabase.table("world_model_attributes").select("*").eq(
                "user_id", user_id
            ).eq(
                "domain", domain.lower()
            ).execute()
            
            return [self._row_to_attribute(row) for row in (result.data or [])]
        except Exception as e:
            logger.error(f"Error getting domain attributes: {e}")
            return []
    
    async def get_all_attributes(self, user_id: str) -> list[EncryptedAttribute]:
        """Get all attributes for a user across all domains."""
        try:
            result = self.supabase.table("world_model_attributes").select("*").eq(
                "user_id", user_id
            ).execute()
            
            return [self._row_to_attribute(row) for row in (result.data or [])]
        except Exception as e:
            logger.error(f"Error getting all attributes: {e}")
            return []
    
    async def delete_attribute(
        self,
        user_id: str,
        domain: str,
        attribute_key: str,
    ) -> bool:
        """Delete a specific attribute."""
        try:
            self.supabase.table("world_model_attributes").delete().eq(
                "user_id", user_id
            ).eq(
                "domain", domain.lower()
            ).eq(
                "attribute_key", attribute_key
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting attribute: {e}")
            return False
    
    def _row_to_attribute(self, row: dict) -> EncryptedAttribute:
        """Convert database row to EncryptedAttribute."""
        source_str = row.get("source", "explicit")
        try:
            source = AttributeSource(source_str)
        except ValueError:
            source = AttributeSource.EXPLICIT
        
        return EncryptedAttribute(
            user_id=row["user_id"],
            domain=row["domain"],
            attribute_key=row["attribute_key"],
            ciphertext=row["ciphertext"],
            iv=row["iv"],
            tag=row["tag"],
            algorithm=row.get("algorithm", "aes-256-gcm"),
            source=source,
            confidence=row.get("confidence"),
            inferred_at=row.get("inferred_at"),
            display_name=row.get("display_name"),
            data_type=row.get("data_type", "string"),
        )
    
    # ==================== METADATA OPERATIONS ====================
    
    async def get_user_metadata(self, user_id: str) -> UserWorldModelMetadata:
        """
        Get complete metadata about user's world model for UI.
        
        This is the primary method for frontend to fetch user profile data.
        """
        try:
            # Try RPC function first (more efficient)
            try:
                result = self.supabase.rpc(
                    "get_user_world_model_metadata",
                    {"p_user_id": user_id}
                ).execute()
                
                if result.data:
                    data = result.data
                    domains = []
                    for d in (data.get("domains") or []):
                        domains.append(DomainSummary(
                            domain_key=d["key"],
                            display_name=d["display_name"],
                            icon=d["icon"],
                            color=d["color"],
                            attribute_count=d["attribute_count"],
                            last_updated=d.get("last_updated"),
                        ))
                    
                    return UserWorldModelMetadata(
                        user_id=user_id,
                        domains=domains,
                        total_attributes=data.get("total_attributes", 0),
                        last_updated=data.get("last_updated"),
                    )
            except Exception as rpc_error:
                logger.warning(f"RPC get_user_world_model_metadata failed, using fallback: {rpc_error}")
            
            # Fallback: Manual query
            user_domains = await self.domain_registry.get_user_domains(user_id)
            
            domains = []
            for domain_info in user_domains:
                # Get scopes for this domain
                scopes = await self.scope_generator.get_available_scopes(user_id)
                domain_scopes = [s for s in scopes if s.startswith(f"attr.{domain_info.domain_key}.")]
                
                domains.append(DomainSummary(
                    domain_key=domain_info.domain_key,
                    display_name=domain_info.display_name,
                    icon=domain_info.icon_name,
                    color=domain_info.color_hex,
                    attribute_count=domain_info.attribute_count,
                    available_scopes=domain_scopes,
                ))
            
            # Get total count
            result = self.supabase.table("world_model_attributes").select(
                "id", count="exact"
            ).eq("user_id", user_id).execute()
            total = result.count or 0
            
            # Calculate completeness (based on recommended domains from registry)
            # Query domain registry for domains marked as "recommended" or use top domains by user count
            try:
                registry_result = self.supabase.table("domain_registry").select(
                    "domain_key"
                ).order("user_count", desc=True).limit(5).execute()
                common_domains = {d["domain_key"] for d in registry_result.data} if registry_result.data else set()
            except Exception:
                # Fallback to sensible defaults if registry query fails
                common_domains = {"financial", "subscriptions", "health", "travel", "food"}
            
            user_domain_keys = {d.domain_key for d in domains}
            completeness = len(user_domain_keys & common_domains) / len(common_domains) if common_domains else 0.0
            
            # Suggest missing common domains
            suggested = list(common_domains - user_domain_keys)[:3]
            
            return UserWorldModelMetadata(
                user_id=user_id,
                domains=domains,
                total_attributes=total,
                model_completeness=completeness,
                suggested_domains=suggested,
                last_updated=datetime.utcnow(),
            )
        except Exception as e:
            logger.error(f"Error getting user metadata: {e}")
            return UserWorldModelMetadata(user_id=user_id)
    
    # ==================== EMBEDDING OPERATIONS ====================
    
    async def store_embedding(
        self,
        user_id: str,
        embedding_type: EmbeddingType,
        embedding_vector: list[float],
        model_name: str = "all-MiniLM-L6-v2",
    ) -> bool:
        """Store a user profile embedding."""
        try:
            data = {
                "user_id": user_id,
                "embedding_type": embedding_type.value,
                "embedding_vector": embedding_vector,
                "model_name": model_name,
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            self.supabase.table("world_model_embeddings").upsert(
                data,
                on_conflict="user_id,embedding_type"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error storing embedding: {e}")
            return False
    
    async def find_similar_users(
        self,
        query_embedding: list[float],
        embedding_type: EmbeddingType,
        threshold: float = 0.7,
        limit: int = 10,
    ) -> list[dict]:
        """Find users with similar profiles using vector similarity."""
        try:
            result = self.supabase.rpc(
                "match_user_profiles",
                {
                    "query_embedding": query_embedding,
                    "embedding_type_filter": embedding_type.value,
                    "match_threshold": threshold,
                    "match_count": limit,
                }
            ).execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"Error finding similar users: {e}")
            return []
    
    # ==================== WORLD MODEL DATA OPERATIONS (BLOB-BASED) ====================
    
    async def store_domain_data(
        self,
        user_id: str,
        domain: str,
        encrypted_blob: dict,
        summary: dict,
    ) -> bool:
        """
        Store encrypted domain data and update index.
        
        This is the NEW method for storing user data following BYOK principles.
        Client encrypts entire domain object and sends only ciphertext to backend.
        
        Args:
            user_id: User's ID
            domain: Domain key (e.g., "financial", "food")
            encrypted_blob: Pre-encrypted data from client
                {
                    "ciphertext": "base64...",
                    "iv": "base64...",
                    "tag": "base64..."
                }
            summary: Non-sensitive metadata for world_model_index_v2
                {
                    "has_portfolio": true,
                    "holdings_count": 4,
                    "risk_bucket": "aggressive"
                }
        
        Returns:
            bool: Success status
        """
        try:
            # 1. Get current encrypted data
            current_data = await self.get_encrypted_data(user_id)
            
            # 2. Store updated encrypted blob
            # Note: Merging happens on client-side. Backend just stores the new blob.
            data = {
                "user_id": user_id,
                "encrypted_data_ciphertext": encrypted_blob["ciphertext"],
                "encrypted_data_iv": encrypted_blob["iv"],
                "encrypted_data_tag": encrypted_blob["tag"],
                "algorithm": encrypted_blob.get("algorithm", "aes-256-gcm"),
                "data_version": 1,
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            if current_data is None:
                data["created_at"] = datetime.utcnow().isoformat()
            
            self.supabase.table("world_model_data").upsert(data, on_conflict="user_id").execute()
            
            # 3. Update world_model_index_v2
            await self.update_domain_summary(user_id, domain, summary)
            
            return True
        except Exception as e:
            logger.error(f"Error storing domain data: {e}")
            return False
    
    async def get_encrypted_data(self, user_id: str) -> Optional[dict]:
        """
        Get user's encrypted data blob.
        
        Returns encrypted blob that can only be decrypted client-side.
        Backend cannot read this data.
        
        Returns:
            dict with keys: ciphertext, iv, tag, algorithm
            or None if no data exists
        """
        try:
            result = self.supabase.table("world_model_data").select("*").eq(
                "user_id", user_id
            ).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return {
                "ciphertext": row["encrypted_data_ciphertext"],
                "iv": row["encrypted_data_iv"],
                "tag": row["encrypted_data_tag"],
                "algorithm": row.get("algorithm", "aes-256-gcm"),
                "data_version": row.get("data_version", 1),
                "updated_at": row.get("updated_at"),
            }
        except Exception as e:
            logger.error(f"Error getting encrypted data: {e}")
            return None
    
    async def get_domain_data(self, user_id: str, domain: str) -> Optional[dict]:
        """
        Get user's encrypted data blob for a specific domain.
        
        Note: The current architecture stores all domains in a single encrypted blob.
        This method returns the full blob - the client must decrypt and extract
        the specific domain data.
        
        Args:
            user_id: User's ID
            domain: Domain key (e.g., "financial") - used to verify domain exists
        
        Returns:
            dict with keys: ciphertext, iv, tag, algorithm
            or None if no data exists for this domain
        """
        try:
            # First check if the domain exists in the index
            index = await self.get_index_v2(user_id)
            if index is None or domain not in index.available_domains:
                logger.info(f"Domain {domain} not found in user's available domains")
                return None
            
            # Return the encrypted blob (client will decrypt and extract domain)
            return await self.get_encrypted_data(user_id)
        except Exception as e:
            logger.error(f"Error getting domain data: {e}")
            return None
    
    async def delete_user_data(self, user_id: str) -> bool:
        """
        Delete all user data (encrypted blob and index).
        
        Used for account deletion / data purge.
        """
        try:
            # Delete encrypted data
            self.supabase.table("world_model_data").delete().eq(
                "user_id", user_id
            ).execute()
            
            # Delete index
            self.supabase.table("world_model_index_v2").delete().eq(
                "user_id", user_id
            ).execute()
            
            return True
        except Exception as e:
            logger.error(f"Error deleting user data: {e}")
            return False
    
    # ==================== LEGACY: PORTFOLIO OPERATIONS (DEPRECATED) ====================
    # These methods use the OLD vault_portfolios table
    # New code should use store_domain_data() instead
    
    async def store_portfolio(
        self,
        user_id: str,
        holdings_ciphertext: str,
        holdings_iv: str,
        holdings_tag: str,
        total_value_usd: Optional[float] = None,
        holdings_count: Optional[int] = None,
        source: str = "manual",
        portfolio_name: str = "Main Portfolio",
    ) -> bool:
        """
        DEPRECATED: Store encrypted portfolio holdings.
        
        Use store_domain_data() instead for new code.
        This method uses the old vault_portfolios table.
        """
        logger.warning("store_portfolio() is deprecated. Use store_domain_data() instead.")
        try:
            data = {
                "user_id": user_id,
                "portfolio_name": portfolio_name,
                "holdings_ciphertext": holdings_ciphertext,
                "holdings_iv": holdings_iv,
                "holdings_tag": holdings_tag,
                "algorithm": "aes-256-gcm",
                "total_value_usd": total_value_usd,
                "holdings_count": holdings_count,
                "source": source,
                "last_imported_at": datetime.utcnow().isoformat(),
            }
            
            self.supabase.table("vault_portfolios").upsert(
                data,
                on_conflict="user_id,portfolio_name"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error storing portfolio: {e}")
            return False
    
    async def get_portfolio(
        self,
        user_id: str,
        portfolio_name: str = "Main Portfolio",
    ) -> Optional[dict]:
        """Get encrypted portfolio data."""
        try:
            result = self.supabase.table("vault_portfolios").select("*").eq(
                "user_id", user_id
            ).eq(
                "portfolio_name", portfolio_name
            ).execute()
            
            if not result.data:
                return None
            
            return result.data[0]
        except Exception as e:
            logger.error(f"Error getting portfolio: {e}")
            return None
    
    async def list_portfolios(self, user_id: str) -> list[dict]:
        """List all portfolios for a user."""
        try:
            result = self.supabase.table("vault_portfolios").select(
                "portfolio_name", "total_value_usd", "holdings_count", "source", "last_imported_at"
            ).eq("user_id", user_id).execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"Error listing portfolios: {e}")
            return []
    
    # ==================== LEGACY COMPATIBILITY ====================
    # These methods maintain backward compatibility with the old API
    
    async def get_index(self, user_id: str):
        """Legacy: Get world model index (redirects to v2)."""
        return await self.get_index_v2(user_id)
    
    async def upsert_index(self, index):
        """Legacy: Upsert world model index."""
        if isinstance(index, WorldModelIndexV2):
            return await self.upsert_index_v2(index)
        # Convert old format to new
        new_index = WorldModelIndexV2(
            user_id=index.user_id,
            activity_score=getattr(index, "activity_score", None),
            last_active_at=getattr(index, "last_active_at", None),
        )
        return await self.upsert_index_v2(new_index)
    
    async def update_activity(self, user_id: str) -> bool:
        """Update user's last active timestamp."""
        try:
            # Update v2 index
            self.supabase.table("world_model_index_v2").upsert({
                "user_id": user_id,
                "last_active_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }, on_conflict="user_id").execute()
            return True
        except Exception as e:
            logger.error(f"Error updating activity: {e}")
            return False


# Singleton instance
_world_model_service: Optional[WorldModelService] = None


def get_world_model_service() -> WorldModelService:
    """Get singleton WorldModelService instance."""
    global _world_model_service
    if _world_model_service is None:
        _world_model_service = WorldModelService()
    return _world_model_service
