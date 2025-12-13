# hushh_mcp/consent/token.py

import hmac
import hashlib
import base64
import time
from typing import Optional, Tuple

from hushh_mcp.config import SECRET_KEY, DEFAULT_CONSENT_TOKEN_EXPIRY_MS
from hushh_mcp.constants import CONSENT_TOKEN_PREFIX
from hushh_mcp.types import HushhConsentToken, ConsentScope, UserID, AgentID

# ========== Internal Revocation Registry ==========
_revoked_tokens = set()

# ========== Token Generator ==========

def issue_token(
    user_id: UserID,
    agent_id: AgentID,
    scope: ConsentScope,
    expires_in_ms: int = DEFAULT_CONSENT_TOKEN_EXPIRY_MS
) -> HushhConsentToken:
    issued_at = int(time.time() * 1000)
    expires_at = issued_at + expires_in_ms
    raw = f"{user_id}|{agent_id}|{scope.value}|{issued_at}|{expires_at}"
    signature = _sign(raw)

    token_string = f"{CONSENT_TOKEN_PREFIX}:{base64.urlsafe_b64encode(raw.encode()).decode()}.{signature}"

    return HushhConsentToken(
        token=token_string,
        user_id=user_id,
        agent_id=agent_id,
        scope=scope,
        issued_at=issued_at,
        expires_at=expires_at,
        signature=signature
    )

# ========== Token Verifier ==========

def validate_token(
    token_str: str,
    expected_scope: Optional[ConsentScope] = None
) -> Tuple[bool, Optional[str], Optional[HushhConsentToken]]:
    if token_str in _revoked_tokens:
        return False, "Token has been revoked", None

    try:
        prefix, signed_part = token_str.split(":")
        encoded, signature = signed_part.split(".")

        if prefix != CONSENT_TOKEN_PREFIX:
            return False, "Invalid token prefix", None

        decoded = base64.urlsafe_b64decode(encoded.encode()).decode()
        user_id, agent_id, scope_str, issued_at_str, expires_at_str = decoded.split("|")

        raw = f"{user_id}|{agent_id}|{scope_str}|{issued_at_str}|{expires_at_str}"
        expected_sig = _sign(raw)

        if not hmac.compare_digest(signature, expected_sig):
            return False, "Invalid signature", None

        if expected_scope and scope_str != expected_scope.value:
            return False, "Scope mismatch", None

        if int(time.time() * 1000) > int(expires_at_str):
            return False, "Token expired", None

        token = HushhConsentToken(
            token=token_str,
            user_id=user_id,
            agent_id=agent_id,
            scope=scope_str,  # can optionally convert to ConsentScope(scope_str)
            issued_at=int(issued_at_str),
            expires_at=int(expires_at_str),
            signature=signature
        )
        return True, None, token

    except Exception as e:
        return False, f"Malformed token: {str(e)}", None

# ========== Token Revoker ==========

def revoke_token(token_str: str) -> None:
    _revoked_tokens.add(token_str)

def is_token_revoked(token_str: str) -> bool:
    return token_str in _revoked_tokens

# ========== Internal Signer ==========

def _sign(input_string: str) -> str:
    return hmac.new(
        SECRET_KEY.encode(),
        input_string.encode(),
        hashlib.sha256
    ).hexdigest()
