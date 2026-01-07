/**
 * Kai Service — Direct Plugin Integration
 *
 * Calls Kai plugin directly for platform-aware backend communication.
 * - Web: Kai plugin uses Next.js API proxy
 * - Mobile: Kai plugin makes native HTTP calls to backend
 */

import { Capacitor } from "@capacitor/core";
import { Kai } from "@/lib/capacitor/kai";
import { HushhAuth } from "@/lib/capacitor";

// ============================================================================
// TYPES
// ============================================================================

export interface GrantConsentResponse {
  token: string;
  expires_at: string;
}

export interface AnalyzeResponse {
  ticker: string;
  decision: "buy" | "hold" | "reduce";
  confidence: number;
  headline: string;
  processing_mode: string;
  created_at?: string; // Optional - may not be in response
  raw_card: Record<string, any>;
}

// ============================================================================
// HELPER
// ============================================================================

async function getAuthToken(): Promise<string | undefined> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { idToken } = await HushhAuth.getIdToken();
      return idToken || undefined;
    } catch (e) {
      console.warn("[Kai Service] Failed to get auth token:", e);
    }
  }
  return undefined;
}

// ============================================================================
// API CALLS (Via Kai Plugin)
// ============================================================================

/**
 * Grant Kai Consent
 */
export async function grantKaiConsent(
  userId: string,
  scopes?: string[]
): Promise<GrantConsentResponse> {
  const authToken = await getAuthToken();

  return Kai.grantConsent({
    userId,
    scopes: scopes || [
      "vault.read.risk_profile",
      "vault.write.decision",
      "agent.kai.analyze",
    ],
    authToken,
  });
}

/**
 * Analyze Ticker
 */
export async function analyzeTicker(params: {
  user_id: string;
  ticker: string;
  consent_token: string;
  risk_profile: "conservative" | "balanced" | "aggressive";
  processing_mode: "on_device" | "hybrid";
}): Promise<AnalyzeResponse> {
  const authToken = await getAuthToken();

  const result = await Kai.analyze({
    userId: params.user_id,
    ticker: params.ticker,
    consentToken: params.consent_token,
    riskProfile: params.risk_profile,
    processingMode: params.processing_mode,
    authToken,
  });

  // Plugin returns the full response, just return it
  return result as AnalyzeResponse;
}

/**
 * Store Encrypted Preferences
 */
export async function storePreferences(
  userId: string,
  preferencesEncrypted: string
): Promise<{ success: boolean }> {
  const authToken = await getAuthToken();

  return Kai.storePreferences({
    userId,
    preferencesEncrypted,
    authToken,
  });
}

/**
 * Get Encrypted Preferences
 */
export async function getPreferences(
  userId: string
): Promise<{ preferences: any[] }> {
  const authToken = await getAuthToken();

  return Kai.getPreferences({
    userId,
    authToken,
  });
}
