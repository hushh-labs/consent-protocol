# api/middlewares/__init__.py
"""
Middleware modules for Hushh Consent Protocol API.

Available middlewares:
- rate_limit: Rate limiting for consent endpoints
- logging: Structured request logging
"""

from .rate_limit import get_rate_limit_key, limiter

__all__ = ["limiter", "get_rate_limit_key"]
