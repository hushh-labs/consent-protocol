# hushh_mcp/services/__init__.py
"""
Service Layer
=============

Unified service layer for agent-mediated database access.
All database operations should go through these services.

CONSENT-FIRST ARCHITECTURE:
    All services validate consent tokens before database access.
    API routes should use these services, never access database directly.
"""

from .vault_db import VaultDBService
from .consent_db import ConsentDBService
from .investor_db import InvestorDBService
from .user_investor_profile_db import UserInvestorProfileService
from .vault_keys_service import VaultKeysService
from .kai_decisions_service import KaiDecisionsService

__all__ = [
    "VaultDBService",
    "ConsentDBService", 
    "InvestorDBService",
    "UserInvestorProfileService",
    "VaultKeysService",
    "KaiDecisionsService"
]
