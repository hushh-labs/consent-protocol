
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

# Force load Env if needed (though issue_token might rely on SECRET_KEY in os.environ)
from dotenv import load_dotenv
load_dotenv(".env")

try:
    token_obj = issue_token(
        user_id="debug_user_123",
        agent_id="agent_kai_debug",
        scope=ConsentScope.AGENT_KAI_ANALYZE, # Correct Agent Scope
        expires_in_ms=3600 * 1000 # 1 hour
    )
    
    print(token_obj.token)
    with open("token.txt", "w") as f:
        f.write(token_obj.token)
    print("Token written to token.txt")
    
except Exception as e:
    print(f"Error: {e}")
