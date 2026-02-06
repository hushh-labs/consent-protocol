/**
 * Kai Service — Direct Plugin Integration
 *
 * Calls Kai plugin directly for platform-aware backend communication.
 * - Web: Kai plugin uses Next.js API proxy
 * - Mobile: Kai plugin makes native HTTP calls to backend
 *
 * Authentication:
 * - All consent-gated operations use VAULT_OWNER token
 * - Token is retrieved from sessionStorage (synced from VaultContext)
 * - Firebase token is only used for bootstrap (issuing VAULT_OWNER token)
 */

import { Capacitor } from "@capacitor/core";
import { Kai, type KaiEncryptedPreference } from "@/lib/capacitor/kai";
import { HushhIdentity } from "@/lib/capacitor";
import { apiJson } from "@/lib/services/api-client";
import { ApiService, getDirectBackendUrl } from "@/lib/services/api-service";
import { AuthService } from "@/lib/services/auth-service";

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
// HELPER - VAULT_OWNER TOKEN (Consent-First)
// ============================================================================

/**
 * Get VAULT_OWNER token from sessionStorage.
 * This is the primary authentication token for all consent-gated operations.
 * Returns undefined if vault is not unlocked.
 */
function getVaultOwnerToken(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const token = sessionStorage.getItem("vault_owner_token");
  return token || undefined;
}

/**
 * Get VAULT_OWNER token or throw if not available.
 * Use this for operations that require consent.
 */
function requireVaultOwnerToken(): string {
  const token = getVaultOwnerToken();
  if (!token) {
    throw new Error("Vault must be unlocked to perform this operation");
  }
  return token;
}

// ============================================================================
// API CALLS (Via Kai Plugin)
// ============================================================================

/**
 * Grant Kai Consent
 * Note: This is a bootstrap operation that may use Firebase token
 * to issue a consent token. After this, use VAULT_OWNER token.
 */
export async function grantKaiConsent(
  userId: string,
  scopes?: string[]
): Promise<GrantConsentResponse> {
  // grantConsent is a bootstrap operation - backend requires Firebase ID token.
  const authToken = await AuthService.getIdToken();
  if (!authToken) {
    throw new Error("Missing Firebase ID token for Kai consent grant");
  }

  return Kai.grantConsent({
    userId,
    // Updated to use dynamic attr.* scopes instead of legacy vault.read.*/vault.write.*
    scopes: scopes || [
      "attr.financial.risk_profile", // Replaces vault.read.risk_profile
      "attr.kai_decisions.*", // Replaces vault.write.decision
      "agent.kai.analyze",
    ],
    authToken,
  });
}

/**
 * Analyze Ticker
 * Requires VAULT_OWNER token for consent-gated data access.
 */
export async function analyzeTicker(params: {
  user_id: string;
  ticker: string;
  consent_token: string;
  risk_profile: "conservative" | "balanced" | "aggressive";
  processing_mode: "on_device" | "hybrid";
}): Promise<AnalyzeResponse> {
  const vaultOwnerToken = requireVaultOwnerToken();

  const result = await Kai.analyze({
    userId: params.user_id,
    ticker: params.ticker,
    consentToken: params.consent_token,
    riskProfile: params.risk_profile,
    processingMode: params.processing_mode,
    vaultOwnerToken,
  });

  // Plugin returns the full response, just return it
  return result as AnalyzeResponse;
}

/**
 * Store Encrypted Preferences
 * Requires VAULT_OWNER token for consent-gated data access.
 */
export async function storePreferences(
  userId: string,
  preferences: KaiEncryptedPreference[],
  vaultOwnerToken?: string
): Promise<{ success: boolean }> {
  // Use provided token or get from sessionStorage
  const token = vaultOwnerToken || requireVaultOwnerToken();

  return Kai.storePreferences({
    userId,
    preferences,
    vaultOwnerToken: token,
  });
}

/**
 * Get Encrypted Preferences
 * Requires VAULT_OWNER token for consent-gated data access.
 */
export async function getPreferences(
  userId: string,
  vaultOwnerToken?: string
): Promise<{ preferences: any[] }> {
  const isNative = Capacitor.isNativePlatform();
  console.log(
    "[KaiService] getPreferences - Platform:",
    isNative ? "NATIVE" : "WEB"
  );
  console.log("[KaiService] Capacitor platform:", Capacitor.getPlatform());
  console.log("[KaiService] userId:", userId);

  // Use provided token or get from sessionStorage
  const token = vaultOwnerToken || requireVaultOwnerToken();
  console.log("[KaiService] vaultOwnerToken present:", !!token);

  try {
    const result = await Kai.getPreferences({
      userId,
      vaultOwnerToken: token,
    });
    console.log(
      "[KaiService] getPreferences success, preferences count:",
      result.preferences?.length || 0
    );
    return result;
  } catch (error: any) {
    console.error("[KaiService] getPreferences error:", error);
    console.error("[KaiService] Error details:", {
      message: error.message,
      stack: error.stack,
      platform: isNative ? "native" : "web",
    });
    throw error;
  }
}

