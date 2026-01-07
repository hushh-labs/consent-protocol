/**
 * Kai Service — API Integration
 *
 * Calls backend /api/kai/* endpoints.
 * Stateless Zero-Knowledge Architecture:
 * - No Sessions.
 * - Client manages Risk Profile & Preferences.
 * - Client Handles Encryption.
 */

import { Capacitor } from "@capacitor/core";

const getApiBase = () => {
  if (Capacitor.isNativePlatform()) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  }
  // Web: Use relative path for proxy
  return "";
};

const API_BASE = getApiBase();

// ============================================================================
// TYPES
// ============================================================================

export interface GrantConsentRequest {
  user_id: string;
  scopes?: string[];
}

export interface GrantConsentResponse {
  consent_id: string;
  tokens: Record<string, string>;
  expires_at: string;
}

export interface AnalyzeResponse {
  decision_id: string;
  ticker: string;
  decision: "buy" | "hold" | "reduce";
  confidence: number;
  headline: string;
  processing_mode: string;
  created_at: string;
  raw_card: Record<string, any>; // Full data for encryption
}

export interface EncryptedDecision {
  id: number;
  decision_ciphertext: string;
  iv: string;
  tag: string;
  created_at: string;
  user_id: string;
  ticker: string;
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Grant consent for Kai data access
 * Stateless.
 */
export async function grantKaiConsent(
  userId: string,
  scopes: string[] = [
    "vault.read.risk_profile",
    "vault.write.decision",
    "agent.kai.analyze",
  ]
): Promise<GrantConsentResponse> {
  const response = await fetch(`${API_BASE}/api/kai/consent/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, scopes }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to grant consent");
  }

  return response.json();
}

/**
 * Step 1: Analyze Ticker (Returns Plaintext)
 * Stateless: Pass risk profile and mode explicitly.
 */
export async function analyzeTicker(params: {
  user_id: string;
  ticker: string;
  consent_token: string;
  risk_profile: "conservative" | "balanced" | "aggressive";
  processing_mode: "on_device" | "hybrid";
}): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/api/kai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Analysis failed");
  }

  return response.json();
}

/**
 * Step 2: Store Encrypted Decision
 * Call this after encrypting the `raw_card` from Step 1.
 */
export async function storeDecision(params: {
  user_id: string;
  ticker: string;
  decision_type: string;
  confidence_score: number;
  decision_ciphertext: string; // Encrypted JSON
  iv: string;
  tag: string;
}): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/kai/decision/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to store decision");
  }

  return response.json();
}

/**
 * Get Encrypted Decision (for local decryption)
 */
export async function getDecision(
  decisionId: number
): Promise<EncryptedDecision> {
  const response = await fetch(`${API_BASE}/api/kai/decision/${decisionId}`);

  if (!response.ok) {
    throw new Error("Decision not found");
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

/**
 * Store Encrypted Preferences (Risk Profile, Mode)
 */
export async function storePreferences(params: {
  user_id: string;
  preferences: Array<{
    field_name: string;
    ciphertext: string;
    iv: string;
    tag: string;
  }>;
}): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/kai/preferences/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to store preferences");
  }

  return response.json();
}

/**
 * Get Encrypted Preferences
 */
export async function getPreferences(userId: string): Promise<{
  preferences: Array<{
    field_name: string;
    ciphertext: string;
    iv: string;
    tag: string;
  }>;
}> {
  const response = await fetch(`${API_BASE}/api/kai/preferences/${userId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch preferences");
  }

  return response.json();
}
