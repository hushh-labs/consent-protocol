# consent-protocol/api/routes/world_model.py
"""
World Model API Routes - Blob-based storage.

Implements the NEW two-table architecture:
- world_model_data: Single encrypted JSONB blob per user
- world_model_index_v2: Queryable metadata for MCP scopes
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.middleware import require_vault_owner_token
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/world-model", tags=["world-model"])


class EncryptedBlob(BaseModel):
    """Encrypted data blob."""
    ciphertext: str = Field(..., description="AES-256-GCM encrypted data")
    iv: str = Field(..., description="Initialization vector")
    tag: str = Field(..., description="Authentication tag")
    algorithm: str = Field(default="aes-256-gcm", description="Encryption algorithm")


class StoreDomainRequest(BaseModel):
    """Request to store domain data."""
    user_id: str = Field(..., description="User's ID")
    domain: str = Field(..., description="Domain key (e.g., 'financial')")
    encrypted_blob: EncryptedBlob = Field(..., description="Pre-encrypted data from client")
    summary: dict = Field(..., description="Non-sensitive metadata for index")


class StoreDomainResponse(BaseModel):
    """Response from store domain operation."""
    success: bool
    message: Optional[str] = None


@router.post("/store-domain", response_model=StoreDomainResponse)
async def store_domain(
    request: StoreDomainRequest,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Store encrypted domain data and update index.
    
    This endpoint:
    1. Receives PRE-ENCRYPTED data from client
    2. Stores ciphertext in world_model_data
    3. Updates metadata in world_model_index_v2
    4. Backend CANNOT decrypt the data (BYOK principle)
    """
    # Verify token matches user_id
    if token_data.get("user_id") != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id"
        )
    
    world_model = get_world_model_service()
    
    # Store encrypted blob + metadata
    success = await world_model.store_domain_data(
        user_id=request.user_id,
        domain=request.domain,
        encrypted_blob={
            "ciphertext": request.encrypted_blob.ciphertext,
            "iv": request.encrypted_blob.iv,
            "tag": request.encrypted_blob.tag,
            "algorithm": request.encrypted_blob.algorithm,
        },
        summary=request.summary,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store domain data"
        )
    
    return StoreDomainResponse(
        success=True,
        message=f"Successfully stored {request.domain} domain data"
    )


