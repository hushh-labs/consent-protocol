"""
Professional Profile Agent - Conversational Data Collection 💼

Collects user's professional profile through a multi-turn conversation.
Follows the same pattern as the Food Agent.

**Consent Protocol Compliant:**
- Issues consent token when user confirms save
- Validates token before vault access
- Uses TrustLinks for agent delegation
"""

import logging
from typing import Dict, List, Optional

from ...constants import ConsentScope
from ...consent.token import issue_token, validate_token

logger = logging.getLogger(__name__)

# ============================================================================
# SKILL OPTIONS
# ============================================================================

SKILL_CATEGORIES = {
    "languages": ["Python", "JavaScript", "TypeScript", "Java", "C#", "Go", "Rust", "C++"],
    "frontend": ["React", "Next.js", "Vue", "Angular", "Svelte", "HTML/CSS", "Tailwind"],
    "backend": ["Node.js", ".NET", "Django", "Flask", "FastAPI", "Spring Boot", "Express"],
    "cloud": ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD"],
    "data_ai": ["Machine Learning", "Data Science", "SQL", "NoSQL", "AI/LLM", "Data Engineering"],
}

EXPERIENCE_LEVELS = ["Entry Level (0-2 years)", "Mid Level (3-5 years)", "Senior (5-8 years)", "Staff/Principal (8+ years)"]

JOB_TYPES = ["Full-time", "Contract", "Part-time", "Freelance", "Consulting"]

# ============================================================================
# PROFESSIONAL PROFILE AGENT CLASS
# ============================================================================

