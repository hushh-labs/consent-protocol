# hushh_mcp/constants.py

from enum import Enum

# ==================== Consent Scopes ====================

class ConsentScope(str, Enum):
    # Vault READ scopes (domain-specific per Bible)
    VAULT_READ_EMAIL = "vault.read.email"
    VAULT_READ_PHONE = "vault.read.phone"
    VAULT_READ_FINANCE = "vault.read.finance"
    VAULT_READ_CONTACTS = "vault.read.contacts"
    VAULT_READ_FOOD = "vault.read.food"
    VAULT_READ_PROFESSIONAL = "vault.read.professional"
    VAULT_READ_ALL = "vault.read.all"  # Session scope - all vault access

    # Vault WRITE scopes (domain-specific per Bible)
    VAULT_WRITE_FOOD = "vault.write.food"
    VAULT_WRITE_FINANCE = "vault.write.finance"
    VAULT_WRITE_PROFESSIONAL = "vault.write.professional"

    # Agent permissioning
    AGENT_SHOPPING_PURCHASE = "agent.shopping.purchase"
    AGENT_FINANCE_ANALYZE = "agent.finance.analyze"
    AGENT_IDENTITY_VERIFY = "agent.identity.verify"
    AGENT_SALES_OPTIMIZE = "agent.sales.optimize"
    AGENT_FOOD_COLLECT = "agent.food.collect"

    # Custom and extensible scopes
    CUSTOM_TEMPORARY = "custom.temporary"
    CUSTOM_SESSION_WRITE = "custom.session.write"

    @classmethod
    def list(cls):
        return [scope.value for scope in cls]


# ==================== Agent Configuration ====================

# Port assignments for agent-to-agent communication
AGENT_PORTS = {
    "agent_orchestrator": 10000,
    "agent_food_dining": 10001,
    "agent_professional_profile": 10002,
    "agent_identity": 10003,
    "agent_shopper": 10004,
}

# ==================== Token & Link Prefixes ====================

CONSENT_TOKEN_PREFIX = "HCT"  # Hushh Consent Token
TRUST_LINK_PREFIX = "HTL"     # Hushh Trust Link
AGENT_ID_PREFIX = "agent_"
USER_ID_PREFIX = "user_"

# ==================== Defaults (used if .env fails to load) ====================

# These are fallbacks — real defaults should come from config.py which loads from .env
DEFAULT_CONSENT_TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7     # 7 days
DEFAULT_TRUST_LINK_EXPIRY_MS = 1000 * 60 * 60 * 24 * 30        # 30 days

# ==================== Exports ====================

__all__ = [
    "ConsentScope",
    "CONSENT_TOKEN_PREFIX",
    "TRUST_LINK_PREFIX",
    "AGENT_ID_PREFIX",
    "USER_ID_PREFIX",
    "DEFAULT_CONSENT_TOKEN_EXPIRY_MS",
    "DEFAULT_TRUST_LINK_EXPIRY_MS",
    "AGENT_PORTS"
]
