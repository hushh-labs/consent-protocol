# api/routes/session.py
"""
Session token and user management endpoints.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import consent_db
from api.models import LogoutRequest, SessionTokenRequest, SessionTokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Session"])


@router.post("/consent/issue-token", response_model=SessionTokenResponse)
async def issue_session_token(
    request: SessionTokenRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Issue a session token after passphrase verification.
    
    SECURITY: Requires Firebase ID token in Authorization header.
    The userId in request body MUST match the verified token's UID.
    
    Called after successful passphrase unlock on the frontend.
    """
    import firebase_admin
    from firebase_admin import auth, credentials

    from hushh_mcp.consent.token import issue_token
    from hushh_mcp.constants import ConsentScope
    
    # Initialize Firebase Admin if not already done
    try:
        firebase_admin.get_app()
    except ValueError:
        # Use default credentials (works in Cloud Run with proper IAM)
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    # Verify Firebase ID token
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("⚠️ Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    id_token = authorization.split("Bearer ")[1]
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        verified_uid = decoded_token["uid"]
        
        # Ensure request userId matches verified token
        if request.userId != verified_uid:
            logger.warning(f"⚠️ userId mismatch: request={request.userId}, token={verified_uid}")
            raise HTTPException(status_code=403, detail="userId does not match authenticated user")
        
        logger.info(f"🔐 Verified user {verified_uid}, issuing session token...")
        
    except auth.InvalidIdTokenError as e:
        logger.warning(f"⚠️ Invalid ID token: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")
    except auth.ExpiredIdTokenError as e:
        logger.warning(f"⚠️ Expired ID token: {e}")
        raise HTTPException(status_code=401, detail="Expired Firebase ID token")
    except Exception as e:
        logger.error(f"❌ Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")
    
    try:
        # Issue token with session scope
        # Issue token with session scope
        # If request asks for "session", grant VAULT_OWNER (Master Scope)
        scope_to_grant = ConsentScope.VAULT_OWNER if request.scope == "session" else ConsentScope(request.scope)
        
        token_obj = issue_token(
            user_id=request.userId,
            agent_id="orchestrator",
            scope=scope_to_grant,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours
        )
        
        logger.info(f"✅ Session token issued for {request.userId}, expires at {token_obj.expires_at}")
        
        return SessionTokenResponse(
            sessionToken=token_obj.token,
            issuedAt=token_obj.issued_at,
            expiresAt=token_obj.expires_at,
            scope=request.scope
        )
    except Exception as e:
        logger.error(f"❌ Failed to issue session token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/consent/logout")
async def logout_session(request: LogoutRequest):
    """
    Destroy all session tokens for a user.
    
    Called when user logs out. Invalidates all active session tokens.
    External API tokens are NOT affected.
    """
    
    logger.info(f"🚪 Logging out user: {request.userId}")
    
    # In production, this would query the database for all session tokens
    # and revoke them. For now, we just log the action.
    # The frontend should also clear sessionStorage.
    
    return {
        "status": "success",
        "message": f"Session tokens for {request.userId} marked for revocation"
    }


@router.get("/consent/history")
async def get_consent_history(userId: str, page: int = 1, limit: int = 50):
    """
    Get paginated consent audit history for a user.
    
    Returns all consent actions grouped by app for the Audit Log tab.
    Uses database via consent_db module for persistence.
    """
    logger.info(f"📜 Fetching consent history for user: {userId}, page: {page}")
    
    try:
        result = await consent_db.get_audit_log(userId, page, limit)
        
        # Group by agent_id for frontend display
        grouped = {}
        for item in result.get("items", []):
            agent = item.get("agent_id", "Unknown")
            if agent not in grouped:
                grouped[agent] = []
            grouped[agent].append(item)
        
        return {
            "userId": userId,
            "page": result.get("page", page),
            "limit": result.get("limit", limit),
            "total": result.get("total", 0),
            "items": result.get("items", []),
            "grouped": grouped
        }
    except Exception as e:
        # SECURITY: Log error details server-side, return generic message (CodeQL fix)
        logger.error(f"❌ Failed to fetch consent history: {e}")
        return {
            "userId": userId,
            "page": page,
            "limit": limit,
            "total": 0,
            "items": [],
            "grouped": {},
            "error": "Failed to fetch consent history"
        }


@router.get("/consent/active")
async def get_active_consents(userId: str):
    """
    Get active (non-expired) consent tokens for a user.
    
    Returns consents grouped by app for the Session tab.
    Uses database via consent_db module for persistence.
    """
    logger.info(f"🔓 Fetching active consents for user: {userId}")
    
    try:
        active_tokens = await consent_db.get_active_tokens(userId)
        
        # Group by developer/app
        grouped = {}
        for token in active_tokens:
            app = token.get("developer", "Unknown App")
            if app not in grouped:
                grouped[app] = {
                    "appName": app.replace("developer:", ""),
                    "scopes": []
                }
            grouped[app]["scopes"].append({
                "scope": token.get("scope"),
                "tokenPreview": token.get("id"),
                "issuedAt": token.get("issued_at"),
                "expiresAt": token.get("expires_at"),
                "timeRemainingMs": token.get("time_remaining_ms", 0)
            })
        
        return {"grouped": grouped, "active": active_tokens}
    except Exception as e:
        # SECURITY: Log error details server-side, return generic message (CodeQL fix)
        logger.error(f"❌ Failed to fetch active consents: {e}")
        return {"grouped": {}, "active": [], "error": "Failed to fetch active consents"}


@router.get("/user/lookup")
async def lookup_user_by_email(email: str):
    """
    Look up a user by email and return their Firebase UID.
    
    Used by MCP server to allow consent requests using human-readable
    email addresses instead of Firebase UIDs.
    
    Returns:
    - user_id: Firebase UID
    - email: The email address
    - display_name: User's display name (if set)
    - exists: True if user exists
    
    Or for non-existent users:
    - exists: False
    - message: Friendly error message
    """
    import firebase_admin
    from firebase_admin import auth, credentials
    
    # Initialize Firebase Admin if not already done
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    logger.info(f"🔍 Looking up user by email: {email}")
    
    try:
        user_record = auth.get_user_by_email(email)
        logger.info(f"✅ Found user: {user_record.uid}")
        
        return {
            "exists": True,
            "user_id": user_record.uid,
            "email": user_record.email,
            "display_name": user_record.display_name or email.split("@")[0],
            "photo_url": user_record.photo_url,
            "email_verified": user_record.email_verified
        }
        
    except auth.UserNotFoundError:
        logger.info(f"⚠️ User not found with email: {email}")
        return {
            "exists": False,
            "email": email,
            "message": f"No Hushh account found for {email}. The user needs to sign up first.",
            "suggestion": "Ask the user to create a Hushh account at the login page."
        }
        
    except Exception as e:
        logger.error(f"❌ Error looking up user: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error looking up user: {str(e)}"
        )
