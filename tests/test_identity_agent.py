from hushh_mcp.agents.identity import HushhIdentityAgent
from hushh_mcp.types import TrustLink

# Sample inputs
agent = HushhIdentityAgent()
user_id = "user_abc"
email = "user@hushh.ai"
delegatee = "agent_shopper"
scope = "vault.read.email"

# Run test
def test_identity_agent():
    print("🚀 Starting Identity Agent Test")

    # Step 1: Verify email
    is_verified = agent.verify_user_identity(email)
    assert is_verified, "❌ Email verification failed!"

    # Step 2: Issue TrustLink
    trust_link = agent.issue_trust_link(agent.agent_id, delegatee, user_id, scope)
    assert isinstance(trust_link, TrustLink), "❌ TrustLink object not returned!"
    assert trust_link.scope == scope, f"❌ Incorrect scope. Expected {scope}, got {trust_link.scope}"

    print("✅ All tests passed!")
    print("🔗 TrustLink:", trust_link)

# Run it
if __name__ == "__main__":
    test_identity_agent()
