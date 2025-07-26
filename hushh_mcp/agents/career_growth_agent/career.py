# hushh_mcp/agents/career_growth/career.py

from hushh_mcp.consent.token import validate_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID
from .linkedin import parse_linkedin_zip

class CareerGrowthAgent:
    """
    Extracts skills and experience from LinkedIn data after verifying consent.
    """

    required_scope = ConsentScope.CUSTOM_LINKEDIN_UPLOAD

    def __init__(self, agent_id: str = "agent_career_growth"):
        self.agent_id = agent_id

    def extract_career_data(self, user_id: UserID, token_str: str, file_bytes: bytes):
        is_valid, reason, token = validate_token(token_str, expected_scope=self.required_scope)

        if not is_valid:
            raise PermissionError(f"Consent validation failed: {reason}")
        if token.user_id != user_id:
            raise PermissionError("Token user ID does not match the provided user")

        print(f"✅ Consent verified for user {user_id} on scope {token.scope} for agent {self.agent_id}")
        skills, experience = parse_linkedin_zip(file_bytes)
        return skills, experience
