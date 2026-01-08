# consent-protocol/api/routes/kai.py
"""
Agent Kai API Routes

Endpoints for Kai investor analysis.
Stateless Zero-Knowledge Architecture:
- Authorization: Standard Bearer Token / Consent Token.
- Preferences (Risk Profile): Passed by Client in request (Ephemeral).
- Encryption: Client handles all encryption/decryption.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Literal
from datetime import datetime
import uuid
import logging

from db.connection import get_pool
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kai", tags=["kai"])


# ============================================================================
# MODELS
# ============================================================================

class GrantConsentRequest(BaseModel):
    user_id: str
    scopes: List[str] = [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze",
    ]


class GrantConsentResponse(BaseModel):
    consent_id: str
    tokens: Dict[str, str]
    expires_at: str


# --- Analysis Models ---

class AnalyzeRequest(BaseModel):
    user_id: str
    ticker: str
    consent_token: Optional[str] = None
    # Client provides context explicitly (Stateless)
    risk_profile: Literal["conservative", "balanced", "aggressive"] = "balanced"
    processing_mode: Literal["on_device", "hybrid"] = "hybrid"


class AnalyzeResponse(BaseModel):
    """
    Plaintext decision returned to Client.
    Client MUST encrypt this before storing.
    """
    decision_id: str
    ticker: str
    decision: Literal["buy", "hold", "reduce"]
    confidence: float
    headline: str
    processing_mode: str
    created_at: str
    # Full data for client to encrypt
    raw_card: Dict 


class StoreDecisionRequest(BaseModel):
    """
    Request to store an already-encrypted decision.
    """
    user_id: str
    ticker: str
    decision_type: str # 'buy', 'hold', 'reduce' (Plaintext metadata)
    confidence_score: float
    
    # Encrypted Payload
    decision_ciphertext: str
    iv: str
    tag: Optional[str] = ""


class DecisionHistoryResponse(BaseModel):
    decisions: List[Dict]
    total: int


class EncryptedDecisionResponse(BaseModel):
    """
    Encrypted decision returned to Client for local decryption.
    """
    id: int
    decision_ciphertext: str
    iv: str
    tag: str
    created_at: str
    user_id: str
    ticker: str


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def kai_health():
    """Kai API health check."""
    return {"status": "ok", "agent": "kai", "version": "1.0.0"}


# ============================================================================
# CONSENT ENDPOINT (Stateless)
# ============================================================================

@router.post("/consent/grant", response_model=GrantConsentResponse)
async def grant_consent(request: GrantConsentRequest):
    """
    Grant consent for Kai data access.
    
    Stateless: Issues tokens for the requested user_id and scopes.
    Does not rely on a pre-existing session.
    """
    pool = await get_pool()
    
    tokens = {}
    consent_id = f"kai_consent_{uuid.uuid4().hex[:16]}"
    last_token_issued = None
    
    for scope_str in request.scopes:
        try:
            scope = ConsentScope(scope_str)
            token = issue_token(
                user_id=request.user_id,
                agent_id="agent_kai",
                scope=scope
            )
            tokens[scope_str] = token.token
            last_token_issued = token
            
            # Log to consent_audit
            await pool.execute(
                """
                INSERT INTO consent_audit (
                    token_id, user_id, agent_id, scope, action, issued_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                token.token[:32],
                request.user_id,
                "agent_kai",
                scope_str,
                "granted",
                token.issued_at,
                token.expires_at,
            )
            
        except Exception as e:
            logger.error(f"Failed to issue token for scope {scope_str}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scope: {scope_str}"
            )
    
    if not tokens:
        raise HTTPException(status_code=400, detail="No valid scopes provided")
    
    logger.info(f"[Kai] Consent granted for user: {request.user_id}")
    
    return GrantConsentResponse(
        consent_id=consent_id,
        tokens=tokens,
        expires_at=str(last_token_issued.expires_at) if last_token_issued else ""
    )


