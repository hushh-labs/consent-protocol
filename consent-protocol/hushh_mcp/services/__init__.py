# hushh_mcp/services/__init__.py
"""
Service Layer
=============

Unified service layer for agent-mediated database access.
All vault operations should go through these services.
"""

from .vault_db import VaultDBService

__all__ = ["VaultDBService"]
