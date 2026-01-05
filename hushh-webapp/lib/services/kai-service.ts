/**
 * Kai Service — API Integration
 *
 * Calls backend /api/kai/* endpoints for session management.
 * Uses existing MCP consent infrastructure.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// TYPES
// ============================================================================

export interface KaiSession {
  session_id: string;
  user_id: string;
  processing_mode: "on_device" | "hybrid" | null;
  risk_profile: "conservative" | "balanced" | "aggressive" | null;
  legal_acknowledged: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrantConsentResponse {
  consent_id: string;
  token: string;
  scopes: string[];
  issued_at: string;
  expires_at: string;
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Start a new Kai onboarding session
 */
export async function startKaiSession(
  userId: string
): Promise<{ session_id: string }> {
  const response = await fetch(`${API_BASE}/api/kai/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to start session");
  }

  return response.json();
}

/**
 * Get current session state
 */
export async function getKaiSession(sessionId: string): Promise<KaiSession> {
  const response = await fetch(`${API_BASE}/api/kai/session/${sessionId}`);

  if (!response.ok) {
    throw new Error("Session not found");
  }

  return response.json();
}

/**
 * Get user's most recent session
 */
export async function getUserKaiSession(
  userId: string
): Promise<KaiSession | null> {
  const response = await fetch(`${API_BASE}/api/kai/session/user/${userId}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Update session preferences
 */
export async function updateKaiSession(
  sessionId: string,
  updates: {
    processing_mode?: "on_device" | "hybrid";
    risk_profile?: "conservative" | "balanced" | "aggressive";
    legal_acknowledged?: boolean;
    onboarding_complete?: boolean;
  }
): Promise<KaiSession> {
  const response = await fetch(`${API_BASE}/api/kai/session/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to update session");
  }

  return response.json();
}

/**
 * Grant consent for Kai data access
 * Uses existing MCP consent infrastructure
 */
export async function grantKaiConsent(
  sessionId: string,
  scopes: string[] = [
    "vault.read.risk_profile",
    "vault.write.decision",
    "agent.kai.analyze",
  ]
): Promise<GrantConsentResponse> {
  const response = await fetch(
    `${API_BASE}/api/kai/session/${sessionId}/consent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, scopes }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to grant consent");
  }

  return response.json();
}

/**
 * Check Kai API health
 */
export async function checkKaiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/kai/health`);
    return response.ok;
  } catch {
    return false;
  }
}
