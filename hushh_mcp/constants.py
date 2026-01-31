# hushh_mcp/constants.py

from enum import Enum

# ==================== Consent Scopes ====================

class ConsentScope(str, Enum):
    """
    Granular consent scopes for MCP-compliant data access.
    
    Design Principles:
    - VAULT_OWNER grants full world model access (user's own data)
    - External MCP requests must specify granular attr.* scopes
    - Attribute-level granularity for fine-grained consent
    """
    
    # ==================== VAULT OWNER (Full Access) ====================
    # "Master Scope" granted ONLY via BYOK login. 
    # Never granted to external agents.
    VAULT_OWNER = "vault.owner"
    
    # ==================== FINANCIAL ATTRIBUTES (Granular) ====================
    ATTR_FINANCIAL_RISK_PROFILE = "attr.financial.risk_profile"
    ATTR_FINANCIAL_HOLDINGS = "attr.financial.holdings"
    ATTR_FINANCIAL_PERFORMANCE = "attr.financial.performance"
    ATTR_FINANCIAL_DECISIONS = "attr.financial.decisions"
    
    # ==================== LIFESTYLE ATTRIBUTES ====================
    ATTR_LIFESTYLE_INTERESTS = "attr.lifestyle.interests"
    ATTR_LIFESTYLE_SPENDING = "attr.lifestyle.spending"
    ATTR_LIFESTYLE_LOCATIONS = "attr.lifestyle.locations"
    
    # ==================== PROFESSIONAL ATTRIBUTES ====================
    ATTR_PROFESSIONAL_SKILLS = "attr.professional.skills"
    ATTR_PROFESSIONAL_EXPERIENCE = "attr.professional.experience"
    
    # ==================== PORTFOLIO OPERATIONS ====================
    PORTFOLIO_IMPORT = "portfolio.import"
    PORTFOLIO_ANALYZE = "portfolio.analyze"
    PORTFOLIO_READ = "portfolio.read"
    
    # ==================== CHAT HISTORY ====================
    CHAT_HISTORY_READ = "chat.history.read"
    CHAT_HISTORY_WRITE = "chat.history.write"
    
    # ==================== EMBEDDINGS (Similarity Matching) ====================
    EMBEDDING_PROFILE_READ = "embedding.profile.read"
    EMBEDDING_PROFILE_COMPUTE = "embedding.profile.compute"
    
    # ==================== KAI AGENT OPERATIONS ====================
    AGENT_KAI_ANALYZE = "agent.kai.analyze"
    AGENT_KAI_DEBATE = "agent.kai.debate"
    AGENT_KAI_INFER = "agent.kai.infer"
    
    # ==================== EXTERNAL DATA SOURCES ====================
    # Hybrid mode - per-request consent
    EXTERNAL_SEC_FILINGS = "external.sec.filings"
    EXTERNAL_NEWS_API = "external.news.api"
    EXTERNAL_MARKET_DATA = "external.market.data"
    EXTERNAL_RENAISSANCE = "external.renaissance.data"
    
    # ==================== LEGACY SCOPES (Deprecated) ====================
    # Kept for backward compatibility during migration
    VAULT_READ_FINANCE = "vault.read.finance"
    VAULT_READ_FOOD = "vault.read.food"
    VAULT_READ_PROFESSIONAL = "vault.read.professional"
    VAULT_WRITE_FINANCE = "vault.write.finance"
    VAULT_WRITE_FOOD = "vault.write.food"
    VAULT_WRITE_PROFESSIONAL = "vault.write.professional"
    VAULT_READ_RISK_PROFILE = "vault.read.risk_profile"
    VAULT_READ_DECISION_HISTORY = "vault.read.decision_history"
    VAULT_WRITE_RISK_PROFILE = "vault.write.risk_profile"
    VAULT_WRITE_DECISION = "vault.write.decision"

    @classmethod
    def list(cls):
        return [scope.value for scope in cls]
    
    @classmethod
    def financial_scopes(cls):
        """Return all financial attribute scopes."""
        return [
            cls.ATTR_FINANCIAL_RISK_PROFILE,
            cls.ATTR_FINANCIAL_HOLDINGS,
            cls.ATTR_FINANCIAL_PERFORMANCE,
            cls.ATTR_FINANCIAL_DECISIONS,
        ]
    
    @classmethod
    def lifestyle_scopes(cls):
        """Return all lifestyle attribute scopes."""
        return [
            cls.ATTR_LIFESTYLE_INTERESTS,
            cls.ATTR_LIFESTYLE_SPENDING,
            cls.ATTR_LIFESTYLE_LOCATIONS,
        ]


# ==================== Agent Configuration ====================

# Port assignments for agent-to-agent communication
AGENT_PORTS = {
    "agent_orchestrator": 10000,
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
