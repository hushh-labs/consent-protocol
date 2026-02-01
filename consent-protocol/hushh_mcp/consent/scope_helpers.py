# consent-protocol/hushh_mcp/consent/scope_helpers.py
"""
Dynamic Scope Resolution Helpers

Centralized utilities for resolving scopes to ConsentScope enums.
Replaces hardcoded SCOPE_TO_ENUM and SCOPE_ENUM_MAP dictionaries.
"""

from hushh_mcp.consent.scope_generator import get_scope_generator
from hushh_mcp.constants import ConsentScope


def resolve_scope_to_enum(scope: str) -> ConsentScope:
    """
    Resolve any scope string to its ConsentScope enum.
    
    Handles:
    - Dynamic attr.{domain}.* scopes
    - Dynamic attr.{domain}.{attribute} scopes
    - World model scopes
    - Agent permissions
    - Legacy vault.read.*/vault.write.* scopes
    - vault.owner master scope
    
    Args:
        scope: The scope string to resolve
        
    Returns:
        ConsentScope enum value
    """
    generator = get_scope_generator()
    
    # Master scope
    if scope == "vault.owner":
        return ConsentScope.VAULT_OWNER
    
    # Dynamic attr.* scopes
    if generator.is_dynamic_scope(scope):
        domain, attribute_key, is_wildcard = generator.parse_scope(scope)
        # All attr.* scopes map to WORLD_MODEL_READ (write determined by operation context)
        return ConsentScope.WORLD_MODEL_READ
    
    # World model scopes
    if scope == "world_model.read":
        return ConsentScope.WORLD_MODEL_READ
    if scope == "world_model.write":
        return ConsentScope.WORLD_MODEL_WRITE
    
    # Agent permissions
    if scope.startswith("agent."):
        return ConsentScope.AGENT_EXECUTE
    
    # Legacy vault.read.* scopes -> map to WORLD_MODEL_READ
    if scope.startswith("vault.read.") or scope.startswith("vault_read_"):
        return ConsentScope.WORLD_MODEL_READ
    
    # Legacy vault.write.* scopes -> map to WORLD_MODEL_WRITE
    if scope.startswith("vault.write.") or scope.startswith("vault_write_"):
        return ConsentScope.WORLD_MODEL_WRITE
    
    # Custom/temporary scopes
    if scope.startswith("custom."):
        return ConsentScope.CUSTOM_TEMPORARY
    
    # Default to custom temporary
    return ConsentScope.CUSTOM_TEMPORARY


def get_scope_description(scope: str) -> str:
    """
    Get human-readable description for any scope.
    
    Uses DynamicScopeGenerator for attr.* scopes to provide
    dynamic descriptions. Falls back to hardcoded descriptions
    for legacy scopes.
    
    Args:
        scope: The scope string
        
    Returns:
        Human-readable description
    """
    generator = get_scope_generator()
    
    # Dynamic attr.* scopes - generate description from scope structure
    if generator.is_dynamic_scope(scope):
        display_info = generator.get_scope_display_info(scope)
        domain = display_info["domain"]
        attribute = display_info["attribute"]
        is_wildcard = display_info["is_wildcard"]
        
        if is_wildcard:
            return f"Access all your {domain} data"
        elif attribute:
            attr_display = attribute.replace("_", " ").title()
            return f"Access your {domain} - {attr_display}"
        else:
            return f"Access your {domain} domain"
    
    # Hardcoded descriptions for non-dynamic scopes
    descriptions = {
        "vault.owner": "Full access to your vault (master key)",
        "world_model.read": "Read your world model data",
        "world_model.write": "Write to your world model",
        "agent.kai.analyze": "Allow Kai agent to analyze your data",
        "agent.kai.execute": "Allow Kai agent to execute actions",
        # Legacy scopes (deprecated)
        "vault.read.food": "Read your food preferences (dietary, cuisines, budget) [DEPRECATED]",
        "vault.read.professional": "Read your professional profile (title, skills, experience) [DEPRECATED]",
        "vault.read.finance": "Read your financial data [DEPRECATED]",
        "vault.read.health": "Read your health and wellness data [DEPRECATED]",
        "vault.write.food": "Write to your food preferences [DEPRECATED]",
        "vault.write.professional": "Write to your professional profile [DEPRECATED]",
        "vault.write.finance": "Write to your financial data [DEPRECATED]",
        "vault_read_food": "Read your food preferences [DEPRECATED]",
        "vault_read_professional": "Read your professional profile [DEPRECATED]",
        "vault_write_food": "Write to your food preferences [DEPRECATED]",
        "vault_write_professional": "Write to your professional profile [DEPRECATED]",
    }
    
    return descriptions.get(scope, f"Access: {scope}")


def is_write_scope(scope: str) -> bool:
    """
    Determine if a scope implies write access.
    
    Args:
        scope: The scope string
        
    Returns:
        True if the scope grants write access
    """
    if scope == "vault.owner":
        return True
    
    if scope in ["world_model.write", "vault.write", "vault_write"]:
        return True
    
    if scope.startswith("vault.write.") or scope.startswith("vault_write_"):
        return True
    
    # For attr.* scopes, write is determined by context, not scope
    # The scope itself just grants access
    return False


def normalize_scope(scope: str) -> str:
    """
    Normalize scope string to canonical format.
    
    Converts legacy formats to canonical attr.{domain}.* format.
    
    Args:
        scope: The scope string to normalize
        
    Returns:
        Normalized scope string
    """
    generator = get_scope_generator()
    
    # Already in canonical format
    if generator.is_dynamic_scope(scope):
        return scope
    
    # Legacy vault.read.{domain} -> attr.{domain}.*
    if scope.startswith("vault.read."):
        domain = scope.replace("vault.read.", "")
        return f"attr.{domain}.*"
    
    if scope.startswith("vault_read_"):
        domain = scope.replace("vault_read_", "")
        return f"attr.{domain}.*"
    
    # Legacy vault.write.{domain} -> attr.{domain}.*
    if scope.startswith("vault.write."):
        domain = scope.replace("vault.write.", "")
        return f"attr.{domain}.*"
    
    if scope.startswith("vault_write_"):
        domain = scope.replace("vault_write_", "")
        return f"attr.{domain}.*"
    
    # Return as-is if can't normalize
    return scope
