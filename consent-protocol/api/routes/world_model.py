# api/routes/world_model.py
"""
World Model API endpoints for dynamic domain and scope management.

These endpoints provide runtime discovery of domains and scopes,
replacing hardcoded frontend domain lists with dynamic lookups.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from hushh_mcp.consent.scope_generator import get_scope_generator
from hushh_mcp.services.domain_registry_service import get_domain_registry_service
from hushh_mcp.services.world_model_service import get_world_model_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/world-model", tags=["World Model"])


class DomainInfoResponse(BaseModel):
    """Domain metadata for frontend rendering."""
    domain_key: str
    display_name: str
    icon_name: str
    color_hex: str
    description: Optional[str] = None
    attribute_count: int = 0
    user_count: int = 0


@router.get("/domains")
async def list_domains(include_empty: bool = False):
    """
    List all registered domains with metadata.
    
    Args:
        include_empty: If True, include domains with no attributes
    
    Returns:
        List of domain metadata objects
        
    Usage:
        Frontend components call this to dynamically render domain navigation.
    """
    try:
        registry = get_domain_registry_service()
        domains = await registry.list_domains(include_empty=include_empty)
        
        return {
            "domains": [
                {
                    "domain_key": d.domain_key,
                    "display_name": d.display_name,
                    "icon_name": d.icon_name,
                    "color_hex": d.color_hex,
                    "description": d.description,
                    "attribute_count": d.attribute_count,
                    "user_count": d.user_count,
                }
                for d in domains
            ],
            "total": len(domains)
        }
    except Exception as e:
        logger.error(f"Failed to list domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/domains/{user_id}")
async def get_user_domains(user_id: str):
    """
    Get domains that have data for a specific user.
    
    Args:
        user_id: The user's Firebase UID
    
    Returns:
        List of domains with user-specific attribute counts
    """
    try:
        registry = get_domain_registry_service()
        domains = await registry.get_user_domains(user_id)
        
        return {
            "user_id": user_id,
            "domains": [
                {
                    "domain_key": d.domain_key,
                    "display_name": d.display_name,
                    "icon_name": d.icon_name,
                    "color_hex": d.color_hex,
                    "description": d.description,
                    "attribute_count": d.attribute_count,
                }
                for d in domains
            ],
            "total": len(domains)
        }
    except Exception as e:
        logger.error(f"Failed to get user domains for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata/{user_id}")
async def get_user_metadata(user_id: str):
    """
    Get user's world model metadata (index).
    
    Returns high-level statistics about user's stored data.
    """
    try:
        service = get_world_model_service()
        metadata = await service.get_user_metadata(user_id)
        
        if not metadata:
            return {
                "user_id": user_id,
                "total_attributes": 0,
                "total_domains": 0,
                "available_domains": [],
                "last_updated_at": None
            }
        
        return metadata
    except Exception as e:
        logger.error(f"Failed to get metadata for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scopes/{user_id}")
async def get_available_scopes(user_id: str):
    """
    Get all valid scopes for a user based on stored attributes.
    
    Returns both specific scopes (attr.domain.attribute_key) and
    wildcard scopes (attr.domain.*).
    
    Args:
        user_id: The user's Firebase UID
    
    Returns:
        List of specific scopes and wildcard scopes
    """
    try:
        generator = get_scope_generator()
        
        # Get specific and wildcard scopes
        specific_scopes = await generator.get_available_scopes(user_id)
        wildcard_scopes = await generator.get_available_wildcards(user_id)
        
        # Get display info for each scope
        scopes_with_info = []
        for scope in specific_scopes:
            display_info = generator.get_scope_display_info(scope)
            scopes_with_info.append({
                "scope": scope,
                "display_name": display_info["display_name"],
                "domain": display_info["domain"],
                "attribute": display_info["attribute"],
                "is_wildcard": False
            })
        
        wildcards_with_info = []
        for scope in wildcard_scopes:
            display_info = generator.get_scope_display_info(scope)
            wildcards_with_info.append({
                "scope": scope,
                "display_name": display_info["display_name"],
                "domain": display_info["domain"],
                "is_wildcard": True
            })
        
        return {
            "user_id": user_id,
            "scopes": scopes_with_info,
            "wildcards": wildcards_with_info,
            "total_scopes": len(specific_scopes),
            "total_wildcards": len(wildcard_scopes),
            "master_scope": "vault.owner"
        }
    except Exception as e:
        logger.error(f"Failed to get scopes for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attributes/{user_id}")
async def get_user_attributes(user_id: str, domain: Optional[str] = None):
    """
    Get user's stored attributes, optionally filtered by domain.
    
    Args:
        user_id: The user's Firebase UID
        domain: Optional domain filter
    
    Returns:
        List of attributes (encrypted) with metadata
    """
    try:
        service = get_world_model_service()
        
        if domain:
            attributes = await service.get_domain_attributes(user_id, domain)
        else:
            # Get all attributes across all domains
            registry = get_domain_registry_service()
            user_domains = await registry.get_user_domains(user_id)
            
            attributes = []
            for d in user_domains:
                domain_attrs = await service.get_domain_attributes(user_id, d.domain_key)
                attributes.extend(domain_attrs)
        
        return {
            "user_id": user_id,
            "domain": domain,
            "attributes": attributes,
            "total": len(attributes)
        }
    except Exception as e:
        logger.error(f"Failed to get attributes for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
