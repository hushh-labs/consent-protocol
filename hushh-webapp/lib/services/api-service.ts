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

// API Base URL configuration
const getApiBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    // iOS: Use Cloud Run backend (Next.js API routes not available in static export)
    return process.env.NEXT_PUBLIC_BACKEND_URL || 
           "https://consent-protocol-1006304528804.us-central1.run.app";
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
  
  // ==================== Auth ====================
  
  /**
   * Create/update session
   */
  static async createSession(data: {
    userId: string;
    email: string;
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
  static async consentLogout(data: {
    token: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/logout", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Approve pending consent
   */
  static async approvePendingConsent(data: {
    token: string;
    userId: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/pending/approve", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Deny pending consent
   */
  static async denyPendingConsent(data: {
    token: string;
    userId: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/pending/deny", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Revoke consent
   */
  static async revokeConsent(data: {
    token: string;
    userId: string;
  }): Promise<Response> {
    return apiFetch("/api/consent/revoke", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Vault ====================
  
  /**
   * Store preferences to vault
   */
  static async storePreferences(data: {
    userId: string;
    preferences: Record<string, unknown>;
    consentToken: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/store-preferences", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Store food preferences
   */
  static async storeFoodPreferences(data: {
    userId: string;
    preferences: Record<string, unknown>;
    vaultKey: string;
  }): Promise<Response> {
    return apiFetch("/api/vault/food", {
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

  /**
   * Check if running on native platform
   */
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }
}

// Re-export for convenience
export { getApiBaseUrl };
