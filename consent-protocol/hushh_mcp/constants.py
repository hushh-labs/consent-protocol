# hushh_mcp/constants.py

from enum import Enum

# ==================== Consent Scopes ====================

class ConsentScope(str, Enum):
    # Vault READ scopes (domain-specific per Bible)
    VAULT_READ_FINANCE = "vault.read.finance"
    VAULT_READ_FOOD = "vault.read.food"
    VAULT_READ_PROFESSIONAL = "vault.read.professional"
    
    # "Master Scope" granted ONLY via BYOK login. 
    # Never granted to external agents.
    VAULT_OWNER = "vault.owner"

    # Vault WRITE scopes (domain-specific per Bible)
    VAULT_WRITE_FOOD = "vault.write.food"
    VAULT_WRITE_FINANCE = "vault.write.finance"
    VAULT_WRITE_PROFESSIONAL = "vault.write.professional"

    # Agent permissioning
    AGENT_SHOPPING_PURCHASE = "agent.shopping.purchase"
    AGENT_FINANCE_ANALYZE = "agent.finance.analyze"
    AGENT_SALES_OPTIMIZE = "agent.sales.optimize"
    AGENT_FOOD_COLLECT = "agent.food.collect"

    # Custom and extensible scopes
    CUSTOM_TEMPORARY = "custom.temporary"
    CUSTOM_SESSION_WRITE = "custom.session.write"

    # ==================== KAI SCOPES ====================
    # Vault operations for Kai
    VAULT_READ_RISK_PROFILE = "vault.read.risk_profile"
    VAULT_READ_DECISION_HISTORY = "vault.read.decision_history"
    VAULT_WRITE_RISK_PROFILE = "vault.write.risk_profile"
    VAULT_WRITE_DECISION = "vault.write.decision"

    # Kai agent operations
    AGENT_KAI_ANALYZE = "agent.kai.analyze"
    AGENT_KAI_DEBATE = "agent.kai.debate"

    # External data sources (Hybrid mode - per-request consent)
    EXTERNAL_SEC_FILINGS = "external.sec.filings"
    EXTERNAL_NEWS_API = "external.news.api"
    EXTERNAL_MARKET_DATA = "external.market.data"

    @classmethod
    def list(cls):
        return [scope.value for scope in cls]


# ==================== Agent Configuration ====================

# Port assignments for agent-to-agent communication
AGENT_PORTS = {
    "agent_orchestrator": 10000,
    "agent_food_dining": 10001,
    "agent_professional_profile": 10002,
    "agent_shopper": 10004,
    "agent_kai": 10005,  # Kai investment analysis agent
}

# ==================== Token & Link Prefixes ====================

CONSENT_TOKEN_PREFIX = "HCT"  # noqa: S105 - Hushh Consent Token
TRUST_LINK_PREFIX = "HTL"  # noqa: S105 - Hushh Trust Link
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
