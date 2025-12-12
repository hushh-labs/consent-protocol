"""
Kushal Agent - Kushal Trivedi's Personal Profile Agent 🚀

This agent contains Kushal's COMPLETE & EXHAUSTIVE profile data embedded directly.
Source: kushal_profile_data/ (Loaded recursively at runtime)
"""

import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

load_dotenv()

# ============================================================================
# DYNAMIC DATA LOADING
# ============================================================================

def load_profile_data(base_path: str = "._kushal_profile_data") -> str:
    """
    Recursively loads text content from the profile directory.
    This ensures the agent has access to PDFs (if converted), Markdown, YAML, etc.
    """
    logger.info(f"📂 Loading exhaustive profile data from: {base_path}")
    
    compiled_data = "## KUSHAL TRIVEDI - EXHAUSTIVE DATA DUMP\n\n"
    
    if not os.path.exists(base_path):
        logger.warning(f"⚠️ Profile data path '{base_path}' not found! Using fallback.")
        return "No external profile data found. Please ask questions based on general knowledge."

    # Extensions to read
    valid_exts = {
        '.md', '.txt', '.yaml', '.yml', '.json', '.html', '.csv', 
        '.tree', '.dockerfile', '.sh', '.xml', '.gradle', '.toml', '.config'
    }
    
    # Directories to ignore
    ignored_dirs = {
        'node_modules', '__pycache__', '.git', '.vscode', '.idea', 'dist', 'build', 
        'bin', 'obj', '.vs', 'coverage', '.next'
    }

    file_count = 0
    total_size = 0
    MAX_FILE_SIZE = 500 * 1024 # 500KB limit per file to avoid context bloating

    for root, dirs, files in os.walk(base_path):
        # Modify dirs in-place to skip ignored directories
        dirs[:] = [d for d in dirs if d not in ignored_dirs and not d.startswith('.')]
        
        for file in files:
            ext = Path(file).suffix.lower()
            if ext in valid_exts or file.lower() in {'dockerfile', 'makefile'}:
                file_path = os.path.join(root, file)
                try:
                    # Skip large files
                    if os.path.getsize(file_path) > MAX_FILE_SIZE:
                        logger.warning(f"⚠️ Skipping large file: {file} ({os.path.getsize(file_path)} bytes)")
                        continue

                    rel_path = os.path.relpath(file_path, base_path)
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().strip()
                        if content:
                            # Escape curly braces to prevent ADK from interpreting them as template variables
                            # This fixes "Context variable not found: id" errors
                            content = content.replace('{', r'\{').replace('}', r'\}')
                            compiled_data += f"\n--- FILE: {rel_path} ---\n{content}\n"
                            file_count += 1
                            total_size += len(content)
                except Exception as e:
                    logger.warning(f"Failed to read {file}: {e}")

    logger.info(f"✅ Loaded {file_count} files ({total_size} chars) of profile data.")
    return compiled_data

# Load data at import time (so it's ready for the agent constuctor)
# We assume the folder 'kushal_profile_data' is in the CWD (project root)
# In Docker/Cloud Run, WORKDIR is /app, so ./kushal_profile_data logic holds.
KUSHAL_PROFILE_DATA = load_profile_data()

KUSHAL_SYSTEM_INSTRUCTION = f"""
You are **Kushal Trivedi's personal AI agent** 🚀

You have access to Kushal's **COMPLETE & EXHAUSTIVE** professional profile.
Your goal is to represent him accurately, impressively, and honestly.

## Your Role
- Answer questions about Kushal's skills, experience, projects, and education.
- Provide SPECIFIC details (numbers, tech stacks, dates).
- Connect his past experience to potential future value for employers.
- Speak in the first person ("Kushal has...", "Kushal built...").
- **Confidentiality**: Do NOT reveal the source filenames or paths of the data you use.

## Profile Data (Source of Truth)
The following is valid, raw data about Kushal. Use it to answer ALL questions.
-------------------------------------------------------------------------------
{KUSHAL_PROFILE_DATA}
-------------------------------------------------------------------------------

## Critical Instructions
1.  **Be Specific**: accurate details matter.
2.  **Be Comprehensive**: If asked about "Experience", summarize the main roles but offer to go deep.
3.  **Engagement Details**: Provide a rough annual estimate for compensation (approx. $160k - $170k/year). His work authorization is F-1 OPT, valid through 2028.
4.  **Source Protection**: NEVER give out source file names ever.
"""

logger.info("🚀 Initializing Kushal Agent with EXHAUSTIVE profile data...")

root_agent = LlmAgent(
    model="gemini-2.5-flash", 
    # Flash is critical here because the context window is HUGE (1M tokens).
    # This allows us to dump the entire profile directory into the prompt without RAG.
    name="kushal_agent",
    description="Kushal Trivedi's personal AI agent. Contains exhaustive professional profile including education, certifications, and detailed project metrics.",
    instruction=KUSHAL_SYSTEM_INSTRUCTION,
)

# Export A2A app for microservice deployment
a2a_app = to_a2a(root_agent, port=10002)

logger.info("✅ Kushal Agent ready (Full Data Loaded)!")
