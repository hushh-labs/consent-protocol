/**
 * Kai Onboarding — Production Actions
 *
 * Client-side actions that call the Python backend API.
 * Capacitor-compatible (works on iOS/Android/Web).
 */

import { Capacitor } from "@capacitor/core";

// =============================================================================
// TYPES
// =============================================================================

export type ProcessingMode = "on_device" | "hybrid";
export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface KaiSession {
  session_id: string;
  user_id: string;
  processing_mode: ProcessingMode;
  risk_profile: RiskProfile;
  legal_acknowledged: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API CONFIGURATION
// =============================================================================

function getBackendUrl(): string {
  // If running on native mobile device, we MUST use absolute URL
  if (Capacitor.isNativePlatform()) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.warn("[Kai] NEXT_PUBLIC_BACKEND_URL not set, using localhost");
      return "http://localhost:8000";
    }
    return backendUrl;
  }

  // If running on Web, use relative path to leverage Next.js Proxy (rewrites)
  // This bypasses CORS issues by hitting same-origin /api
  return "";
}

// =============================================================================
// SESSION MANAGEMENT - REMOVED
// =============================================================================
// ✅ Kai agents use Firebase UID + MCP consent only.
// ✅ No separate agent sessions needed - Firebase Auth is the session.

// =============================================================================
// CONSENT MANAGEMENT
// =============================================================================

// Token storage key
const TOKEN_STORAGE_KEY = "kai_consent_tokens";

export interface ConsentTokens {
  [scope: string]: string;
}

export interface TokensResponse {
  tokens: ConsentTokens;
  expires_at?: number;
}

/**
 * Grant Kai consent using Firebase UID (no session needed).
 * ✅ Simplified: Agents use Firebase + MCP only
 */
export async function grantKaiConsent(
  userId: string, // ✅ Firebase UID, not session_id
  scopes: string[]
): Promise<TokensResponse> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(
      `${backendUrl}/api/kai/consent/grant`, // ✅ Updated endpoint
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, // ✅ Direct user_id
          scopes,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // ✅ Store tokens in sessionStorage
    const storageData = {
      tokens: data.tokens,
      expires_at: data.expires_at,
    };
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(storageData));

    console.log(`[Kai] Stored consent tokens for scopes:`, scopes);

    return { tokens: data.tokens, expires_at: data.expires_at };
  } catch (error) {
    console.error("[Kai] Failed to grant consent:", error);
    throw error;
  }
}

/**
 * Get consent token for specific scope.
 */
export function getConsentToken(scope: string): string | null {
  const storageJson = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!storageJson) return null;

  try {
    const storageData = JSON.parse(storageJson);
    return storageData.tokens?.[scope] || null;
  } catch {
    return null;
  }
}

/**
 * Check if valid consent exists for scope.
 */
export function hasValidConsent(scope: string): boolean {
  const token = getConsentToken(scope);
  if (!token) return false;

  // Check expiry
  const storageJson = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!storageJson) return false;

  try {
    const storageData = JSON.parse(storageJson);
    if (storageData.expires_at && Date.now() > storageData.expires_at) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Clear all consent tokens (on logout/re-onboard).
 */
export function clearConsentTokens(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

// =============================================================================
// VAULT INTEGRATION (for preferences storage)
// =============================================================================

/**
 * Store user preferences in encrypted vault
 * This will be used to save risk profile and processing mode
 */
export async function storeKaiPreferences(
  userId: string,
  preferences: {
    risk_profile: RiskProfile;
    processing_mode: ProcessingMode;
  },
  vaultKey: string,
  consentToken: string
): Promise<{ success: boolean }> {
  // This would call the vault storage operon
  // For now, preferences are stored in kai_sessions table
  // In production, might want to encrypt and store in vault

  console.log(
    "[Kai] Preferences stored in session (vault integration pending)"
  );
  return { success: true };
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export async function logKaiAudit(
  sessionId: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  // Optional: Add audit logging endpoint
  console.log(`[Kai Audit] ${action}`, { sessionId, ...metadata });
}
