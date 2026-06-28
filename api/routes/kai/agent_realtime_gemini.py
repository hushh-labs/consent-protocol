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

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Kai Agent"])

# Native-audio Live model. Override per environment without code changes.
_GEMINI_LIVE_MODEL = (
    os.getenv("AGENT_GEMINI_LIVE_MODEL") or "gemini-2.5-flash-native-audio-preview-09-2025"
).strip()

# Supported Gemini speech voices (mirrors the chained TTS voice list).
_GEMINI_LIVE_VOICES = {"Charon", "Sulafat", "Kore", "Puck"}
_DEFAULT_GEMINI_LIVE_VOICE = "Sulafat"

# Ephemeral token lifetime. The token must be used to open the session within
# this window; the session itself may then run for its own duration.
_TOKEN_EXPIRE_SECONDS = 120
_SESSION_START_WINDOW_SECONDS = 60

_DISABLED_FLAG_VALUES = {"0", "false", "off", "disabled", "no"}

# Full persona: signed-in + unlocked vault. Realtime voice still has no tools,
# memory, or app actions, so it must not claim access to private data.
_AGENT_LIVE_INSTRUCTIONS_FULL = (
    "You are One, the personal agent inside Hussh. You hold the relationship layer "
    "and speak warmly and concisely. In this realtime voice conversation you have no "
    "tools, memory, portfolio access, PKM context, or app actions, so do not claim "
    "access to private user data or perform app actions. For finance defer to Kai, "
    "for privacy and consent defer to Nav, and for identity defer to KYC, and let the "
    "user know they can switch to typed chat for those workflows. Answer plainly in "
    "English."
)

# Pre-vault persona: anonymous or locked vault (onboarding). Informational and
# navigational only; must never imply it can read or change private data.
_AGENT_LIVE_INSTRUCTIONS_INTRO = (
    "You are One, the friendly guide inside Hussh, talking to someone who is still "
    "getting started and has not unlocked their private vault yet. Speak warmly and "
    "concisely. You have no access to any private user data, memory, portfolio, or "
    "app actions. Help the person understand Hussh and how to get set up, and when "
    "they want to do something with their own data, invite them to sign in and unlock "
    "their vault. Answer plainly in English."
)


def _gemini_live_enabled() -> bool:
    configured = os.getenv("AGENT_GEMINI_LIVE_ENABLED", "").strip().lower()
    return configured not in _DISABLED_FLAG_VALUES


class AgentGeminiLiveTokenRequest(BaseModel):
    voice: Optional[str] = Field(default=None, max_length=64)


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
    tier = "full" if uid else "intro"
    instructions = (
        _AGENT_LIVE_INSTRUCTIONS_FULL if tier == "full" else _AGENT_LIVE_INSTRUCTIONS_INTRO
    )
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
