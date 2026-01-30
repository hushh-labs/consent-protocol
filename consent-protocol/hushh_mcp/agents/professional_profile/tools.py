"""
Professional Agent Tools

ADK Tools for the Professional Profile Agent.
Handles secure vault storage of career data.
"""

from typing import Any, Dict, List

from hushh_mcp.constants import ConsentScope
from hushh_mcp.hushh_adk.context import HushhContext
from hushh_mcp.hushh_adk.tools import hushh_tool
from hushh_mcp.operons.professional.storage import store_professional_profile


@hushh_tool(scope=ConsentScope.VAULT_WRITE_PROFESSIONAL, name="save_professional_profile")
def save_professional_profile(
    professional_title: str,
    skills: List[str],
    experience_level: str,
    job_preferences: List[str]
) -> Dict[str, Any]:
    """
    Save the collected professional profile to the secure vault.
    
    Args:
        professional_title: Job title (e.g. 'Software Engineer')
        skills: List of technical skills
        experience_level: Years of experience or level description
        job_preferences: Work preferences (Remote, FTE, etc.)
    """
    ctx = HushhContext.current()
    if not ctx:
        raise PermissionError("No active context")
        
    print(f"🔧 Tool invoked: save_professional_profile for {ctx.user_id}")
    
    # Delegate business logic to the Operon
    return store_professional_profile(
        user_id=ctx.user_id,
        title=professional_title,
        skills=skills,
        experience_level=experience_level,
        job_preferences=job_preferences
    )
