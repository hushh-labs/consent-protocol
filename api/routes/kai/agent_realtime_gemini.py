"""Gemini Live ephemeral-token endpoint for One's in-bar conversation mode.

This is the realtime, full-duplex sibling of the chained ``agent_voice.py`` and
the OpenAI ``agent_realtime.py``. It mints a short-lived, tightly constrained
Gemini Live *ephemeral auth token* so the browser can open a direct WebSocket to
the Gemini Live API (lowest latency, no audio relayed through our server).

Security model:

- The browser never sees the managed Gemini API key. It only receives an
  ephemeral token that the SDK mints via ``auth_tokens.create``.
- The token is locked to a single new Live session, a short expiry, and a fixed
  ``LiveConnectConfig`` (model, audio-only modality, voice, system instruction,
  VAD). ``lock_additional_fields=[]`` prevents the client from widening any
  generation parameter beyond what we set here.
- Auth is OPTIONAL, exactly like ``agent_intro.py``: a signed-in user with an
  unlocked vault gets the full persona, while an anonymous / locked-vault
  onboarding visitor gets a navigation-only informational persona. Neither tier
  reads or writes PKM/vault data on this path: realtime voice has no tools,
  memory, or persistence, so it is safe to expose at the lower privilege.
- Rate limited per user/IP to bound cost on the unauthenticated path.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from api.middlewares.rate_limit import RateLimits, limiter
from hushh_mcp.services.agent_persona import (
    build_persona_context,
    compose_voice_instructions,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Kai Agent"])

# Native-audio Live model for full-duplex voice. Override per environment without
# code changes. Note: the Live API only accepts dedicated Live model IDs; the
# text/chat model (gemini-3.5-flash) is NOT a Live model. gemini-3.1-flash-live-preview
# is the current latest high-quality, low-latency native-audio Live model (the
# prior gemini-2.5-flash-native-audio-preview-09-2025 is superseded). See
# https://ai.google.dev/gemini-api/docs/models#audio-models
_GEMINI_LIVE_MODEL = (
    os.getenv("AGENT_GEMINI_LIVE_MODEL") or "gemini-3.1-flash-live-preview"
).strip()

# Supported Gemini speech voices (mirrors the chained TTS voice list).
_GEMINI_LIVE_VOICES = {"Charon", "Sulafat", "Kore", "Puck"}
_DEFAULT_GEMINI_LIVE_VOICE = "Sulafat"

# Ephemeral token lifetime. The token must be used to open the session within
# this window; the session itself may then run for its own duration.
_TOKEN_EXPIRE_SECONDS = 120
_SESSION_START_WINDOW_SECONDS = 60

_DISABLED_FLAG_VALUES = {"0", "false", "off", "disabled", "no"}


def _gemini_live_enabled() -> bool:
    configured = os.getenv("AGENT_GEMINI_LIVE_ENABLED", "").strip().lower()
    return configured not in _DISABLED_FLAG_VALUES


class AgentGeminiLiveTokenRequest(BaseModel):
    voice: Optional[str] = Field(default=None, max_length=64)
    # Optional active-state hints from the agent runtime context. They only
    # shape the (tool-less) system instruction; they never widen access. The
    # persona composer sanitizes them against prompt injection.
    screen: Optional[str] = Field(default=None, max_length=64)
    persona: Optional[str] = Field(default=None, max_length=32)


class AgentGeminiLiveTokenResponse(BaseModel):
    token: str = Field(..., max_length=4096)
    expires_at: int = Field(..., ge=0)
    model: str = Field(..., max_length=128)
    voice: str = Field(..., max_length=64)
    tier: str = Field(..., max_length=16)
    # The browser connects with v1alpha for Live + ephemeral tokens.
    api_version: str = Field(default="v1alpha", max_length=16)


async def _resolve_optional_uid(authorization: Optional[str]) -> Optional[str]:
    """Best-effort Firebase UID for tier selection + rate-limit bucketing.

    Never raises: a missing/invalid token simply means the pre-vault tier, which
    is acceptable here because realtime voice reads/writes no private data.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        from api.utils.firebase_auth import verify_firebase_bearer

        return await run_in_threadpool(verify_firebase_bearer, authorization)
    except Exception:  # noqa: BLE001 - optional auth, anonymous is acceptable
        return None


def _resolve_voice(requested: Optional[str]) -> str:
    candidate = (requested or "").strip()
    for voice in _GEMINI_LIVE_VOICES:
        if voice.lower() == candidate.lower():
            return voice
    return _DEFAULT_GEMINI_LIVE_VOICE


@router.post("/agent/realtime/gemini/token", response_model=AgentGeminiLiveTokenResponse)
@limiter.limit(RateLimits.AGENT_CHAT)
async def create_agent_gemini_live_token(
    request: Request,
    body: AgentGeminiLiveTokenRequest,
    authorization: Optional[str] = Header(default=None),
) -> AgentGeminiLiveTokenResponse:
    """Mint a constrained ephemeral Gemini Live token for in-bar voice mode."""

    if not _gemini_live_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini Live voice is not enabled.",
        )

    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini Live is not configured.",
        )

    uid = await _resolve_optional_uid(authorization)
    # Backward-compatible coarse tier returned to the client (full vs intro).
    tier = "full" if uid else "intro"
    # Richer access tier used only to shape the (tool-less) system instruction.
    # Realtime voice never reads vault state, so a signed-in user maps to the
    # signed_locked tier here: the instruction must not promise data access.
    persona_tier = "signed_locked" if uid else "anon_onboarding"
    persona_ctx = build_persona_context(
        tier=persona_tier,
        screen=body.screen,
        persona=body.persona,
    )
    instructions = compose_voice_instructions(persona_ctx)
    voice = _resolve_voice(body.voice)

    from google import genai
    from google.genai import types as genai_types

    now = datetime.now(tz=timezone.utc)
    expire_time = now + timedelta(seconds=_TOKEN_EXPIRE_SECONDS)
    session_start_deadline = now + timedelta(seconds=_SESSION_START_WINDOW_SECONDS)

    live_config = genai_types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=instructions,
        speech_config=genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name=voice)
            )
        ),
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )

    try:
        # Ephemeral token minting is only supported by the Gemini Developer API
        # client (the API-key path), not Vertex. The deployment sets
        # GOOGLE_GENAI_USE_VERTEXAI=True globally for chained inference, so we
        # must explicitly opt this client back into the Developer API.
        client = genai.Client(
            api_key=api_key,
            vertexai=False,
            http_options={"api_version": "v1alpha"},
        )
        auth_token = await client.aio.auth_tokens.create(
            config=genai_types.CreateAuthTokenConfig(
                uses=1,
                expire_time=expire_time,
                new_session_expire_time=session_start_deadline,
                live_connect_constraints=genai_types.LiveConnectConstraints(
                    model=_GEMINI_LIVE_MODEL,
                    config=live_config,
                ),
                # Prevent the client from overriding any field we did not set.
                lock_additional_fields=[],
            )
        )
    except Exception as error:  # noqa: BLE001 - normalize provider failures
        logger.warning(
            "agent_gemini_live_token_failed tier=%s error=%s",
            tier,
            error.__class__.__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not start Gemini Live. Please try again.",
        ) from error

    token_value = getattr(auth_token, "name", None)
    if not token_value:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini Live token was not issued.",
        )

    return AgentGeminiLiveTokenResponse(
        token=token_value,
        expires_at=int(expire_time.timestamp()),
        model=_GEMINI_LIVE_MODEL,
        voice=voice,
        tier=tier,
    )
