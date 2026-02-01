# consent-protocol/api/routes/world_model.py
"""
World Model API Routes - Blob-based storage.

Implements the NEW two-table architecture:
- world_model_data: Single encrypted JSONB blob per user
- world_model_index_v2: Queryable metadata for MCP scopes
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.middleware import require_vault_owner_token
from hushh_mcp.services.world_model_service import get_world_model_service

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
