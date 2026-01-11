/**
 * API Service - Platform-Aware API Routing
 *
 * Production-grade service that handles API calls across platforms:
 * - iOS: Routes to Cloud Run backend (static export has no API routes)
 * - Web: Routes to local Next.js API routes
 *
 * MIGRATION GUIDE:
 * ================
 * When adding new API routes to the Next.js app, follow this checklist:
 *
 * 1. Add the route to Next.js as usual (app/api/...)
 * 2. Add a corresponding method to this service
 * 3. If the route has complex logic, consider adding to native Swift plugin
 * 4. Test on both web AND iOS simulator
 *
 * For routes that need to work offline on iOS, use Capacitor plugins:
 * - VaultService → HushhVault plugin
 * - ConsentService → HushhConsent plugin
 * - AuthService → HushhAuth plugin
 */

import { Capacitor } from "@capacitor/core";
import { HushhVault, HushhAuth } from "@/lib/capacitor";
import { Kai } from "@/lib/capacitor/kai";

// API Base URL configuration
const getApiBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    // iOS/Android: Use Cloud Run backend
    return (
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://consent-protocol-1006304528804.us-central1.run.app"
    );
  }

  // Web: Use relative paths (local Next.js server)
  return "";
};

const API_BASE = getApiBaseUrl();

/**
 * Platform-aware fetch wrapper
 * Automatically adds base URL and common headers
 */
