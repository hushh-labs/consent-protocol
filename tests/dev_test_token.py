# tests/dev_test_token.py
"""
Development-only token generator for testing without Firebase.

WARNING: This should NEVER be used in production deployments.
This file generates test VAULT_OWNER tokens using MCP_DEVELOPER_TOKEN from .env

Usage:
    from tests.dev_test_token import generate_dev_vault_owner_token

    # Generate a test token
    token_info = generate_dev_vault_owner_token("test_user_id")
    headers = {"Authorization": f"Bearer {token_info['token']}"}

    # Use in API calls
    response = requests.post(
        "http://localhost:8000/api/kai/analyze",
        json={"user_id": "test_user_id", "ticker": "AAPL"},
        headers=headers
    )
"""

import logging
import os
import time

from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

logger = logging.getLogger(__name__)


def generate_dev_vault_owner_token(user_id: str) -> dict:
    """
    Generate a test VAULT_OWNER token for development/testing.

    Uses MCP_DEVELOPER_TOKEN from .env environment variable.

    Args:
        user_id: The user ID to assign to the token

    Returns:
        dict with keys:
            - token: The generated token string
            - user_id: The assigned user ID
            - expires_at: Unix timestamp of expiration

    Raises:
        HTTPException if MCP_DEVELOPER_TOKEN is not configured
    """
    # Check for developer token in environment
    mcp_developer_token = os.getenv("MCP_DEVELOPER_TOKEN")
    if not mcp_developer_token:
        logger.error(
            "MCP_DEVELOPER_TOKEN not found in environment. "
            "Add to .env file: MCP_DEVELOPER_TOKEN=your-dev-token"
        )
        raise HTTPException(
            status_code=500,
            detail=("MCP_DEVELOPER_TOKEN not configured. Set it in .env for development testing."),
        )

    # Import here to avoid circular import issues
    from hushh_mcp.consent.token import issue_token
    from hushh_mcp.constants import ConsentScope

    logger.info(f"Generating dev VAULT_OWNER token for user: {user_id}")

    # Issue token with MCP_DEVELOPER_TOKEN as agent_id, full vault.owner scope
    token_obj = issue_token(
        user_id=user_id,
        agent_id=mcp_developer_token,
        scope=ConsentScope.VAULT_OWNER,
        expires_in_ms=24 * 60 * 60 * 1000,  # 24 hours
    )

    return {
        "token": token_obj.token,
        "user_id": user_id,
        "agent_id": mcp_developer_token,
        "scope": ConsentScope.VAULT_OWNER.value,
        "expires_at": int(time.time() + (24 * 60 * 60)),  # Unix timestamp
    }


def generate_dev_agent_token(user_id: str, scope: str) -> dict:
    """
    Generate a scoped agent token for development/testing.

    Args:
        user_id: The user ID to assign to the token
        scope: The requested scope (e.g., "attr.financial.*", "agent.kai.analyze")

    Returns:
        dict with token and metadata
    """
    mcp_developer_token = os.getenv("MCP_DEVELOPER_TOKEN")
    if not mcp_developer_token:
        raise HTTPException(
            status_code=500,
            detail="MCP_DEVELOPER_TOKEN not configured",
        )

    from hushh_mcp.consent.token import issue_token

    token_obj = issue_token(
        user_id=user_id,
        agent_id=mcp_developer_token,
        scope=scope,
        expires_in_ms=24 * 60 * 60 * 1000,  # 24 hours
    )

    return {
        "token": token_obj.token,
        "user_id": user_id,
        "agent_id": mcp_developer_token,
        "scope": scope,
        "expires_at": int(time.time() + (24 * 60 * 60)),
    }
