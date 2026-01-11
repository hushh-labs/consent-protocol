"""
Firebase Admin initialization helpers.

Goal: a single, reliable initialization path for local dev + Cloud Run.

Credential sources (in priority order):
1) FIREBASE_SERVICE_ACCOUNT_JSON  (JSON string)
2) GOOGLE_APPLICATION_CREDENTIALS / ADC
"""

from __future__ import annotations

import json
import os
from typing import Optional, Tuple


def _load_service_account_from_env() -> Optional[dict]:
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw:
        return None

    try:
        data = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"Invalid FIREBASE_SERVICE_ACCOUNT_JSON: {type(e).__name__}") from e

    if not isinstance(data, dict) or data.get("type") != "service_account":
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON must be a service_account JSON object")

    return data


def ensure_firebase_admin() -> Tuple[bool, Optional[str]]:
    """
    Ensure Firebase Admin SDK is initialized.

    Returns:
      (configured, project_id)
    """
    import firebase_admin
    from firebase_admin import credentials

    # Already initialized
    try:
        app = firebase_admin.get_app()
        proj = app.project_id if hasattr(app, "project_id") else None
        return True, proj
    except ValueError:
        pass

    # Prefer explicit service account JSON for local dev
    sa = _load_service_account_from_env()
    if sa:
        cred = credentials.Certificate(sa)
        app = firebase_admin.initialize_app(cred)
        proj = app.project_id if hasattr(app, "project_id") else sa.get("project_id")
        return True, proj

    # Fall back to ADC (Cloud Run / local gcloud)
    try:
        cred = credentials.ApplicationDefault()
        app = firebase_admin.initialize_app(cred)
        proj = app.project_id if hasattr(app, "project_id") else None
        return True, proj
    except Exception:
        # Not configured (caller decides whether to 500/401)
        return False, None