/**
 * Reset (delete) all Kai encrypted preferences for a user.
 * Requires VAULT_OWNER token.
 */
export async function resetPreferences(
  userId: string,
  vaultOwnerToken: string
): Promise<{ success: boolean }> {
  return Kai.resetPreferences({
    userId,
    vaultOwnerToken,
  });
}

/**
 * Get User's Encrypted Investor Profile (Ciphertext)
 * Platform-aware: Uses HushhIdentity plugin on native, Next.js API on web.
 * 
 * Returns camelCase for React components.
 */
export async function getEncryptedProfile(token: string): Promise<{
  profileData: { ciphertext: string; iv: string; tag: string } | null;
}> {
  let result: any;
  
  if (Capacitor.isNativePlatform()) {
    // Native: Use HushhIdentity plugin (direct backend call)
    result = await HushhIdentity.getEncryptedProfile({
      vaultOwnerToken: token,
    });
  } else {
    // Web: Use Next.js API route
    result = await apiJson("/api/identity/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent_token: token }),
    });
  }
  
  // Transform snake_case to camelCase
  const profileData = result?.profile_data || result?.profileData || null;
  return { profileData };
}

/**
 * Analyze ticker with fundamental context (decrypted investor profile).
 * Platform-aware: Uses Kai plugin on native, Next.js API on web.
 * Requires VAULT_OWNER token for consent-gated data access.
 */
export async function analyzeFundamental(params: {
  user_id: string;
  ticker: string;
  risk_profile: "conservative" | "balanced" | "aggressive";
  processing_mode: "on_device" | "hybrid";
  context: any;
  token: string;
}): Promise<any> {
  // Use provided token or get from sessionStorage
  const vaultOwnerToken = params.token || requireVaultOwnerToken();

  // Use Kai plugin (platform-aware)
  return Kai.analyze({
    userId: params.user_id,
    ticker: params.ticker,
    consentToken: params.token,
    riskProfile: params.risk_profile,
    processingMode: params.processing_mode,
    context: params.context, // Include decrypted investor profile context
    vaultOwnerToken,
  });
}

/**
 * Stream Kai analysis (SSE) from backend.
 *
 * NOTE: This is intentionally implemented in the service layer so that
 * components do not call fetch() directly, preserving Tri-Flow rules.
 */
export async function streamKaiAnalysis(params: {
  userId: string;
  ticker: string;
  riskProfile?: string;
  userContext?: string;
  vaultOwnerToken: string;
}): Promise<Response> {
  // SSE streaming is now supported via ApiService.apiFetchStream
  const baseUrl = getDirectBackendUrl();
  const url = `${baseUrl}/api/kai/analyze/stream`;

  const response = await ApiService.apiFetchStream("/api/kai/analyze/stream", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.vaultOwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ticker: params.ticker,
      user_id: params.userId,
      risk_profile: params.riskProfile,
      context: params.userContext,
    }),
  });

  return response;
}

/**
 * Get initial chat state for proactive welcome flow.
 * Platform-aware: Uses Kai plugin on native, Next.js API on web.
 * Requires VAULT_OWNER token for consent-gated data access.
 * 
 * Note: Returns camelCase for React components, transforms from snake_case backend response.
 */
export async function getInitialChatState(userId: string): Promise<{
  isNewUser: boolean;
  hasPortfolio: boolean;
  hasFinancialData: boolean;
  welcomeType: string;
  totalAttributes: number;
  availableDomains: string[];
}> {
  const vaultOwnerToken = requireVaultOwnerToken();

  const result = await Kai.getInitialChatState({
    userId,
    vaultOwnerToken,
  });

  // Transform snake_case to camelCase for React components
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = result as any;
  return {
    isNewUser: raw.is_new_user ?? raw.isNewUser ?? true,
    hasPortfolio: raw.has_portfolio ?? raw.hasPortfolio ?? false,
    hasFinancialData: raw.has_financial_data ?? raw.hasFinancialData ?? false,
    welcomeType: raw.welcome_type ?? raw.welcomeType ?? "new",
    totalAttributes: raw.total_attributes ?? raw.totalAttributes ?? 0,
    availableDomains: raw.available_domains ?? raw.availableDomains ?? [],
  };
}

/**
 * Send a chat message to Kai.
 * Platform-aware: Uses Kai plugin on native, Next.js API on web.
 * Requires VAULT_OWNER token for consent-gated data access.
 * 
 * Note: Returns camelCase for React components, transforms from snake_case backend response.
 */
export async function chat(params: {
  userId: string;
  message: string;
  conversationId?: string;
}): Promise<{
  response: string;
  conversationId: string;
  timestamp: string;
}> {
  const vaultOwnerToken = requireVaultOwnerToken();

  const result = await Kai.chat({
    userId: params.userId,
    message: params.message,
    conversationId: params.conversationId,
    vaultOwnerToken,
  });

  // Transform snake_case to camelCase for React components
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = result as any;
  return {
    response: raw.response || "",
    conversationId: raw.conversation_id || raw.conversationId || "",
    timestamp: raw.timestamp || new Date().toISOString(),
  };
}
