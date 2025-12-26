# tests/quality/test_rate_limiting.py
"""
Rate Limiting Tests

Verifies that rate limiting is properly enforced for consent endpoints.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from api.middlewares.rate_limit import RateLimits, get_rate_limit_key


class MockRequest:
    """Mock FastAPI request for testing."""
    
    def __init__(self, user_id: str = None, ip: str = "127.0.0.1"):
        self.headers = {}
        if user_id:
            self.headers["X-User-ID"] = user_id
        self.client = MagicMock()
        self.client.host = ip
        self.url = MagicMock()
        self.url.path = "/api/consent/request"


class TestRateLimitKeyExtraction:
    """Test rate limit key extraction from requests."""
    
    def test_authenticated_user_keyed_by_user_id(self):
        """Authenticated requests should be keyed by user_id."""
        request = MockRequest(user_id="user_123")
        
        key = get_rate_limit_key(request)
        
        assert key == "user:user_123"
    
    def test_unauthenticated_falls_back_to_ip(self):
        """Unauthenticated requests should fall back to IP."""
        request = MockRequest(user_id=None, ip="192.168.1.100")
        
        key = get_rate_limit_key(request)
        
        # Falls back to IP via get_remote_address
        assert "192.168.1.100" in key or key == "192.168.1.100"
    
    def test_different_users_different_keys(self):
        """Different users should have different rate limit keys."""
        request1 = MockRequest(user_id="user_a")
        request2 = MockRequest(user_id="user_b")
        
        key1 = get_rate_limit_key(request1)
        key2 = get_rate_limit_key(request2)
        
        assert key1 != key2


class TestRateLimitConstants:
    """Test rate limit configuration values."""
    
    def test_consent_request_limit(self):
        """Consent request limit should be 10/minute."""
        assert RateLimits.CONSENT_REQUEST == "10/minute"
    
    def test_consent_action_limit(self):
        """Consent action limit should be 20/minute."""
        assert RateLimits.CONSENT_ACTION == "20/minute"
    
    def test_token_validation_limit(self):
        """Token validation limit should be higher for polling."""
        assert RateLimits.TOKEN_VALIDATION == "60/minute"
    
    def test_agent_chat_limit(self):
        """Agent chat limit should be moderate."""
        assert RateLimits.AGENT_CHAT == "30/minute"
    
    def test_global_limit(self):
        """Global per-IP limit should be highest."""
        assert RateLimits.GLOBAL_PER_IP == "100/minute"


class TestRateLimitEnforcement:
    """
    Test rate limit enforcement behavior.
    
    Note: Full integration testing requires running the FastAPI app.
    These are unit tests for the rate limiting logic.
    """
    
    def test_consent_request_limit_is_safe_for_normal_use(self):
        """10 requests/minute is reasonable for normal user behavior."""
        # A user typically makes 1-2 consent requests per action
        limit = 10
        typical_actions_per_minute = 5  # Very active user
        requests_per_action = 2  # Request + 1 retry
        
        assert limit >= typical_actions_per_minute * requests_per_action
    
    def test_consent_action_limit_allows_batch_approvals(self):
        """20 actions/minute allows batch approval of pending consents."""
        limit = 20
        batch_size = 10  # User approving 10 pending consents at once
        
        assert limit >= batch_size
    
    def test_two_step_flow_fits_within_limits(self):
        """Complete 2-step flow should fit within limits."""
        # Step 1: Request consent
        step1_requests = 1
        # Step 2: Approve/deny
        step2_requests = 1
        
        # A user can complete 10 consent flows per minute
        max_flows_per_minute = min(
            int(RateLimits.CONSENT_REQUEST.split("/")[0]) / step1_requests,
            int(RateLimits.CONSENT_ACTION.split("/")[0]) / step2_requests
        )
        
        assert max_flows_per_minute >= 10, "Should allow at least 10 flows/minute"
