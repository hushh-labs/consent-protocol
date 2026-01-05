# consent-protocol/api/routes/kai.py
"""
Agent Kai API Routes

Endpoints for Kai investor onboarding and analysis sessions.
Uses existing MCP consent infrastructure.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Literal
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

class CreateSessionRequest(BaseModel):
    user_id: str


class CreateSessionResponse(BaseModel):
    session_id: str
    user_id: str
    created_at: str


class UpdateSessionRequest(BaseModel):
    processing_mode: Optional[Literal["on_device", "hybrid"]] = None
    risk_profile: Optional[Literal["conservative", "balanced", "aggressive"]] = None
    legal_acknowledged: Optional[bool] = None
    onboarding_complete: Optional[bool] = None


class SessionResponse(BaseModel):
    session_id: str
    user_id: str
    processing_mode: Optional[str]
    risk_profile: Optional[str]
    legal_acknowledged: bool
    onboarding_complete: bool
    created_at: str
    updated_at: str


class GrantConsentRequest(BaseModel):
    session_id: str
    scopes: List[str] = [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze",
    ]


class GrantConsentResponse(BaseModel):
    consent_id: str
    token: str
    scopes: List[str]
    issued_at: str
    expires_at: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/session/start", response_model=CreateSessionResponse)
async def start_session(request: CreateSessionRequest):
    """
    Start a new Kai onboarding session.
    
    Creates entry in kai_sessions table and returns session_id.
    """
    pool = await get_pool()
    session_id = f"kai_session_{uuid.uuid4().hex[:16]}"
    now = datetime.utcnow()
    
    try:
        await pool.execute(
            """
            INSERT INTO kai_sessions (session_id, user_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4)
            """,
            session_id, request.user_id, now, now
        )
        
        logger.info(f"[Kai] Created session: {session_id} for user: {request.user_id}")
        
        return CreateSessionResponse(
            session_id=session_id,
            user_id=request.user_id,
            created_at=now.isoformat(),
        )
    except Exception as e:
        logger.error(f"[Kai] Failed to create session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """
    Get current state of a Kai session.
    """
    pool = await get_pool()
    
    row = await pool.fetchrow(
        "SELECT * FROM kai_sessions WHERE session_id = $1",
        session_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(
        session_id=row["session_id"],
        user_id=row["user_id"],
        processing_mode=row["processing_mode"],
        risk_profile=row["risk_profile"],
        legal_acknowledged=row["legal_acknowledged"],
        onboarding_complete=row["onboarding_complete"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


@router.patch("/session/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, request: UpdateSessionRequest):
    """
    Update a Kai session (processing mode, risk profile, etc.).
    """
    pool = await get_pool()
    
    # Build update query dynamically
    updates = []
    values = []
    param_idx = 1
    
    if request.processing_mode is not None:
        updates.append(f"processing_mode = ${param_idx}")
        values.append(request.processing_mode)
        param_idx += 1
    
    if request.risk_profile is not None:
        updates.append(f"risk_profile = ${param_idx}")
        values.append(request.risk_profile)
        param_idx += 1
    
    if request.legal_acknowledged is not None:
        updates.append(f"legal_acknowledged = ${param_idx}")
        values.append(request.legal_acknowledged)
        param_idx += 1
    
    if request.onboarding_complete is not None:
        updates.append(f"onboarding_complete = ${param_idx}")
        values.append(request.onboarding_complete)
        param_idx += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append(f"updated_at = ${param_idx}")
    values.append(datetime.utcnow())
    param_idx += 1
    
    values.append(session_id)
    
    query = f"""
        UPDATE kai_sessions 
        SET {', '.join(updates)}
        WHERE session_id = ${param_idx}
        RETURNING *
    """
    
    row = await pool.fetchrow(query, *values)
    
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    logger.info(f"[Kai] Updated session: {session_id}")
    
    return SessionResponse(
        session_id=row["session_id"],
        user_id=row["user_id"],
        processing_mode=row["processing_mode"],
        risk_profile=row["risk_profile"],
        legal_acknowledged=row["legal_acknowledged"],
        onboarding_complete=row["onboarding_complete"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


@router.post("/session/{session_id}/consent", response_model=GrantConsentResponse)
async def grant_consent(session_id: str, request: GrantConsentRequest):
    """
    Grant consent for Kai data access.
    
    Uses existing MCP consent infrastructure:
    - Issues consent token via issue_token()
    - Logs to consent_audit table
    """
    pool = await get_pool()
    
    # Verify session exists
    session = await pool.fetchrow(
        "SELECT user_id FROM kai_sessions WHERE session_id = $1",
        session_id
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    user_id = session["user_id"]
    
    # Issue consent tokens for each scope using existing MCP infrastructure
    tokens = []
    consent_id = f"kai_consent_{uuid.uuid4().hex[:16]}"
    
    for scope_str in request.scopes:
        try:
            scope = ConsentScope(scope_str)
            token = issue_token(
                user_id=user_id,
                agent_id="agent_kai",
                scope=scope
            )
            tokens.append(token)
            
            # Log to consent_audit
            await pool.execute(
                """
                INSERT INTO consent_audit (
                    token_id, user_id, agent_id, scope, action, issued_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                token.token[:32],  # Use first 32 chars as token_id
                user_id,
                "agent_kai",
                scope_str,
                "CONSENT_GRANTED",
                token.issued_at,
                token.expires_at,
            )
        except ValueError:
            logger.warning(f"[Kai] Unknown scope: {scope_str}")
    
    if not tokens:
        raise HTTPException(status_code=400, detail="No valid scopes provided")
    
    # Update session
    await pool.execute(
        "UPDATE kai_sessions SET onboarding_complete = TRUE, updated_at = $1 WHERE session_id = $2",
        datetime.utcnow(),
        session_id,
    )
    
    # Return first token (primary)
    primary_token = tokens[0]
    
    logger.info(f"[Kai] Consent granted for session: {session_id}, scopes: {request.scopes}")
    
    return GrantConsentResponse(
        consent_id=consent_id,
        token=primary_token.token,
        scopes=request.scopes,
        issued_at=datetime.fromtimestamp(primary_token.issued_at / 1000).isoformat(),
        expires_at=datetime.fromtimestamp(primary_token.expires_at / 1000).isoformat(),
    )