class ProfessionalProfileAgent:
    """
    Conversational agent for collecting professional profile data.
    
    Flow:
    1. Greeting -> Professional Title
    2. Title -> Skills Selection
    3. Skills -> Experience Level
    4. Experience -> Job Preferences
    5. Job Prefs -> Confirmation
    """
    
    def __init__(self):
        self.manifest = {
            "name": "agent_professional_profile",
            "version": "1.0.0",
            "description": "Collects professional profile data via conversation",
            "scopes_required": [
                ConsentScope.VAULT_READ_PROFESSIONAL.value,
                ConsentScope.VAULT_WRITE_PROFESSIONAL.value
            ]
        }
        logger.info("💼 Professional Profile Agent initialized")
    
    def handle_message(
        self,
        message: str,
        user_id: str,
        session_state: Optional[Dict] = None
    ) -> Dict[str, any]:
        """
        Handle conversational message for profile collection.
        """
        state = session_state or {"step": "greeting", "collected": {}}
        
        response = self._process_conversation_step(message, state, user_id)
        
        return {
            "response": response["message"],
            "session_state": response["state"],
            "collected_data": state.get("collected", {}),
            "is_complete": response.get("is_complete", False),
            "needs_consent": response.get("needs_consent", False),
            "consent_scope": response.get("consent_scope", None),
            # Consent token (issued when user confirms save)
            "consent_token": response.get("consent_token"),
            "consent_issued_at": response.get("consent_issued_at"),
            "consent_expires_at": response.get("consent_expires_at"),
            # UI hints for frontend
            "ui_type": response.get("ui_type"),
            "options": response.get("options"),
            "allow_custom": response.get("allow_custom"),
            "allow_none": response.get("allow_none")
        }
    
    def _process_conversation_step(
        self,
        message: str,
        state: Dict,
        user_id: str
    ) -> Dict:
        """Route to appropriate step handler."""
        step = state.get("step", "greeting")
        
        handlers = {
            "greeting": self._handle_greeting,
            "title": self._handle_title_input,
            "skills": self._handle_skills_input,
            "experience": self._handle_experience_input,
            "job_type": self._handle_job_type_input,
            "confirm": lambda m, s: self._handle_confirmation(m, s, user_id),
            "complete": self._handle_complete_state
        }
        
        handler = handlers.get(step, self._handle_greeting)
        return handler(message, state)
    
    def _parse_bulk_input(self, text: str, state: Dict) -> Dict[str, any]:
        """
        Smart parsing: Extract professional profile fields from any text.
        Returns dict with found fields and list of missing required fields.
        """
        text_lower = text.lower()
        collected = state.get("collected", {})
        
        # 1. Try to extract professional title
        if not collected.get("professional_title"):
            # Look for common title patterns
            title_patterns = [
                r'(?:i am|i\'m|as a|work as|position:?|title:?|role:?)\s*a?\s*([A-Za-z\s]+(?:engineer|developer|scientist|manager|analyst|designer|architect|lead|director|specialist|consultant|coordinator))',
                r'(senior|junior|lead|principal|staff)?\s*(software|data|product|project|machine learning|ai|frontend|backend|full[- ]?stack|devops|cloud|mobile|web)?\s*(engineer|developer|scientist|manager|analyst|designer|architect)',
            ]
            import re
            for pattern in title_patterns:
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    title = match.group(0).strip().title()
                    collected["professional_title"] = title
                    break
        
        # 2. Extract skills (look for tech keywords)
        known_skills = [
            "python", "javascript", "typescript", "java", "c#", "go", "rust", "c++",
            "react", "next.js", "vue", "angular", "svelte", "node.js", ".net",
            "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
            "machine learning", "data science", "sql", "nosql", "ai", "llm",
            "fastapi", "django", "flask", "spring boot", "express"
        ]
        if not collected.get("skills"):
            found_skills = []
            for skill in known_skills:
                if skill in text_lower:
                    found_skills.append(skill.title() if len(skill) > 3 else skill.upper())
            if found_skills:
                collected["skills"] = list(set(found_skills))
        
        # 3. Extract experience level
        if not collected.get("experience_level"):
            exp_patterns = [
                (r'(\d+)\+?\s*years?', lambda m: int(m.group(1))),
                (r'entry[- ]?level|junior|new grad', lambda m: 1),
                (r'senior|sr\.?', lambda m: 6),
                (r'lead|principal|staff', lambda m: 8),
            ]
            import re
            for pattern, years_func in exp_patterns:
                match = re.search(pattern, text_lower)
                if match:
                    years = years_func(match) if callable(years_func) else years_func
                    if years <= 2:
                        collected["experience_level"] = "Entry Level (0-2 years)"
                    elif years <= 5:
                        collected["experience_level"] = "Mid Level (3-5 years)"
                    elif years <= 8:
                        collected["experience_level"] = "Senior (5-8 years)"
                    else:
                        collected["experience_level"] = "Staff/Principal (8+ years)"
                    break
        
        # 4. Extract job preferences
        if not collected.get("job_preferences"):
            job_keywords = {
                "full-time": ["full-time", "full time", "permanent", "fte"],
                "contract": ["contract", "contractor", "c2c", "corp to corp"],
                "part-time": ["part-time", "part time"],
                "freelance": ["freelance", "freelancer", "gig"],
                "remote": ["remote", "work from home", "wfh"],
            }
            found_prefs = []
            for pref, keywords in job_keywords.items():
                for kw in keywords:
                    if kw in text_lower:
                        found_prefs.append(pref.title())
                        break
            if found_prefs:
                collected["job_preferences"] = list(set(found_prefs))
        
        state["collected"] = collected
        
        # Determine what's missing
        missing = []
        if not collected.get("professional_title"):
            missing.append("professional_title")
        if not collected.get("skills"):
            missing.append("skills")
        if not collected.get("experience_level"):
            missing.append("experience_level")
        if not collected.get("job_preferences"):
            missing.append("job_preferences")
        
        return {"collected": collected, "missing": missing, "state": state}
    
    def _handle_greeting(self, message: str, state: Dict) -> Dict:
        """Handle initial greeting and smart parse any provided text."""
        # Try to extract data from the greeting message itself
        if len(message) > 20:  # Substantial input provided
            result = self._parse_bulk_input(message, state)
            state = result["state"]
            missing = result["missing"]
            collected = result["collected"]
            
            # Check what was extracted
            found_items = []
            if collected.get("professional_title"):
                found_items.append(f"💼 Title: **{collected['professional_title']}**")
            if collected.get("skills"):
                found_items.append(f"🛠️ Skills: {', '.join(collected['skills'][:4])}")
            if collected.get("experience_level"):
                found_items.append(f"📊 Experience: {collected['experience_level']}")
            if collected.get("job_preferences"):
                found_items.append(f"🎯 Looking for: {', '.join(collected['job_preferences'])}")
            
            if len(missing) == 0:
                # All found! Go straight to confirmation
                state["step"] = "confirm"
                return {
                    "message": (
                        "🎉 Great! I was able to extract your profile from your input:\n\n"
                        + "\n".join(found_items) + "\n\n"
                        "---\n\n"
                        "Is this correct? I can save this to your encrypted vault."
                    ),
                    "state": state,
                    "ui_type": "buttons",
                    "options": ["💾 Save Preference", "✏️ Edit"],
                    "needs_consent": True,
                    "consent_scope": [ConsentScope.VAULT_WRITE_PROFESSIONAL.value]
                }
            
            # Some items found, some missing
            if found_items:
                if "professional_title" in missing:
                    state["step"] = "title"
                    return {
                        "message": (
                            "👋 I found some info from your input:\n\n"
                            + "\n".join(found_items) + "\n\n"
                            "I still need your **professional title**. What's your current or desired job title?"
                        ),
                        "state": state
                    }
                elif "skills" in missing:
                    state["step"] = "skills"
                    all_skills = []
                    for cat, skills in SKILL_CATEGORIES.items():
                        all_skills.extend(skills[:3])
                    return {
                        "message": (
                            "👋 I found some info from your input:\n\n"
                            + "\n".join(found_items) + "\n\n"
                            "What are your **top skills**?"
                        ),
                        "state": state,
                        "ui_type": "checkbox",
                        "options": all_skills[:12],
                        "allow_custom": True
                    }
                elif "experience_level" in missing:
                    state["step"] = "experience"
                    return {
                        "message": (
                            "👋 I found some info from your input:\n\n"
                            + "\n".join(found_items) + "\n\n"
                            "What's your **experience level**?"
                        ),
                        "state": state,
                        "ui_type": "checkbox",
                        "options": EXPERIENCE_LEVELS,
                        "allow_custom": False
                    }
                else:  # job_preferences missing
                    state["step"] = "job_type"
                    return {
                        "message": (
                            "👋 I found some info from your input:\n\n"
                            + "\n".join(found_items) + "\n\n"
                            "What type of **work arrangement** are you looking for?"
                        ),
                        "state": state,
                        "ui_type": "checkbox",
                        "options": JOB_TYPES,
                        "allow_custom": False
                    }
        
        # Standard greeting - no data provided
        state["step"] = "title"
        return {
            "message": (
                "👋 Hi! I'm your Professional Profile assistant. I'll help you build "
                "your career profile for personalized job and networking recommendations.\n\n"
                "**Tip:** You can paste your resume or describe yourself in one message and "
                "I'll extract the relevant info automatically!\n\n"
                "Let's start with your **professional title**.\n\n"
                "What's your current or desired job title? (e.g., 'Senior Software Engineer', 'Data Scientist')"
            ),
            "state": state
        }
    
    def _handle_title_input(self, message: str, state: Dict) -> Dict:
        """Store professional title and ask for missing fields. Smart parse on bulk input."""
        # ALWAYS try smart parsing first if substantial input
        if len(message) > 50:
            result = self._parse_bulk_input(message, state)
            state = result["state"]
            missing = result["missing"]
            collected = result["collected"]
            
            # Route to appropriate next step based on what's missing
            return self._route_to_next_missing(state, collected, missing)
        
        # Short input - treat as title
        title = message.strip()
        
        if len(title) < 3:
            return {
                "message": "Please enter a valid job title (at least 3 characters).",
                "state": state
            }
        
        # Store title and check what else is missing
        if "collected" not in state:
            state["collected"] = {}
        state["collected"]["professional_title"] = title
        
        # Now check what's still missing
        collected = state["collected"]
        missing = []
        if not collected.get("skills"):
            missing.append("skills")
        if not collected.get("experience_level"):
            missing.append("experience_level")
        if not collected.get("job_preferences"):
            missing.append("job_preferences")
        
        return self._route_to_next_missing(state, collected, missing)
    
    def _route_to_next_missing(self, state: Dict, collected: Dict, missing: List[str]) -> Dict:
        """Route to the next missing field or confirmation."""
        # Build summary of what we have
        found_items = []
        if collected.get("professional_title"):
            # Truncate long titles for display
            title = collected["professional_title"]
            display_title = title[:50] + "..." if len(title) > 50 else title
            found_items.append(f"💼 Title: **{display_title}**")
        if collected.get("skills"):
            skills_display = collected["skills"][:4]
            found_items.append(f"🛠️ Skills: {', '.join(skills_display)}")
        if collected.get("experience_level"):
            found_items.append(f"📊 Experience: {collected['experience_level']}")
        if collected.get("job_preferences"):
            found_items.append(f"🎯 Looking for: {', '.join(collected['job_preferences'])}")
        
        found_summary = "\n".join(found_items) if found_items else ""
        
        if len(missing) == 0:
            # All done! Go to confirmation
            state["step"] = "confirm"
            
            # Build proper summary for confirmation
            title = collected.get("professional_title", "N/A")
            skills = collected.get("skills", [])
            experience = collected.get("experience_level", "N/A")
            job_prefs = collected.get("job_preferences", [])
            
            return {
                "message": (
                    "🎉 **Profile Complete!**\n\n"
                    "📋 **Your Professional Profile Summary:**\n\n"
                    f"💼 Title: **{title[:60]}{'...' if len(title) > 60 else ''}**\n"
                    f"🛠️ Skills: {', '.join(skills[:5])}" + (f" +{len(skills) - 5} more" if len(skills) > 5 else "") + "\n"
                    f"📊 Experience: {experience}\n"
                    f"🎯 Looking for: {', '.join(job_prefs) if job_prefs else 'N/A'}\n\n"
                    "---\n\n"
                    "Save to your encrypted vault?"
                ),
                "state": state,
                "ui_type": "buttons",
                "options": ["💾 Save Preference", "✏️ Edit"],
                "needs_consent": True,
                "consent_scope": [ConsentScope.VAULT_WRITE_PROFESSIONAL.value]
            }
        
        # Ask for the first missing field
        if "skills" in missing:
            state["step"] = "skills"
            all_skills = []
            for cat, skills in SKILL_CATEGORIES.items():
                all_skills.extend(skills[:3])
            return {
                "message": (
                    (f"✅ Found:\n{found_summary}\n\n" if found_summary else "") +
                    "What are your **top skills**?\n\n"
                    "Select all that apply:"
                ),
                "state": state,
                "ui_type": "checkbox",
                "options": all_skills[:12],
                "allow_custom": True
            }
        elif "experience_level" in missing:
            state["step"] = "experience"
            return {
                "message": (
                    (f"✅ Found:\n{found_summary}\n\n" if found_summary else "") +
                    "What's your **experience level**?"
                ),
                "state": state,
                "ui_type": "checkbox",
                "options": EXPERIENCE_LEVELS,
                "allow_custom": False
            }
        else:  # job_preferences missing
            state["step"] = "job_type"
            return {
                "message": (
                    (f"✅ Found:\n{found_summary}\n\n" if found_summary else "") +
                    "What type of **work arrangement** are you looking for?"
                ),
                "state": state,
                "ui_type": "checkbox",
                "options": JOB_TYPES,
                "allow_custom": False
            }
    
    def _handle_skills_input(self, message: str, state: Dict) -> Dict:
        """Parse and store skills. Smart parse on bulk input."""
        # Try smart parsing first for bulk input
        if len(message) > 50:
            result = self._parse_bulk_input(message, state)
            state = result["state"]
            missing = result["missing"]
            collected = result["collected"]
            return self._route_to_next_missing(state, collected, missing)
        
        # Handle comma-separated skills
        raw_skills = [s.strip() for s in message.split(",")]
        skills = [s for s in raw_skills if len(s) > 1]
        
        if not skills:
            return {
                "message": "Please select at least one skill.",
                "state": state,
                "ui_type": "checkbox",
                "options": list(SKILL_CATEGORIES["languages"]) + list(SKILL_CATEGORIES["frontend"][:3]),
                "allow_custom": True
            }
        
        if "collected" not in state:
            state["collected"] = {}
        state["collected"]["skills"] = skills
        
        # Check what's still missing
        collected = state["collected"]
        missing = []
        if not collected.get("experience_level"):
            missing.append("experience_level")
        if not collected.get("job_preferences"):
            missing.append("job_preferences")
        
        return self._route_to_next_missing(state, collected, missing)
    
    def _handle_experience_input(self, message: str, state: Dict) -> Dict:
        """Parse experience level. Smart parse on bulk input."""
        # Try smart parsing first for bulk input
        if len(message) > 50:
            result = self._parse_bulk_input(message, state)
            state = result["state"]
            missing = result["missing"]
            collected = result["collected"]
            return self._route_to_next_missing(state, collected, missing)
        
        experience = message.strip()
        
        # Try to match to known levels
        matched = None
        for level in EXPERIENCE_LEVELS:
            if experience.lower() in level.lower() or level.lower().startswith(experience.lower()[:5]):
                matched = level
                break
        
        if "collected" not in state:
            state["collected"] = {}
        state["collected"]["experience_level"] = matched or experience
        
        # Check what's still missing
        collected = state["collected"]
        missing = []
        if not collected.get("job_preferences"):
            missing.append("job_preferences")
        
        return self._route_to_next_missing(state, collected, missing)
    
    def _handle_job_type_input(self, message: str, state: Dict) -> Dict:
        """Parse job type and show confirmation."""
        raw_types = [t.strip() for t in message.split(",")]
        job_types = [t for t in raw_types if len(t) > 2]
        
        if not job_types:
            job_types = ["Full-time"]  # Default
        
        state["collected"]["job_preferences"] = job_types
        state["step"] = "confirm"
        
        # Build summary
        title = state["collected"].get("professional_title", "N/A")
        skills = state["collected"].get("skills", [])
        experience = state["collected"].get("experience_level", "N/A")
        
        return {
            "message": (
                f"✅ Looking for: **{', '.join(job_types)}**\n\n"
                "---\n"
                "📋 **Your Professional Profile Summary:**\n\n"
                f"💼 Title: **{title}**\n"
                f"🛠️ Skills: {', '.join(skills[:5])}" + (f" +{len(skills) - 5} more" if len(skills) > 5 else "") + "\n"
                f"📊 Experience: {experience}\n"
                f"🎯 Looking for: {', '.join(job_types)}\n\n"
                "---\n\n"
                "To save your profile, I'll establish a **TrustLink** to securely store this data in your encrypted vault."
            ),
            "state": state,
            "ui_type": "buttons",
            "options": ["💾 Save Preference", "✏️ Edit"],
            "needs_consent": True,
            "consent_scope": [
                ConsentScope.VAULT_WRITE_PROFESSIONAL.value
            ]
        }
    
    def _handle_confirmation(self, message: str, state: Dict, user_id: str = "unknown") -> Dict:
        """Handle save or edit action - ISSUES CONSENT TOKEN on save."""
        msg_lower = message.lower().strip()
        
        if msg_lower in ["save", "yes", "confirm", "💾 save & establish trustlink"]:
            # === CONSENT PROTOCOL: Issue signed token ===
            consent_token = issue_token(
                user_id=user_id,
                agent_id=self.manifest["name"],
                scope=ConsentScope.VAULT_WRITE_PROFESSIONAL
            )
            
            logger.info(f"🔐 Issued consent token for user {user_id}: {consent_token.token[:50]}...")
            
            # Mark as complete - include token for vault operations
            return {
                "message": (
                    "🎉 **TrustLink Established! Profile saved successfully!**\n\n"
                    "I'll now use this to give you personalized career recommendations, "
                    "job matches, and networking opportunities.\n\n"
                    "🔐 *Private and secure via Hushh Consent Protocol*\n\n"
                    "Try asking me: 'What roles would suit my profile?'"
                ),
                "state": {"step": "complete", "collected": state["collected"]},
                "is_complete": True,
                # Include real consent token
                "consent_token": consent_token.token,
                "consent_scope": ConsentScope.VAULT_WRITE_PROFESSIONAL.value,
                "consent_issued_at": consent_token.issued_at,
                "consent_expires_at": consent_token.expires_at
            }
        elif msg_lower in ["edit", "change", "redo"]:
            # Restart from title
            new_state = {"step": "title", "collected": {}}
            return {
                "message": (
                    "No problem! Let's start over.\n\n"
                    "What's your **professional title**?"
                ),
                "state": new_state
            }
        else:
            return {
                "message": "Please choose **Save** or **Edit**.",
                "state": state,
                "ui_type": "buttons",
                "options": ["💾 Save Preference", "✏️ Edit"]
            }
    
    def _handle_complete_state(self, message: str, state: Dict) -> Dict:
        """Handle messages after completion."""
        return {
            "message": (
                "Your profile is saved! I can help you with:\n"
                "• Finding matching job opportunities\n"
                "• Suggesting skill improvements\n"
                "• Networking recommendations\n\n"
                "What would you like to explore?"
            ),
            "state": state
        }


# Create singleton instance
professional_agent = ProfessionalProfileAgent()

# Export for API
def handle_message(message: str, user_id: str, session_state: Optional[Dict] = None) -> Dict:
    """Wrapper for API compatibility."""
    return professional_agent.handle_message(message, user_id, session_state)

logger.info("💼 Professional Profile Agent ready!")

