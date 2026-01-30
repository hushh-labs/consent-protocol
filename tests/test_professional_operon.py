"""
Tests for Professional Profile Operon
"""

from hushh_mcp.operons.professional.storage import store_professional_profile


def test_store_professional_profile_valid():
    result = store_professional_profile(
        user_id="user_test",
        title="Senior Engineer",
        skills=["Python", "AI"],
        experience_level="Senior",
        job_preferences=["Remote"]
    )
    assert result["status"] == "success"
    assert result["profile_summary"]["title"] == "Senior Engineer"
    assert result["profile_summary"]["skill_count"] == 2

def test_store_professional_profile_invalid_title():
    result = store_professional_profile(
        user_id="user_test",
        title="A",  # Too short
        skills=["Python"],
        experience_level="Junior",
        job_preferences=[]
    )
    assert result["status"] == "error"
    assert "Invalid title" in result["message"]

def test_store_professional_profile_no_skills():
    result = store_professional_profile(
        user_id="user_test",
        title="Developer",
        skills=[],
        experience_level="Mid",
        job_preferences=[]
    )
    assert result["status"] == "error"
    assert "At least one skill" in result["message"]
