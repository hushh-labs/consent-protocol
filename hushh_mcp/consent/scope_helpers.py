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
    - World model scopes (world_model.read, world_model.write)
    - Agent permissions (agent.*)
    - vault.owner master scope
    - custom.* temporary scopes

    Args:
        scope: The scope string to resolve

    Returns:
        ConsentScope enum value
    """
    generator = get_scope_generator()

    # Master scope
    if scope == "vault.owner":
        return ConsentScope.VAULT_OWNER

    # Dynamic attr.* scopes - each domain gets isolated handling
    # CRITICAL: Do NOT map all attr.* to WORLD_MODEL_READ - this breaks isolation!
    # Instead, we use WORLD_MODEL_READ as a base but validate scope strings directly
    if generator.is_dynamic_scope(scope):
        domain, attribute_key, is_wildcard = generator.parse_scope(scope)
        # Return WORLD_MODEL_READ but scope validation will check exact domain match
        # This allows dynamic scopes while maintaining isolation
        return ConsentScope.WORLD_MODEL_READ

    # World model scopes
    if scope == "world_model.read":
        return ConsentScope.WORLD_MODEL_READ
    if scope == "world_model.write":
        return ConsentScope.WORLD_MODEL_WRITE

    # Agent permissions
    if scope.startswith("agent."):
        return ConsentScope.AGENT_EXECUTE

    # Custom/temporary scopes
    if scope.startswith("custom."):
        return ConsentScope.CUSTOM_TEMPORARY

    # API format (e.g. attr_food, world_model_read) - resolve via normalize then re-check
    dot_scope = _api_format_to_dot(scope)
    if dot_scope != scope:
        return resolve_scope_to_enum(dot_scope)

    # Default to custom temporary
    return ConsentScope.CUSTOM_TEMPORARY


def scope_matches(granted_scope: str, requested_scope: str) -> bool:
    """
    Check if a granted scope satisfies a requested scope.
    
    This is the KEY function for scope isolation. It ensures:
    - attr.financial.* ONLY matches attr.financial.* or attr.financial.{specific}
    - attr.financial.* does NOT match attr.food.* or other domains
    - world_model.read matches ALL attr.* scopes (full access)
    - vault.owner matches EVERYTHING (master key)
    
    Args:
        granted_scope: The scope that was granted (from token)
        requested_scope: The scope being requested (from operation)
    
    Returns:
        True if granted scope satisfies requested scope
    """
    # Exact match
    if granted_scope == requested_scope:
        return True
    
    # Master key: vault.owner grants everything
    if granted_scope == "vault.owner":
        return True
    
    # world_model.read grants access to ALL attr.* domains
    if granted_scope == "world_model.read":
        generator = get_scope_generator()
        if generator.is_dynamic_scope(requested_scope):
            return True
    
    # Wildcard matching for attr.* scopes
    generator = get_scope_generator()
    if generator.is_dynamic_scope(granted_scope) and generator.is_dynamic_scope(requested_scope):
        # Both are attr.* scopes - check domain isolation
        granted_domain, _, granted_wildcard = generator.parse_scope(granted_scope)
        requested_domain, _, _ = generator.parse_scope(requested_scope)
        
        # Domain must match for isolation
        if granted_domain != requested_domain:
            return False
        
        # If granted is wildcard (attr.domain.*), it matches all in that domain
        if granted_wildcard:
            return True
        
        # Otherwise, must be exact match (already checked above)
        return granted_scope == requested_scope
    
    return False



def get_scope_description(scope: str) -> str:
    """
    Get human-readable description for any scope.

    Uses DynamicScopeGenerator for attr.* scopes; hardcoded for world_model and agent scopes.

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
    
    # Hardcoded descriptions for non-dynamic scopes (world-model only; no legacy vault.*)
    descriptions = {
        "vault.owner": "Full access to your vault (master key)",
        "world_model.read": "Read your world model data",
        "world_model.write": "Write to your world model",
        "agent.kai.analyze": "Allow Kai agent to analyze your data",
        "agent.kai.execute": "Allow Kai agent to execute actions",
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

    if scope == "world_model.write":
        return True

    # For attr.* scopes, write is determined by context, not scope
    return False


# API format (underscore) -> dot notation for backend/MCP consistency
_API_FORMAT_TO_DOT = {
    "world_model_read": "world_model.read",
    "attr_food": "attr.food.*",
    "attr_professional": "attr.professional.*",
    "attr_financial": "attr.financial.*",
    "attr_health": "attr.health.*",
    "attr_kai_decisions": "attr.kai_decisions.*",
}

# Pattern for dynamic API-format attr scopes: attr_{domain}
_DYNAMIC_API_ATTR_RE = __import__("re").compile(r"^attr_([a-z][a-z0-9_]*)$")


def _api_format_to_dot(scope: str) -> str:
    """Convert API format (e.g. attr_food) to dot notation (attr.food.*).

    Supports both the static lookup table and dynamic attr_{domain} patterns.
    """
    static = _API_FORMAT_TO_DOT.get(scope)
    if static:
        return static
    m = _DYNAMIC_API_ATTR_RE.match(scope)
    if m:
        return f"attr.{m.group(1)}.*"
    return scope


def normalize_scope(scope: str) -> str:
    """
    Normalize scope string to canonical dot notation.

    Converts API format (e.g. attr_food) to dot notation (attr.food.*).
    Only world-model scopes are supported; legacy vault.* formats are not converted.

    Args:
        scope: The scope string to normalize

    Returns:
        Normalized scope string in dot notation
    """
    generator = get_scope_generator()

    # Already in canonical dot format
    if generator.is_dynamic_scope(scope) or scope in ("world_model.read", "world_model.write"):
        return scope

    # API format -> dot notation
    return _api_format_to_dot(scope)
