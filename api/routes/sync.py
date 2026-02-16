# consent-protocol/api/routes/sync.py
"""
Sync API Routes (disabled)
==========================

Remote sync is intentionally disabled during regulated cutover.
All routes return explicit feature-disabled responses.
"""

import os

from fastapi import APIRouter, Body, Depends, Query

from api.middleware import require_vault_owner_token

router = APIRouter(prefix="/api/sync", tags=["Sync"])


def _sync_enabled() -> bool:
    raw = str(os.getenv("SYNC_REMOTE_ENABLED", "false")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _disabled_payload() -> dict:
    return {
        "success": False,
        "error_code": "SYNC_DISABLED",
        "message": "Remote sync is disabled in this release.",
        "sync_remote_enabled": _sync_enabled(),
    }


@router.post("/vault", status_code=501)
async def sync_vault(
    user_id: str = Body(..., embed=True, alias="userId"),
    token_data: dict = Depends(require_vault_owner_token),
):
    _ = user_id
    _ = token_data
    return _disabled_payload()


@router.post("/batch", status_code=501)
async def sync_batch(
    token_data: dict = Depends(require_vault_owner_token),
):
    _ = token_data
    return _disabled_payload()


@router.get("/pull", status_code=501)
async def pull_changes(
    userId: str = Query(...),
    since: int = Query(0),
    token_data: dict = Depends(require_vault_owner_token),
):
    _ = userId
    _ = since
    _ = token_data
    return _disabled_payload()
