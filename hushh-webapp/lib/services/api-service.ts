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
    // iOS/Android: Use backendUrl (Cloud Run in prod, localhost in local dev).
    // IMPORTANT: Android emulator cannot reach host localhost; use 10.0.2.2.
    const raw =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://consent-protocol-1006304528804.us-central1.run.app";

    const normalized =
      Capacitor.getPlatform() === "android" && raw.includes("localhost")
        ? raw.replace("localhost", "10.0.2.2")
        : raw;

    return normalized.replace(/\/$/, "");
  }

// Web: Use relative paths (local Next.js server)
  return "";
};

// Direct Backend URL for streaming (bypasses Next.js proxy)
export const getDirectBackendUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    return getApiBaseUrl(); // Native already points to backend
  }

  // Allow override via environment variable (works in both dev and prod builds)
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");
  }

  // Default to localhost for flexibility (user can override for prod)
  return "http://localhost:8000";
};

const API_BASE = getApiBaseUrl();

/**
 * Platform-aware fetch wrapper
 * Automatically adds base URL and common headers
 *
 * Wrapped with API progress tracking so the route progress bar can reflect
 * real network activity across the app.
 */
async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE}${path}`;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Dynamically import tracker to avoid creating a hard dependency for environments
  // that don't care about progress (e.g., certain server-side usage).
  let trackStart: (() => void) | undefined;
  let trackEnd: (() => void) | undefined;
  try {
    const tracker = await import("../motion/api-progress-tracker");
    trackStart = tracker.trackRequestStart;
    trackEnd = tracker.trackRequestEnd;
  } catch {
    // If tracker cannot be loaded, we silently ignore and continue.
  }

  trackStart?.();
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    return response;
  } finally {
    trackEnd?.();
  }
}

/**
 * API Service for platform-aware API calls
 */
export class ApiService {
  // ==================== Auth Helpers ====================

  /**
   * Get auth headers for API requests.
   * 
   * Returns headers object with Authorization if vault_owner_token is available.
   * This is the centralized method for getting auth headers - use this instead
   * of manually constructing Authorization headers.
   * 
   * @returns HeadersInit object with Authorization header if token exists
   */
  static getAuthHeaders(): HeadersInit {
    if (typeof window === "undefined") {
      return {};
    }
    const token = sessionStorage.getItem("vault_owner_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Get the vault owner token from session storage.
   * 
   * @returns The vault owner token or null if not available
   */
  static getVaultOwnerToken(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    return sessionStorage.getItem("vault_owner_token");
  }

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

  /**
   * Platform-aware fetch wrapper for Streaming/SSE
   * Returns the raw Response object for stream consumption.
   */
  static async apiFetchStream(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return apiFetch(path, {
      ...options,
      headers: {
        ...options.headers,
        Accept: "text/event-stream",
      },
    });
  }

  /**
   * Get direct backend URL (bypassing proxy)
   */
  static getDirectBackendUrl(): string {
    return getDirectBackendUrl();
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
   * Requires VAULT_OWNER token for authentication.
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
    const vaultOwnerToken = this.getVaultOwnerToken();

    if (!vaultOwnerToken) {
      return new Response(
        JSON.stringify({ error: "Vault must be unlocked" }),
        { status: 401 }
      );
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");

        await HushhConsent.approve({
          requestId: requestId!,
          userId: data.userId,
          encryptedData: data.encryptedData,
          encryptedIv: data.encryptedIv,
          encryptedTag: data.encryptedTag,
          exportKey: data.exportKey,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        console.error("[ApiService] Native approvePendingConsent error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/consent/pending/approve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vaultOwnerToken}`,
      },
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
   * Requires VAULT_OWNER token for authentication.
   */
  static async denyPendingConsent(data: {
    token?: string;
    requestId?: string;
    userId: string;
  }): Promise<Response> {
    const requestId = data.requestId || data.token;
    const vaultOwnerToken = this.getVaultOwnerToken();

    if (!vaultOwnerToken) {
      return new Response(
        JSON.stringify({ error: "Vault must be unlocked" }),
        { status: 401 }
      );
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");

        await HushhConsent.deny({
          requestId: requestId!,
          userId: data.userId,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        console.error("[ApiService] Native denyPendingConsent error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/consent/pending/deny", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vaultOwnerToken}`,
      },
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

        // Use revokeConsent that calls the backend and returns lockVault flag
        const result = await HushhConsent.revokeConsent({
          userId: data.userId,
          scope: data.scope || "",
          vaultOwnerToken: authToken,
        });

        // Pass through the lockVault flag from native plugin response
        return new Response(
          JSON.stringify({ 
            success: true, 
            lockVault: result.lockVault ?? false 
          }), 
          { status: 200 }
        );
      } catch (e) {
        console.error("[ApiService] Native revokeConsent error:", e);
        return new Response((e as Error).message || "Failed", { status: 500 });
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
   * Requires VAULT_OWNER token for authentication.
   */
  static async getPendingConsents(userId: string): Promise<Response> {
    const vaultOwnerToken = this.getVaultOwnerToken();

    if (!vaultOwnerToken) {
      return new Response(
        JSON.stringify({ error: "Vault must be unlocked" }),
        { status: 401 }
      );
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { pending } = await HushhVault.getPendingConsents({
          userId,
          vaultOwnerToken,
        });
        return new Response(JSON.stringify({ pending: pending || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.warn("[ApiService] Native getPendingConsents error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }
    return apiFetch(
      `/api/consent/pending?userId=${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${vaultOwnerToken}`,
        },
      }
    );
  }

  /**
   * Get active consents
   * Route: GET /api/consent/active?userId=xxx
   */
  static async getActiveConsents(userId: string, token?: string): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const { active } = await HushhVault.getActiveConsents({
          userId,
          vaultOwnerToken: authToken,
        });
        return new Response(JSON.stringify({ active: active || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.warn("[ApiService] Native getActiveConsents error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }
    
    // Web: Pass token in Authorization header if available
    const options: RequestInit = {};
    if (token) {
      options.headers = {
        Authorization: `Bearer ${token}`
      };
    }
    
    return apiFetch(`/api/consent/active?userId=${encodeURIComponent(userId)}`, options);
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
      } catch (e) {
        console.warn("[ApiService] Native getConsentHistory error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
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
   * Get vault status (domain counts without encrypted data)
   * Requires VAULT_OWNER token
   *
   * Platform routing:
   * - Native: Direct backend call → /db/vault/status
   * - Web: Next.js proxy → Backend
   *
   * Route: GET /api/vault/status (web) or POST /db/vault/status (native)
   */
  static async getVaultStatus(
    userId: string,
    vaultOwnerToken: string
  ): Promise<Response> {
    // Native: Call backend directly
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();

        const response = await fetch(`${API_BASE}/db/vault/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ userId, consentToken: vaultOwnerToken }),
        });

        return response;
      } catch (error) {
        console.error("[ApiService] Native getVaultStatus error:", error);
        return new Response(null, { status: 500 });
      }
    }

    // Web: Use Next.js proxy
    const url = `/api/vault/status?userId=${encodeURIComponent(
      userId
    )}&consentToken=${encodeURIComponent(vaultOwnerToken)}`;
    return apiFetch(url, { method: "GET" });
  }

  /**
   * Get food preferences (encrypted)
   * Requires VAULT_OWNER token for consent-first architecture
   *
   * Platform routing:
   * - Native: HushhVault plugin → Backend (direct)
   * - Web: Next.js proxy → Backend
   *
   * Route: POST /api/vault/food/preferences (web) or direct backend call (native)
   */
  static async getFoodPreferences(
    userId: string,
    vaultOwnerToken: string
  ): Promise<Response> {
    // Native: Use plugin (bypasses Next.js, calls backend directly)
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();

        const { preferences } = await HushhVault.getFoodPreferences({
          userId,
          vaultOwnerToken,
          authToken,
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

    // Web: Use Next.js proxy with token in query param
    const url = `/api/vault/food/preferences?userId=${encodeURIComponent(
      userId
    )}&consentToken=${encodeURIComponent(vaultOwnerToken)}`;
    return apiFetch(url, { method: "GET" });
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
   * Store single encrypted food preference field
   *
   * Platform routing:
   * - Web: POST /api/vault/food → Python /api/food/preferences/store
   * - Native: HushhVault.storePreferencesToCloud → Python /api/food/preferences/store
   */
  static async storeFoodPreference(data: {
    userId: string;
    fieldName: string;
    ciphertext: string;
    iv: string;
    tag: string;
    consentToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        await HushhVault.storePreferencesToCloud({
          userId: data.userId,
          domain: "food",
          fieldName: data.fieldName,
          ciphertext: data.ciphertext,
          iv: data.iv,
          tag: data.tag,
          consentToken: data.consentToken,
          authToken: authToken,
        });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        console.error("❌ [ApiService] Native storeFoodPreference error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }

    // Web: Use Next.js proxy
    return apiFetch("/api/vault/food", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Store single encrypted food preference field (used by Chat Agent)
   * @deprecated Use storeFoodPreference instead
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
   * Requires VAULT_OWNER token for consent-first architecture
   *
   * Platform routing:
   * - Native: HushhVault plugin → Backend (direct)
   * - Web: Next.js proxy → Backend
   *
   * Route: POST /api/vault/professional/preferences (web) or direct backend call (native)
   */
  static async getProfessionalProfile(
    userId: string,
    vaultOwnerToken: string
  ): Promise<Response> {
    // Native: Use plugin (bypasses Next.js, calls backend directly)
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();

        const { preferences } = await HushhVault.getProfessionalData({
          userId,
          vaultOwnerToken,
          authToken,
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

    // Web: Use Next.js proxy with token in query param
    const url = `/api/vault/professional/preferences?userId=${encodeURIComponent(
      userId
    )}&consentToken=${encodeURIComponent(vaultOwnerToken)}`;
    return apiFetch(url, { method: "GET" });
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
   * Store single encrypted professional preference field
   *
   * Platform routing:
   * - Web: POST /api/vault/professional → Python /api/professional/preferences/store
   * - Native: HushhVault.storePreferencesToCloud → Python /api/professional/preferences/store
   */
  static async storeProfessionalPreference(data: {
    userId: string;
    fieldName: string;
    ciphertext: string;
    iv: string;
    tag: string;
    consentToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        await HushhVault.storePreferencesToCloud({
          userId: data.userId,
          domain: "professional",
          fieldName: data.fieldName,
          ciphertext: data.ciphertext,
          iv: data.iv,
          tag: data.tag,
          consentToken: data.consentToken,
          authToken: authToken,
        });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        console.error(
          "❌ [ApiService] Native storeProfessionalPreference error:",
          e
        );
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
        });
      }
    }

    // Web: Use Next.js proxy
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
    domain?: string;
    preferences: Record<string, any>;
    consentToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        const promises = [];

        // Iterate through all preference keys and store them individually
        // This maps to the /api/$domain/preferences/store endpoint via the plugin
        for (const [key, value] of Object.entries(data.preferences)) {
          // Use explicit domain if provided, otherwise auto-detect from field name
          let domain = data.domain || "general";
          if (!data.domain) {
            // Auto-detect domain from field name (fallback)
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
          }
          promises.push(
            HushhVault.storePreferencesToCloud({
              userId: data.userId,
              domain: domain,
              fieldName: key,
              ciphertext: value.ciphertext,
              iv: value.iv,
              tag: value.tag || "",
              consentToken: data.consentToken,
              authToken: authToken,
            })
          );
        }

        await Promise.all(promises);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        console.error("❌ [ApiService] Native storePreferences error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
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
    // Updated to use dynamic attr.* scopes instead of legacy vault.read.*/vault.write.*
    const scopes = data.scopes || [
      "attr.financial.risk_profile",  // Replaces vault.read.risk_profile
      "attr.kai_decisions.*",          // Replaces vault.write.decision
      "agent.kai.analyze",
    ];

    if (Capacitor.isNativePlatform()) {
      try {
        const vaultOwnerToken = this.getVaultOwnerToken() || undefined;
        const result = await Kai.grantConsent({
          userId: data.userId,
          scopes,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native kaiGrantConsent error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
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
        const vaultOwnerToken = this.getVaultOwnerToken() || undefined;
        const result = await Kai.analyze({
          userId: data.userId,
          ticker: data.ticker,
          consentToken: data.consentToken,
          riskProfile: data.riskProfile,
          processingMode: data.processingMode,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify(result.decision), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native kaiAnalyze error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
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
        const vaultOwnerToken = this.getVaultOwnerToken() || undefined;
        const result = await Kai.storePreferences({
          userId: data.userId,
          preferences: data.preferences as any,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native kaiStorePreferences error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
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
        const vaultOwnerToken = this.getVaultOwnerToken() || undefined;
        const result = await Kai.getPreferences({
          userId: data.userId,
          vaultOwnerToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native kaiGetPreferences error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch(`/api/kai/preferences/${data.userId}`, {
      method: "GET",
    });
  }

  /**
   * Send message to Kai chat agent
   *
   * This is the primary method for conversational interaction with Kai.
   * Supports persistent chat history and insertable UI components.
   *
   * Authentication: Requires VAULT_OWNER token (consent-first architecture).
   */
  static async sendKaiMessage(data: {
    userId: string;
    message: string;
    conversationId?: string;
    vaultOwnerToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Kai.chat({
          userId: data.userId,
          message: data.message,
          conversationId: data.conversationId,
          vaultOwnerToken: data.vaultOwnerToken,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[ApiService] Native sendKaiMessage error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
        });
      }
    }

    // Web: Use VAULT_OWNER token for consent-gated access
    return apiFetch("/api/kai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.vaultOwnerToken}`,
      },
      body: JSON.stringify({
        user_id: data.userId,
        message: data.message,
        conversation_id: data.conversationId,
      }),
    });
  }

  /**
   * Import portfolio from brokerage statement
   *
   * Accepts CSV or PDF files and returns portfolio analysis with losers.
   * Uses the Kai plugin for tri-flow architecture compliance.
   *
   * Authentication: Requires VAULT_OWNER token (consent-first architecture).
   */
  static async importPortfolio(data: {
    userId: string;
    file: File;
    vaultOwnerToken: string;
  }): Promise<Response> {
    // Use VAULT_OWNER token for consent-gated access
    if (!data.vaultOwnerToken) {
      return new Response(
        JSON.stringify({ error: "Vault must be unlocked to import portfolio" }),
        { status: 401 }
      );
    }

    try {
      // Convert File to base64 for plugin compatibility
      const fileBase64 = await this.fileToBase64(data.file);

      // Import the Kai plugin
      const { Kai } = await import("@/lib/capacitor/kai");

      // Use Kai plugin for both web and native (tri-flow compliant)
      const result = await Kai.importPortfolio({
        userId: data.userId,
        fileBase64,
        fileName: data.file.name,
        mimeType: data.file.type || "application/octet-stream",
        vaultOwnerToken: data.vaultOwnerToken,
      });

      // Wrap result in Response for backward compatibility
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[ApiService] importPortfolio error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
        { status: 500 }
      );
    }
  }

  /**
   * Convert a File object to base64 string
   */
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get portfolio summary from world model
   */
  static async getPortfolioSummary(data: {
    userId: string;
    vaultOwnerToken: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        
        const response = await fetch(`${API_BASE}/api/kai/portfolio/summary/${data.userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        return response;
      } catch (error) {
        console.error("[ApiService] Native getPortfolioSummary error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch(`/api/kai/portfolio/summary/${data.userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.vaultOwnerToken}`,
      },
    });
  }

  /**
   * Analyze a portfolio loser
   */
  static async analyzeLoser(data: {
    userId: string;
    symbol: string;
    conversationId?: string;
    vaultOwnerToken: string;
  }): Promise<Response> {
    const body = {
      user_id: data.userId,
      symbol: data.symbol,
      conversation_id: data.conversationId,
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        
        const response = await fetch(`${API_BASE}/api/kai/chat/analyze-loser`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(body),
        });

        return response;
      } catch (error) {
        console.error("[ApiService] Native analyzeLoser error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/kai/chat/analyze-loser", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.vaultOwnerToken}`,
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Analyze a stock using Kai's 3-agent investment committee
   * 
   * Returns a decision card with buy/hold/reduce recommendation.
   */
  static async analyzeStock(data: {
    userId: string;
    ticker: string;
    riskProfile?: "conservative" | "balanced" | "aggressive";
    context?: Record<string, unknown>;
    vaultOwnerToken: string;
  }): Promise<Response> {
    const body = {
      user_id: data.userId,
      ticker: data.ticker.toUpperCase(),
      risk_profile: data.riskProfile || "balanced",
      processing_mode: "hybrid",
      context: data.context,
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const authToken = await this.getFirebaseToken();
        
        const response = await fetch(`${API_BASE}/api/kai/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(body),
        });

        return response;
      } catch (error) {
        console.error("[ApiService] Native analyzeStock error:", error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
        });
      }
    }

    return apiFetch("/api/kai/analyze", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.vaultOwnerToken}`,
      },
      body: JSON.stringify(body),
    });
  }
}

// Re-export for convenience
export { getApiBaseUrl };