@router.get("/data/{user_id}", response_model=dict)
async def get_encrypted_data(
    user_id: str,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Get user's encrypted data blob.
    
    Returns encrypted blob that can only be decrypted client-side.
    """
    # Verify token matches user_id
    if token_data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id"
        )
    
    world_model = get_world_model_service()
    data = await world_model.get_encrypted_data(user_id)
    
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No data found for user"
        )
    
    return data


@router.get("/domain-data/{user_id}/{domain}", response_model=dict)
async def get_domain_data(
    user_id: str,
    domain: str,
    token_data: dict = Depends(require_vault_owner_token),
):
    """
    Get user's encrypted data blob for a specific domain.
    
    Returns encrypted blob that can only be decrypted client-side.
    """
    # Verify token matches user_id
    if token_data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token user_id does not match request user_id"
        )
    
    world_model = get_world_model_service()
    data = await world_model.get_domain_data(user_id, domain)
    
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {domain} data found for user"
        )
    
    return {"encrypted_blob": data}


# ==================== METADATA ENDPOINT ====================

class DomainMetadata(BaseModel):
    """Domain metadata for UI display."""
    key: str = Field(..., description="Domain key (e.g., 'financial')")
    display_name: str = Field(..., description="Human-readable domain name")
    icon: str = Field(default="folder", description="Icon name for UI")
    color: str = Field(default="#6366F1", description="Color hex for UI")
    attribute_count: int = Field(default=0, description="Number of attributes in domain")
    summary: dict = Field(default_factory=dict, description="Domain-specific summary data")
    available_scopes: List[str] = Field(default_factory=list, description="Available MCP scopes")
    last_updated: Optional[str] = Field(default=None, description="ISO timestamp of last update")


class WorldModelMetadataResponse(BaseModel):
    """Response for world model metadata."""
    user_id: str
    domains: List[DomainMetadata]
    total_attributes: int
    model_completeness: int = Field(description="Percentage of recommended domains filled (0-100)")
    suggested_domains: List[str] = Field(default_factory=list, description="Domains user should consider adding")
    last_updated: Optional[str] = None


@router.get("/metadata/{user_id}", response_model=WorldModelMetadataResponse)
async def get_metadata(user_id: str):
    """
    Get user's world model metadata for UI display.
    
    This endpoint is used by the frontend to:
    1. Determine if user has existing data (for showing dashboard vs import prompt)
    2. Display domain summaries and completeness scores
    3. Suggest additional domains to enrich the world model
    
    Returns 404 if user has no world model data (new user).
    
    **Note**: This endpoint does NOT require authentication as it only returns
    non-sensitive metadata (domain names, counts). The actual encrypted data
    requires VAULT_OWNER token via /data/{user_id} endpoint.
    """
    world_model = get_world_model_service()
    
    try:
        # Get index from world_model_index_v2
        index = await world_model.get_index_v2(user_id)
        
        if index is None:
            # Check if user has any data at all (edge case: data exists but index missing)
            encrypted_data = await world_model.get_encrypted_data(user_id)
            if encrypted_data is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No world model data found for user"
                )
            # Data exists but index is missing - this is a corrupted state
            # Return minimal metadata to allow dashboard to show
            logger.warning(f"User {user_id} has encrypted data but no index - corrupted state")
            return WorldModelMetadataResponse(
                user_id=user_id,
                domains=[],
                total_attributes=0,
                model_completeness=0,
                suggested_domains=["financial", "health", "travel"],
                last_updated=encrypted_data.get("updated_at"),
            )
        
        # Build domain metadata from index
        domains: List[DomainMetadata] = []
        
        for domain_key in index.available_domains:
            summary = index.domain_summaries.get(domain_key, {})
            
            # Lookup domain display info from registry
            try:
                domain_info = await world_model.domain_registry.get_domain(domain_key)
            except Exception as e:
                logger.warning(f"Failed to get domain info for {domain_key}: {e}")
                domain_info = None
            
            # Calculate attribute count from summary
            # Different domains store counts differently
            attr_count = (
                summary.get("holdings_count") or 
                summary.get("attribute_count") or 
                summary.get("item_count") or 
                0
            )
            
            domains.append(DomainMetadata(
                key=domain_key,
                display_name=domain_info.display_name if domain_info else domain_key.replace("_", " ").title(),
                icon=domain_info.icon_name if domain_info else "folder",
                color=domain_info.color_hex if domain_info else "#6366F1",
                attribute_count=attr_count,
                summary=summary,
                available_scopes=[f"attr.{domain_key}.*"],
                last_updated=index.last_active_at.isoformat() if index.last_active_at else None,
            ))
        
        # Calculate total attributes
        total_attrs = index.total_attributes or sum(d.attribute_count for d in domains)
        
        # Calculate model completeness (based on common domains)
        common_domains = {"financial", "health", "travel", "subscriptions", "food"}
        user_domain_keys = set(index.available_domains)
        filled_common = len(user_domain_keys & common_domains)
        completeness = min(100, int((filled_common / len(common_domains)) * 100))
        
        # Suggest missing common domains
        suggested = list(common_domains - user_domain_keys)[:3]
        
        return WorldModelMetadataResponse(
            user_id=user_id,
            domains=domains,
            total_attributes=total_attrs,
            model_completeness=completeness,
            suggested_domains=suggested,
            last_updated=index.last_active_at.isoformat() if index.last_active_at else None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting metadata for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve world model metadata"
        )
