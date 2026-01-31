# consent-protocol/hushh_mcp/services/world_model_service.py
"""
World Model Service - Unified user data model with BYOK encryption.

This service manages the 3-layer world model architecture:
1. world_model_index - Queryable metadata (non-sensitive)
2. world_model_attributes - Encrypted detailed attributes (BYOK)
3. world_model_embeddings - Vector embeddings for similarity search
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)


class WorldModelDomain(str, Enum):
    """Domains for world model attributes."""
    FINANCIAL = "financial"
    LIFESTYLE = "lifestyle"
    PROFESSIONAL = "professional"
    INTERESTS = "interests"
    BEHAVIORAL = "behavioral"


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
class WorldModelIndex:
    """Queryable user profile metadata."""
    user_id: str
    risk_bucket: Optional[str] = None
    investment_horizon: Optional[str] = None
    portfolio_size_bucket: Optional[str] = None
    lifestyle_tags: list[str] = None
    interest_categories: list[str] = None
    activity_score: Optional[float] = None
    last_active_at: Optional[datetime] = None
    model_version: int = 1
    confidence_score: Optional[float] = None


@dataclass
class EncryptedAttribute:
    """Encrypted attribute with BYOK encryption."""
    user_id: str
    domain: WorldModelDomain
    attribute_key: str
    ciphertext: str
    iv: str
    tag: str
    algorithm: str = "aes-256-gcm"
    source: AttributeSource = AttributeSource.EXPLICIT
    confidence: Optional[float] = None
    inferred_at: Optional[datetime] = None


class WorldModelService:
    """
    Service for managing the unified world model.
    
    Follows BYOK principles - all sensitive attributes are encrypted
    with the user's vault key before storage.
    """
    
    def __init__(self):
        self._supabase = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase()
        return self._supabase
    
    # ==================== INDEX OPERATIONS ====================
    
    async def get_index(self, user_id: str) -> Optional[WorldModelIndex]:
        """Get user's world model index."""
        try:
            result = self.supabase.table("world_model_index").select("*").eq("user_id", user_id).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return WorldModelIndex(
                user_id=row["user_id"],
                risk_bucket=row.get("risk_bucket"),
                investment_horizon=row.get("investment_horizon"),
                portfolio_size_bucket=row.get("portfolio_size_bucket"),
                lifestyle_tags=row.get("lifestyle_tags") or [],
                interest_categories=row.get("interest_categories") or [],
                activity_score=row.get("activity_score"),
                last_active_at=row.get("last_active_at"),
                model_version=row.get("model_version", 1),
                confidence_score=row.get("confidence_score"),
            )
        except Exception as e:
            logger.error(f"Error getting world model index: {e}")
            return None
    
    async def upsert_index(self, index: WorldModelIndex) -> bool:
        """Create or update user's world model index."""
        try:
            data = {
                "user_id": index.user_id,
                "risk_bucket": index.risk_bucket,
                "investment_horizon": index.investment_horizon,
                "portfolio_size_bucket": index.portfolio_size_bucket,
                "lifestyle_tags": index.lifestyle_tags or [],
                "interest_categories": index.interest_categories or [],
                "activity_score": index.activity_score,
                "last_active_at": index.last_active_at.isoformat() if index.last_active_at else None,
                "model_version": index.model_version,
                "confidence_score": index.confidence_score,
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            self.supabase.table("world_model_index").upsert(data).execute()
            return True
        except Exception as e:
            logger.error(f"Error upserting world model index: {e}")
            return False
    
    async def update_activity(self, user_id: str) -> bool:
        """Update user's last active timestamp."""
        try:
            self.supabase.table("world_model_index").update({
                "last_active_at": datetime.utcnow().isoformat(),
            }).eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error updating activity: {e}")
            return False
    
    # ==================== ATTRIBUTE OPERATIONS ====================
    
    async def store_attribute(self, attr: EncryptedAttribute) -> bool:
        """Store an encrypted attribute."""
        try:
            data = {
                "user_id": attr.user_id,
                "domain": attr.domain.value,
                "attribute_key": attr.attribute_key,
                "ciphertext": attr.ciphertext,
                "iv": attr.iv,
                "tag": attr.tag,
                "algorithm": attr.algorithm,
                "source": attr.source.value,
                "confidence": attr.confidence,
                "inferred_at": attr.inferred_at.isoformat() if attr.inferred_at else None,
            }
            
            self.supabase.table("world_model_attributes").upsert(
                data,
                on_conflict="user_id,domain,attribute_key"
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error storing attribute: {e}")
            return False
    
    async def get_attribute(
        self,
        user_id: str,
        domain: WorldModelDomain,
        attribute_key: str,
    ) -> Optional[EncryptedAttribute]:
        """Get a specific encrypted attribute."""
        try:
            result = self.supabase.table("world_model_attributes").select("*").eq(
                "user_id", user_id
            ).eq(
                "domain", domain.value
            ).eq(
                "attribute_key", attribute_key
            ).execute()
            
            if not result.data:
                return None
            
            row = result.data[0]
            return EncryptedAttribute(
                user_id=row["user_id"],
                domain=WorldModelDomain(row["domain"]),
                attribute_key=row["attribute_key"],
                ciphertext=row["ciphertext"],
                iv=row["iv"],
                tag=row["tag"],
                algorithm=row.get("algorithm", "aes-256-gcm"),
                source=AttributeSource(row["source"]),
                confidence=row.get("confidence"),
                inferred_at=row.get("inferred_at"),
            )
        except Exception as e:
            logger.error(f"Error getting attribute: {e}")
            return None
    
    async def get_domain_attributes(
        self,
        user_id: str,
        domain: WorldModelDomain,
    ) -> list[EncryptedAttribute]:
        """Get all attributes for a domain."""
        try:
            result = self.supabase.table("world_model_attributes").select("*").eq(
                "user_id", user_id
            ).eq(
                "domain", domain.value
            ).execute()
            
            return [
                EncryptedAttribute(
                    user_id=row["user_id"],
                    domain=WorldModelDomain(row["domain"]),
                    attribute_key=row["attribute_key"],
                    ciphertext=row["ciphertext"],
                    iv=row["iv"],
                    tag=row["tag"],
                    algorithm=row.get("algorithm", "aes-256-gcm"),
                    source=AttributeSource(row["source"]),
                    confidence=row.get("confidence"),
                    inferred_at=row.get("inferred_at"),
                )
                for row in result.data
            ]
        except Exception as e:
            logger.error(f"Error getting domain attributes: {e}")
            return []
    
    async def delete_attribute(
        self,
        user_id: str,
        domain: WorldModelDomain,
        attribute_key: str,
    ) -> bool:
        """Delete a specific attribute."""
        try:
            self.supabase.table("world_model_attributes").delete().eq(
                "user_id", user_id
            ).eq(
                "domain", domain.value
            ).eq(
                "attribute_key", attribute_key
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting attribute: {e}")
            return False
    
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
    
    # ==================== PORTFOLIO OPERATIONS ====================
    
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
        """Store encrypted portfolio holdings."""
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


# Singleton instance
_world_model_service: Optional[WorldModelService] = None


def get_world_model_service() -> WorldModelService:
    """Get singleton WorldModelService instance."""
    global _world_model_service
    if _world_model_service is None:
        _world_model_service = WorldModelService()
    return _world_model_service
