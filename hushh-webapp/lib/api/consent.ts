/**
 * Consent API Client
 * ==================
 * 
 * Client for interacting with the Hushh Consent API.
 */

const API_BASE = process.env.NEXT_PUBLIC_CONSENT_API_URL || "http://localhost:8000";

// ============================================================================
// Types
// ============================================================================

export interface ConsentToken {
  token: string;
  user_id: string;
  agent_id: string;
  scope: string;
  issued_at: number;
  expires_at: number;
}

export interface ConsentScope {
  value: string;
  name: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Issue a new consent token for a user/agent/scope combination.
 */
export async function issueToken(
  userId: string,
  agentId: string,
  scope: string
): Promise<ConsentToken> {
  const response = await fetch(`${API_BASE}/api/consent/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      agent_id: agentId,
      scope: scope,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to issue token");
  }

  return response.json();
}

/**
 * Validate a consent token.
 */
export async function validateToken(
  token: string,
  expectedScope?: string
): Promise<{ valid: boolean; error?: string; user_id?: string }> {
  const response = await fetch(`${API_BASE}/api/consent/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      expected_scope: expectedScope,
    }),
  });

  return response.json();
}

/**
 * Revoke a consent token.
 */
export async function revokeToken(token: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/consent/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error("Failed to revoke token");
  }

  return response.json();
}

/**
 * Get available consent scopes.
 */
export async function getScopes(): Promise<ConsentScope[]> {
  const response = await fetch(`${API_BASE}/api/consent/scopes`);
  const data = await response.json();
  return data.scopes;
}