@router.get("/session/user/{user_id}", response_model=Optional[SessionResponse])
async def get_user_session(user_id: str):
    """
    Get the most recent Kai session for a user.
    
    Useful for resuming onboarding.
    """
    pool = await get_pool()
    
    row = await pool.fetchrow(
        """
        SELECT * FROM kai_sessions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
        """,
        user_id
    )
    
    if not row:
        return None
    
    return SessionResponse(
        session_id=row["session_id"],
        user_id=row["user_id"],
        processing_mode=row["processing_mode"],
        risk_profile=row["risk_profile"],
        legal_acknowledged=row["legal_acknowledged"],
        onboarding_complete=row["onboarding_complete"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def kai_health():
    """Kai API health check."""
    return {"status": "ok", "agent": "kai", "version": "1.0.0"}


# ============================================================================
# ANALYSIS ENDPOINTS
# ============================================================================

class AnalyzeRequest(BaseModel):
    user_id: str
    ticker: str
    session_id: str
    consent_token: str
    vault_key_hex: str  # Client-provided vault key (from Keychain/Keystore)


class AnalyzeResponse(BaseModel):
    decision_id: str
    ticker: str
    decision: Literal["buy", "hold", "reduce"]
    confidence: float
    headline: str
    processing_mode: str
    created_at: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ticker(request: AnalyzeRequest):
    """
    Perform 3-agent investment analysis on a ticker.
    
    This is the core Kai endpoint that:
    1. Validates consent token
    2. Runs 3 agents (Fundamental, Sentiment, Valuation)
    3. Orchestrates debate
    4. Generates decision card
    5. Encrypts and stores result
    
    Args:
        request: AnalyzeRequest with user_id, ticker, session_id, consent_token, vault_key_hex
        
    Returns:
        AnalyzeResponse with decision summary
        
    Note:
        vault_key_hex is provided by the client after unlocking the vault locally.
        This follows the existing pattern from food_dining agent.
    """
    from hushh_mcp.agents.kai.orchestrator import KaiOrchestrator
    from hushh_mcp.vault.encrypt import encrypt_data
    
    pool = await get_pool()
    
    # Get session details
    session = await pool.fetchrow(
        "SELECT * FROM kai_sessions WHERE session_id = $1",
        request.session_id
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Initialize orchestrator
        orchestrator = KaiOrchestrator(
            user_id=request.user_id,
            risk_profile=session["risk_profile"] or "balanced",
            processing_mode=session["processing_mode"] or "hybrid",
        )
        
        # Run analysis
        decision_card = await orchestrator.analyze(
            ticker=request.ticker,
            consent_token=request.consent_token,
        )
        
        # Encrypt decision card for storage using client-provided vault key
        decision_json = orchestrator.decision_generator.to_json(decision_card)
        encrypted = encrypt_data(decision_json, request.vault_key_hex)
        
        # Store in kai_decisions table
        await pool.execute(
            """
            INSERT INTO kai_decisions (
                user_id, session_id, ticker, decision_type,
                decision_ciphertext, debate_ciphertext,
                iv, tag, algorithm, confidence_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            request.user_id,
            request.session_id,
            request.ticker,
            decision_card.decision,
            encrypted["ciphertext"],
            "",  # Debate stored in main ciphertext
            encrypted["iv"],
            encrypted["tag"],
            "aes-256-gcm",
            decision_card.confidence,
            datetime.utcnow(),
        )
        
        logger.info(f"[Kai] Stored decision for {request.ticker}: {decision_card.decision}")
        
        return AnalyzeResponse(
            decision_id=decision_card.decision_id,
            ticker=decision_card.ticker,
            decision=decision_card.decision,
            confidence=decision_card.confidence,
            headline=decision_card.headline,
            processing_mode=decision_card.processing_mode,
            created_at=decision_card.timestamp.isoformat(),
        )
        
    except ValueError as e:
        logger.error(f"[Kai] Analysis failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Kai] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")
        
        # Store in kai_decisions table
        await pool.execute(
            """
            INSERT INTO kai_decisions (
                user_id, session_id, ticker, decision_type,
                decision_ciphertext, debate_ciphertext,
                iv, tag, algorithm, confidence_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            request.user_id,
            request.session_id,
            request.ticker,
            decision_card.decision,
            encrypted["ciphertext"],
            "",  # TODO: Store debate separately
            encrypted["iv"],
            encrypted["tag"],
            "aes-256-gcm",
            decision_card.confidence,
            datetime.utcnow(),
        )
        
        logger.info(f"[Kai] Stored decision for {request.ticker}: {decision_card.decision}")
        
        return AnalyzeResponse(
            decision_id=decision_card.decision_id,
            ticker=decision_card.ticker,
            decision=decision_card.decision,
            confidence=decision_card.confidence,
            headline=decision_card.headline,
            processing_mode=decision_card.processing_mode,
            created_at=decision_card.timestamp.isoformat(),
        )
        
    except ValueError as e:
        logger.error(f"[Kai] Analysis failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Kai] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")


# ============================================================================
# DECISION HISTORY ENDPOINTS
# ============================================================================

class DecisionHistoryResponse(BaseModel):
    decisions: List[Dict]
    total: int


@router.get("/decisions/{user_id}", response_model=DecisionHistoryResponse)
async def get_decision_history(
    user_id: str,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Get decision history for a user.
    
    Returns list of past decisions with metadata.
    """
    pool = await get_pool()
    
    # Get total count
    count_row = await pool.fetchrow(
        "SELECT COUNT(*) as total FROM kai_decisions WHERE user_id = $1",
        user_id
    )
    total = count_row["total"]
    
    # Get decisions (metadata only, not full encrypted payload)
    rows = await pool.fetch(
        """
        SELECT id, ticker, decision_type, confidence_score, created_at
        FROM kai_decisions
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


@router.get("/decision/{decision_id}")
async def get_decision_detail(decision_id: int, vault_key_hex: str = Query(...)):
    """
    Get full decision card details (decrypted).
    
    Returns complete decision card with debate transcript.
    
    Args:
        decision_id: ID of the decision to retrieve
        vault_key_hex: Client-provided vault key for decryption
        
    Note:
        vault_key_hex should be provided by the client after unlocking the vault.
        This follows the zero-knowledge architecture - server never sees raw vault key.
    """
    from hushh_mcp.vault.encrypt import decrypt_data
    
    pool = await get_pool()
    
    row = await pool.fetchrow(
        "SELECT * FROM kai_decisions WHERE id = $1",
        decision_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    # Decrypt decision card using client-provided vault key
    try:
        decrypted = decrypt_data(
            row["decision_ciphertext"],
            row["iv"],
            row["tag"],
            vault_key_hex
        )
        
        # Parse JSON
        import json
        decision_card = json.loads(decrypted)
        
        return decision_card
        
    except Exception as e:
        logger.error(f"[Kai] Decryption failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to decrypt decision")


@router.delete("/decision/{decision_id}")
async def delete_decision(decision_id: int, user_id: str = Query(...)):
    """
    Delete a decision from history.
    
    User must own the decision to delete it.
    """
    pool = await get_pool()
    
    result = await pool.execute(
        "DELETE FROM kai_decisions WHERE id = $1 AND user_id = $2",
        decision_id, user_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Decision not found or not authorized")
    
    logger.info(f"[Kai] Deleted decision {decision_id} for user {user_id}")
    
    return {"success": True, "deleted_id": decision_id}

