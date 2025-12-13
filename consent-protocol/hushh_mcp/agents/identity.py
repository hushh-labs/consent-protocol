# hushh_mcp/agents/identity.py

from hushh_mcp.operons.verify_email import verify_user_email
from hushh_mcp.trust.link import create_trust_link
from hushh_mcp.types import UserID, AgentID, ConsentScope, TrustLink


class HushhIdentityAgent:
    """
    Identity agent for verifying user identity (via email) and issuing scoped TrustLinks.
    """

    def __init__(self, agent_id: str = "agent_identity"):
        self.agent_id = agent_id

    def verify_user_identity(self, email: str) -> bool:
        print(f"🔍 Verifying email format: {email}")
        is_valid = verify_user_email(email)
        if is_valid:
            print(f"✅ Email verified: {email}")
        else:
            print(f"❌ Invalid email format: {email}")
        return is_valid

    def issue_trust_link(
        self,
        from_agent: AgentID,
        to_agent: AgentID,
        user_id: UserID,
        scope: ConsentScope
    ) -> TrustLink:
        print(f"🔐 Issuing TrustLink from '{from_agent}' to '{to_agent}' on scope '{scope}' for user '{user_id}'")

        if not scope or not scope.startswith("vault.") and not scope.startswith("agent."):
            raise ValueError(f"⚠️ Invalid or unsafe scope: '{scope}'")

        trust_link = create_trust_link(
            from_agent=from_agent,
            to_agent=to_agent,
            scope=scope,
            signed_by_user=user_id
        )

        print(f"✅ TrustLink created: {trust_link.signature[:8]}... (expires at {trust_link.expires_at})")
        return trust_link
