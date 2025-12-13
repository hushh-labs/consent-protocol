# tests/test_agents.py

import pytest
from hushh_mcp.agents.identity import HushhIdentityAgent
from hushh_mcp.agents.shopping import HushhShoppingAgent
from hushh_mcp.operons.verify_email import verify_user_email
from hushh_mcp.trust.link import is_trusted_for_scope
from hushh_mcp.consent.token import issue_token, revoke_token, validate_token
from hushh_mcp.constants import ConsentScope


USER_ID = "user_alice"
IDENTITY_AGENT_ID = "agent_identity"
SHOPPING_AGENT_ID = "agent_shopper"
EMAIL = "alice@hushh.ai"
INVALID_EMAIL = "alice@"
SCOPE = ConsentScope.VAULT_READ_EMAIL


def test_email_verification_valid():
    assert verify_user_email(EMAIL) is True

def test_email_verification_invalid():
    assert verify_user_email(INVALID_EMAIL) is False

def test_identity_agent_trustlink_issuance():
    identity_agent = HushhIdentityAgent(agent_id=IDENTITY_AGENT_ID)

    assert identity_agent.verify_user_identity(EMAIL) is True

    trust = identity_agent.issue_trust_link(
        from_agent=IDENTITY_AGENT_ID,
        to_agent=SHOPPING_AGENT_ID,
        user_id=USER_ID,
        scope=SCOPE
    )

    assert trust.from_agent == IDENTITY_AGENT_ID
    assert trust.to_agent == SHOPPING_AGENT_ID
    assert trust.signed_by_user == USER_ID
    assert is_trusted_for_scope(trust, SCOPE) is True


def test_shopping_agent_with_valid_consent():
    token_obj = issue_token(USER_ID, SHOPPING_AGENT_ID, SCOPE)
    shopping_agent = HushhShoppingAgent(agent_id=SHOPPING_AGENT_ID)

    deals = shopping_agent.search_deals(USER_ID, token_obj.token)
    assert isinstance(deals, list)
    assert len(deals) > 0
    assert all(isinstance(deal, str) for deal in deals)


def test_shopping_agent_rejects_revoked_token():
    token_obj = issue_token(USER_ID, SHOPPING_AGENT_ID, SCOPE)
    revoke_token(token_obj.token)

    shopping_agent = HushhShoppingAgent(agent_id=SHOPPING_AGENT_ID)

    with pytest.raises(PermissionError, match="Consent validation failed"):
        shopping_agent.search_deals(USER_ID, token_obj.token)


def test_shopping_agent_rejects_wrong_user():
    token_obj = issue_token("user_bob", SHOPPING_AGENT_ID, SCOPE)
    shopping_agent = HushhShoppingAgent(agent_id=SHOPPING_AGENT_ID)

    with pytest.raises(PermissionError, match="Token user ID does not match"):
        shopping_agent.search_deals(USER_ID, token_obj.token)
