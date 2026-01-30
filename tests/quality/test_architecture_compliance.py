"""
Architecture Compliance Tests - RUN ON EVERY PR

These tests scan the codebase for violations of consent-first patterns.
Failing these tests will BLOCK the PR from merging.

CRITICAL: These tests enforce our core architecture rules:
1. API routes must use service layer (not direct Supabase)
2. All vault operations must validate consent tokens
3. No backdoors or bypasses allowed
"""
import os
import shutil
import subprocess

import pytest


class TestServiceLayerCompliance:
    """Ensure API routes never access Supabase directly."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set working directory to consent-protocol root."""
        self.cwd = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    
    def test_no_direct_supabase_in_routes(self):
        """API routes must use service layer, not get_supabase()."""
        grep_path = shutil.which("grep")
        assert grep_path, "grep not found on PATH"
        result = subprocess.run(  # noqa: S603
            [grep_path, "-r", "get_supabase()", "api/routes/"],
            capture_output=True,
            text=True,
            cwd=self.cwd
        )
        violations = result.stdout.strip()
        
        assert not violations, f"""
❌ CONSENT VIOLATION: Direct Supabase access in API routes!

API routes must use service layer classes, not get_supabase() directly.

WRONG:
    from db.supabase_client import get_supabase
    supabase = get_supabase()
    data = supabase.table('vault_food').select('*').execute()

CORRECT:
    from hushh_mcp.services import VaultDBService
    service = VaultDBService()
    data = await service.get_encrypted_fields(
        user_id=user_id,
        domain="food",
        consent_token=consent_token  # Required!
    )

See: docs/reference/database_service_layer.md

Violations found:
{violations}
"""

    def test_no_direct_db_import_in_routes(self):
        """API routes must not import db.supabase_client directly."""
        grep_path = shutil.which("grep")
        assert grep_path, "grep not found on PATH"
        result = subprocess.run(  # noqa: S603
            [
                grep_path,
                "-rE",
                r"from db\.(supabase_client|connection) import",
                "api/routes/",
            ],
            capture_output=True,
            text=True,
            cwd=self.cwd
        )
        violations = result.stdout.strip()
        
        assert not violations, f"""
❌ FORBIDDEN IMPORT: Direct database import in API routes!

API routes must import services, not database clients.

WRONG:
    from db.supabase_client import get_supabase

CORRECT:
    from hushh_mcp.services import VaultDBService

Violations found:
{violations}
"""


class TestConsentPatternCompliance:
    """Ensure consent patterns are followed."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set working directory to consent-protocol root."""
        self.cwd = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    
    def test_service_files_exist(self):
        """All required service files must exist."""
        required_services = [
            "hushh_mcp/services/vault_db.py",
            "hushh_mcp/services/consent_db.py",
            "hushh_mcp/services/investor_db.py",
            "hushh_mcp/services/vault_keys_service.py",
            "hushh_mcp/services/kai_decisions_service.py",
            "hushh_mcp/services/user_investor_profile_db.py",
        ]
        
        for service in required_services:
            path = os.path.join(self.cwd, service)
            assert os.path.exists(path), f"""
❌ MISSING SERVICE: {service}

This service file is required for architecture compliance.
"""