async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE}${path}`;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  return response;
}

/**
 * API Service for platform-aware API calls
 */
export class ApiService {
  /**
   * Platform-aware fetch wrapper (exposed for other services)
   * Automatically adds base URL and common headers
   */
  static async apiFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return apiFetch(path, options);
  }

  // ==================== Auth ====================

  /**
   * Create/update session
   */
  static async createSession(data: {
    userId: string;
    email: string;
    idToken?: string;
    displayName?: string;
    photoUrl?: string;
    emailVerified?: boolean;
    phoneNumber?: string;
  }): Promise<Response> {
    return apiFetch("/api/auth/session", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete session (logout)
   */
  static async deleteSession(): Promise<Response> {
    return apiFetch("/api/auth/session", {
      method: "DELETE",
    });
  }

  // ==================== Consent ====================

  /**
   * Get session token for consent protocol
   */
  static async getSessionToken(data: {
    userId: string;
    scope: string;
    agentId?: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/session-token", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Logout from consent protocol
   */
  static async consentLogout(data: { token: string }): Promise<Response> {
    return apiFetch("/api/consent/logout", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Approve pending consent
   */
  static async approvePendingConsent(data: {
    token?: string;
    requestId?: string;
    userId: string;
    encryptedData?: string;
    encryptedIv?: string;
    encryptedTag?: string;
    exportKey?: string;
  }): Promise<Response> {
    const requestId = data.requestId || data.token;

    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");
        const authToken = await this.getFirebaseToken();

        await HushhConsent.approve({
          requestId: requestId!,
          userId: data.userId,
          encryptedData: data.encryptedData,
          encryptedIv: data.encryptedIv,
          encryptedTag: data.encryptedTag,
          exportKey: data.exportKey,
          authToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        console.error("[ApiService] Native approvePendingConsent error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/consent/pending/approve", {
      method: "POST",
      body: JSON.stringify({
        userId: data.userId,
        requestId,
        encryptedData: data.encryptedData,
        encryptedIv: data.encryptedIv,
        encryptedTag: data.encryptedTag,
        exportKey: data.exportKey,
      }),
    });
  }

  /**
   * Deny pending consent
   */
  static async denyPendingConsent(data: {
    token?: string;
    requestId?: string;
    userId: string;
  }): Promise<Response> {
    const requestId = data.requestId || data.token;

    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");
        const authToken = await this.getFirebaseToken();

        await HushhConsent.deny({
          requestId: requestId!,
          userId: data.userId,
          authToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        console.error("[ApiService] Native denyPendingConsent error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/consent/pending/deny", {
      method: "POST",
      body: JSON.stringify({ userId: data.userId, requestId }),
    });
  }

  /**
   * Revoke consent
   * Route: POST /api/consent/revoke
   */
  static async revokeConsent(data: {
    token: string;
    userId: string;
    scope?: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");
        const authToken = await this.getFirebaseToken();

        // Use new revokeConsent that calls the backend
        await HushhConsent.revokeConsent({
          userId: data.userId,
          scope: data.scope || "",
          authToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        console.error("[ApiService] Native revokeConsent error:", e);
        return new Response(e.message || "Failed", { status: 500 });
      }
    }

    return apiFetch("/api/consent/revoke", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get pending consent requests
   * Route: GET /api/consent/pending?userId=xxx
   */
  static async getPendingConsents(userId: string): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { pending } = await HushhVault.getPendingConsents({
          userId,
          authToken,
        });
        return new Response(JSON.stringify({ pending: pending || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: any) {
        console.warn("[ApiService] Native getPendingConsents error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }
    return apiFetch(
      `/api/consent/pending?userId=${encodeURIComponent(userId)}`
    );
  }

  /**
   * Get active consents
   * Route: GET /api/consent/active?userId=xxx
   */
  static async getActiveConsents(userId: string): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { active } = await HushhVault.getActiveConsents({
          userId,
          authToken,
        });
        return new Response(JSON.stringify({ active: active || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: any) {
        console.warn("[ApiService] Native getActiveConsents error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }
    return apiFetch(`/api/consent/active?userId=${encodeURIComponent(userId)}`);
  }

  /**
   * Get consent history/audit log
   * Route: GET /api/consent/history?userId=xxx&page=1&limit=50
   */
  static async getConsentHistory(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { items } = await HushhVault.getConsentHistory({
          userId,
          authToken,
          page,
          limit,
        });
        return new Response(JSON.stringify({ items: items || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: any) {
        console.warn("[ApiService] Native getConsentHistory error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }
    return apiFetch(
      `/api/consent/history?userId=${encodeURIComponent(
        userId
      )}&page=${page}&limit=${limit}`
    );
  }

  /**
   * Cancel consent request
   * Route: POST /api/consent/cancel
   */
  static async cancelConsent(data: {
    userId: string;
    requestId: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/cancel", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Vault ====================
  // Mirrors: /api/vault/* routes

  /**
   * Check if user has a vault
   * Route: GET /api/vault/check?userId=xxx
   */
  static async checkVault(userId: string): Promise<Response> {
    return apiFetch(`/api/vault/check?userId=${encodeURIComponent(userId)}`);
  }

  /**
   * Get vault key data
   * Route: GET /api/vault/get?userId=xxx
   */
  static async getVault(userId: string): Promise<Response> {
    return apiFetch(`/api/vault/get?userId=${encodeURIComponent(userId)}`);
  }

  /**
   * Setup vault for new user
   * Route: POST /api/vault/setup
   */
  static async setupVault(data: {
    userId: string;
    authMethod?: string;
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/setup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get food preferences (encrypted)
   * Route: GET /api/vault/food?userId=xxx
   */
  static async getFoodPreferences(
    userId: string,
    sessionToken?: string
  ): Promise<Response> {
    const headers: HeadersInit = {};
    let url = `/api/vault/food?userId=${encodeURIComponent(userId)}`;

    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
      url += `&sessionToken=${encodeURIComponent(sessionToken)}`;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { preferences } = await HushhVault.getFoodPreferences({
          userId,
          authToken,
          sessionToken,
        });

        if (!preferences) {
          return new Response(null, { status: 404 });
        }

        return new Response(JSON.stringify({ preferences }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native getFoodPreferences error:", error);
        return new Response(null, { status: 500 });
      }
    }

    return apiFetch(url, { headers });
  }

  /**
   * Store food preferences (encrypted)
   * Route: POST /api/vault/food
   */
  static async storeFoodPreferences(data: {
    userId: string;
    preferences: Record<string, unknown>;
    consentToken?: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/food", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Store single encrypted food preference field (used by Chat Agent)
   */
  static async storeEncryptedFoodPreference(data: {
    userId: string;
    fieldName: string;
    ciphertext: string;
    iv: string;
    tag: string;
    consentTokenId: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/food", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get professional profile (encrypted)
   * Route: GET /api/vault/professional?userId=xxx
   */
  static async getProfessionalProfile(
    userId: string,
    sessionToken?: string
  ): Promise<Response> {
    const headers: HeadersInit = {};
    let url = `/api/vault/professional?userId=${encodeURIComponent(userId)}`;

    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
      url += `&sessionToken=${encodeURIComponent(sessionToken)}`;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { preferences } = await HushhVault.getProfessionalData({
          userId,
          authToken,
          sessionToken,
        });

        if (!preferences) {
          return new Response(null, { status: 404 });
        }

        return new Response(JSON.stringify({ preferences }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(
          "[ApiService] Native getProfessionalProfile error:",
          error
        );
        return new Response(null, { status: 500 });
      }
    }

    return apiFetch(url, { headers });
  }

  /**
   * Store professional profile (encrypted)
   * Route: POST /api/vault/professional
   */
  static async storeProfessionalProfile(data: {
    userId: string;
    preferences: Record<string, unknown>;
    consentToken?: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/professional", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Store preferences to vault (generic)
   * Route: POST /api/vault/store-preferences
   */
  static async storePreferences(data: {
    userId: string;
    preferences: Record<string, any>;
    consentToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const promises = [];

        // Iterate through all preference keys and store them individually
        // This maps to the /db/$domain/store endpoint via the plugin
        for (const [key, value] of Object.entries(data.preferences)) {
          // Value is expected to be the encrypted string JSON with {ciphertext, iv, tag}
          // But wait, encryptData returns {ciphertext, iv, salt, ...}
          // The plugin expects: domain, fieldName, ciphertext, iv, tag, consentTokenId

          // We need to determine the 'domain' for each key.
          // Food: dietary_restrictions, cuisine_preferences, monthly_food_budget
          // Professional: professional_title, skills, experience_level, job_preferences

          let domain = "general";
          if (
            [
              "dietary_restrictions",
              "cuisine_preferences",
              "monthly_food_budget",
            ].includes(key)
          ) {
            domain = "food";
          } else if (
            [
              "professional_title",
              "skills",
              "experience_level",
              "job_preferences",
            ].includes(key)
          ) {
            domain = "professional";
          }

          // The 'value' coming from saveToVault is result of encryptData() which is { ciphertext, iv, salt, tag? }
          // Let's verify encryptData return type.

          promises.push(
            HushhVault.storePreferencesToCloud({
              userId: data.userId,
              domain: domain,
              fieldName: key,
              ciphertext: value.ciphertext,
              iv: value.iv,
              tag: value.tag || "",
              consentTokenId: data.consentToken,
              authToken: authToken,
            })
          );
        }

        await Promise.all(promises);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        console.error("❌ [ApiService] Native storePreferences error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/vault/store-preferences", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Chat/Agents ====================

  /**
   * Send message to chat agent
   */
  static async sendChatMessage(data: {
    message: string;
    userId: string;
    agentId?: string;
    sessionState?: Record<string, unknown>;
  }): Promise<Response> {
    return apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Send message to food dining agent
   */
  static async sendFoodAgentMessage(data: {
    message: string;
    userId: string;
    sessionState?: Record<string, unknown>;
  }): Promise<Response> {
    return apiFetch("/api/agents/food-dining/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Helpers ====================

  /**
   * Get the configured API base URL
   */
  static getBaseUrl(): string {
    return API_BASE;
  }

  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  // Helper to get Firebase ID Token for Native calls
  private static async getFirebaseToken(): Promise<string | undefined> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { idToken } = await HushhAuth.getIdToken();
        return idToken || undefined;
      } catch (e) {
        console.warn("[ApiService] Failed to get native ID token:", e);
      }
    }
    return undefined;
  }

  // ==================== Kai Agent Methods ====================

  /**
   * Grant Kai Consent
   */
  static async kaiGrantConsent(data: {
    userId: string;
    scopes?: string[];
  }): Promise<Response> {
    const scopes = data.scopes || [
      "vault.read.risk_profile",
      "vault.write.decision",
      "agent.kai.analyze",
    ];

    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const result = await Kai.grantConsent({
          userId: data.userId,
          scopes,
          authToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[ApiService] Native kaiGrantConsent error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/kai/consent/grant", {
      method: "POST",
      body: JSON.stringify({ user_id: data.userId, scopes }),
    });
  }

  /**
   * Analyze stock ticker
   */
  static async kaiAnalyze(data: {
    userId: string;
    ticker: string;
    consentToken: string;
    riskProfile: string;
    processingMode: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const result = await Kai.analyze({
          userId: data.userId,
          ticker: data.ticker,
          consentToken: data.consentToken,
          riskProfile: data.riskProfile,
          processingMode: data.processingMode,
          authToken,
        });

        return new Response(JSON.stringify(result.decision), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[ApiService] Native kaiAnalyze error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/kai/analyze", {
      method: "POST",
      body: JSON.stringify({
        user_id: data.userId,
        ticker: data.ticker,
        consent_token: data.consentToken,
        risk_profile: data.riskProfile,
        processing_mode: data.processingMode,
      }),
    });
  }

  /**
   * Store Kai preferences
   */
  static async kaiStorePreferences(data: {
    userId: string;
    preferences: any[];
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const result = await Kai.storePreferences({
          userId: data.userId,
          preferences: data.preferences as any,
          authToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[ApiService] Native kaiStorePreferences error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/kai/preferences/store", {
      method: "POST",
      body: JSON.stringify({
        user_id: data.userId,
        preferences: data.preferences,
      }),
    });
  }

  /**
   * Get Kai preferences
   */
  static async kaiGetPreferences(data: { userId: string }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const result = await Kai.getPreferences({
          userId: data.userId,
          authToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[ApiService] Native kaiGetPreferences error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
        });
      }
    }

    return apiFetch(`/api/kai/preferences/${data.userId}`, {
      method: "GET",
    });
  }
}

// Re-export for convenience
export { getApiBaseUrl };