# ============================================================================
# ANALYSIS ENDPOINTS (Zero-Knowledge & Stateless)
# ============================================================================

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ticker(
    request: AnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Step 1: Perform 3-agent investment analysis.
    
    Return PLAINTEXT result.
    Client provides `risk_profile` directly (Stateless).
    """
    from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
    
    try:
        # Initialize orchestrator with Client-provided context
        orchestrator = KaiOrchestrator(
            user_id=request.user_id,
            risk_profile=request.risk_profile,
            processing_mode=request.processing_mode,
        )
        
        # Validate Consent (Explicit or Implicit)
        token_to_use = request.consent_token
        
        if not token_to_use:
            # Try Implicit Consent (Same-User Session)
            if not authorization or not authorization.startswith("Bearer "):
                 raise HTTPException(status_code=401, detail="Missing consent token or valid session")
            
            try:
                import firebase_admin
                from firebase_admin import auth, credentials
                try:
                    firebase_admin.get_app()
                except ValueError:
                    firebase_admin.initialize_app(credentials.ApplicationDefault())
                
                id_token = authorization.split("Bearer ")[1]
                decoded = auth.verify_id_token(id_token)
                
                if decoded["uid"] != request.user_id:
                    raise HTTPException(status_code=403, detail="Session user mismatch")
                
                logger.info(f"[Kai] Implicit consent granted for owner: {request.user_id}")
                token_to_use = "IMPLICIT_SAMESESSION_AUTH"
                
            except Exception as e:
                logger.warning(f"[Kai] Implicit auth failed: {e}")
                raise HTTPException(status_code=401, detail="Invalid session credentials")

        # Run analysis (Generates Plaintext)
        decision_card = await orchestrator.analyze(
            ticker=request.ticker,
            consent_token=token_to_use,
        )
        
        # Convert to dictionary for response
        raw_card = orchestrator.decision_generator.to_json(decision_card)
        import json
        raw_dict = json.loads(raw_card)
        
        logger.info(f"[Kai] Generated analysis for {request.ticker} ({request.risk_profile})")
        
        return AnalyzeResponse(
            decision_id=decision_card.decision_id,
            ticker=decision_card.ticker,
            decision=decision_card.decision,
            confidence=decision_card.confidence,
            headline=decision_card.headline,
            processing_mode=decision_card.processing_mode,
            created_at=decision_card.timestamp.isoformat(),
            raw_card=raw_dict # Plaintext
        )
        
    except ValueError as e:
        logger.error(f"[Kai] Analysis failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"[Kai] Unexpected error during analysis")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/decision/store")
async def store_decision(request: StoreDecisionRequest):
    """
    Step 2: Store Encrypted Decision.
    Stateless (No session_id).
    """
    pool = await get_pool()
    
    try:
        await pool.execute(
            """
            INSERT INTO vault_kai (
                user_id, ticker, decision_type,
                decision_ciphertext, iv, tag, 
                confidence_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            request.user_id,
            request.ticker,
            request.decision_type,
            request.decision_ciphertext,
            request.iv,
            request.tag,
            request.confidence_score,
            datetime.utcnow(),
        )
        
        logger.info(f"[Kai] Desicion stored encrypted for {request.ticker}")
        return {"success": True, "ticker": request.ticker}
        
    except Exception as e:
        logger.error(f"[Kai] Failed to store decision: {e}")
        raise HTTPException(status_code=500, detail="Failed to store decision")


@router.get("/decisions/{user_id}", response_model=DecisionHistoryResponse)
async def get_decision_history(
    user_id: str,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Get decision history (metadata only).
    """
    pool = await get_pool()
    
    # Get total count
    count_row = await pool.fetchrow(
        "SELECT COUNT(*) as total FROM vault_kai WHERE user_id = $1",
        user_id
    )
    total = count_row["total"]
    
    rows = await pool.fetch(
        """
        SELECT id, ticker, decision_type, confidence_score, created_at
        FROM vault_kai
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        user_id, limit, offset
    )
    
    decisions = []
    for row in rows:
        decisions.append({
            "id": row["id"],
            "ticker": row["ticker"],
            "decision": row["decision_type"],
            "confidence": float(row["confidence_score"]) if row["confidence_score"] else 0.0,
            "created_at": row["created_at"].isoformat(),
        })
    
    return DecisionHistoryResponse(decisions=decisions, total=total)


@router.get("/decision/{decision_id}", response_model=EncryptedDecisionResponse)
async def get_decision_detail(decision_id: int):
    """
    Get FULL Encrypted Decision Blob.
    
    Client must download this and decrypt locally using Vault Key.
    """
    pool = await get_pool()
    
    row = await pool.fetchrow(
        "SELECT * FROM vault_kai WHERE id = $1",
        decision_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    return EncryptedDecisionResponse(
        id=row["id"],
        decision_ciphertext=row["decision_ciphertext"],
        iv=row["iv"],
        tag=row["tag"] or "",
        created_at=row["created_at"].isoformat(),
        user_id=row["user_id"],
        ticker=row["ticker"]
    )


@router.delete("/decision/{decision_id}")
async def delete_decision(decision_id: int, user_id: str = Query(...)):
    """
    Delete a decision.
    """
    pool = await get_pool()
    
    result = await pool.execute(
        "DELETE FROM vault_kai WHERE id = $1 AND user_id = $2",
        decision_id, user_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Decision not found or not authorized")
    
    return {"success": True, "deleted_id": decision_id}


# ============================================================================
# PREFERENCES ENDPOINTS (Encrypted Settings)
# ============================================================================

class EncryptedPreference(BaseModel):
    field_name: str
    ciphertext: str
    iv: str
    tag: Optional[str] = ""

class StorePreferencesRequest(BaseModel):
    user_id: str
    preferences: List[EncryptedPreference]

class PreferencesResponse(BaseModel):
    preferences: List[EncryptedPreference]


@router.post("/preferences/store")
async def store_preferences(request: StorePreferencesRequest):
    """
    Store encrypted user preferences (Risk Profile, Processing Mode).
    Upserts by (user_id, field_name).
    """
    pool = await get_pool()
    
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for pref in request.preferences:
                    await conn.execute(
                        """
                        INSERT INTO vault_kai_preferences (
                            user_id, field_name, ciphertext, iv, tag, updated_at, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (user_id, field_name) 
                        DO UPDATE SET 
                            ciphertext = EXCLUDED.ciphertext,
                            iv = EXCLUDED.iv,
                            tag = EXCLUDED.tag,
                            updated_at = EXCLUDED.updated_at
                        """,
                        request.user_id,
                        pref.field_name,
                        pref.ciphertext,
                        pref.iv,
                        pref.tag,
                        int(datetime.now().timestamp()), # updated_at
                        int(datetime.now().timestamp())  # created_at (ignored on update)
                    )
        
        logger.info(f"[Kai] Stored {len(request.preferences)} encrypted preferences for {request.user_id}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"[Kai] Failed to store preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to store settings")


@router.get("/preferences/{user_id}", response_model=PreferencesResponse)
async def get_preferences(user_id: str):
    """
    Retrieve all encrypted preferences for a user.
    """
    pool = await get_pool()
    
    rows = await pool.fetch(
        """
        SELECT field_name, ciphertext, iv, tag
        FROM vault_kai_preferences
        WHERE user_id = $1
        """,
        user_id
    )
    
    prefs = []
    for row in rows:
        prefs.append(EncryptedPreference(
            field_name=row["field_name"],
            ciphertext=row["ciphertext"],
            iv=row["iv"],
            tag=row["tag"] or ""
        ))
    
    return PreferencesResponse(preferences=prefs)
