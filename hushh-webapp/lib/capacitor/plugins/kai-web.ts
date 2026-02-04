/**
 * Kai Web Implementation
 *
 * Fallback for web platform - uses standard fetch to Next.js API routes
 *
 * Authentication:
 * - All consent-gated operations use VAULT_OWNER token
 * - Token proves both identity (user_id) and consent (vault unlocked)
 * - Firebase is only used for bootstrap (issuing VAULT_OWNER token)
 */

import { WebPlugin } from "@capacitor/core";
import type { KaiEncryptedPreference, KaiPlugin } from "../kai";

export class KaiWeb extends WebPlugin implements KaiPlugin {
  async grantConsent(options: {
    userId: string;
    scopes: string[];
    authToken: string;
    vaultOwnerToken?: string;
  }): Promise<{ token: string; expires_at: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Bootstrap route: backend requires Firebase ID token
    headers["Authorization"] = `Bearer ${options.authToken}`;

    const response = await fetch("/api/kai/consent/grant", {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: options.userId, scopes: options.scopes }),
    });

    if (!response.ok) {
      throw new Error("Failed to grant consent");
    }

    const data = await response.json();

    // Backend returns {tokens: {}, expires_at}, but we need {token, expires_at}
    // Extract the specific scope token
    const token =
      data.tokens?.["agent.kai.analyze"] ||
      Object.values(data.tokens || {})[0] ||
      "";

    return {
      token,
      expires_at: data.expires_at,
    };
  }

  async analyze(options: {
    userId: string;
    ticker: string;
    consentToken?: string;
    riskProfile: string;
    processingMode: string;
    context?: any;
    vaultOwnerToken?: string;
  }): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Use VAULT_OWNER token for consent-gated access
    if (options.vaultOwnerToken) {
      headers["Authorization"] = `Bearer ${options.vaultOwnerToken}`;
    }

    const body: Record<string, any> = {
      user_id: options.userId,
      ticker: options.ticker,
      consent_token: options.consentToken,
      risk_profile: options.riskProfile,
      processing_mode: options.processingMode,
    };

    // Include context if provided
    if (options.context) {
      body.context = options.context;
    }

    const response = await fetch("/api/kai/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Analysis failed");
    }

    // Return the full response directly, matching native plugin behavior
    return response.json();
  }

  async storePreferences(options: {
    userId: string;
    preferences?: KaiEncryptedPreference[];
    preferencesEncrypted?: string;
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Use VAULT_OWNER token for consent-gated access
    if (options.vaultOwnerToken) {
      headers["Authorization"] = `Bearer ${options.vaultOwnerToken}`;
    }

    const preferences: KaiEncryptedPreference[] | undefined =
      options.preferences ||
      (options.preferencesEncrypted
        ? (JSON.parse(options.preferencesEncrypted) as KaiEncryptedPreference[])
        : undefined);

    if (!preferences || !Array.isArray(preferences)) {
      throw new Error("Missing preferences payload");
    }

    const response = await fetch("/api/kai/preferences/store", {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: options.userId,
        preferences,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to store preferences");
    }

    return response.json();
  }

  async getPreferences(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{ preferences: any[] }> {
    // Debug logging
    console.log("[KaiWeb] getPreferences called with:", {
      userId: options.userId,
      hasVaultOwnerToken: !!options.vaultOwnerToken,
      vaultOwnerTokenPrefix: options.vaultOwnerToken?.substring(0, 20),
    });

    // Safety check: This should NOT be called on native platforms
    if (typeof window !== "undefined") {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.isNativePlatform?.()) {
        console.error(
          "[KaiWeb] ⚠️ Web plugin called on native platform! This is a bug."
        );
        console.error("[KaiWeb] Platform:", Capacitor.getPlatform?.());
        console.error(
          "[KaiWeb] This will fail because there's no Next.js server on native."
        );
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Use VAULT_OWNER token for consent-gated access
    console.log(
      "[KaiWeb] Using token:",
      options.vaultOwnerToken
        ? "YES (length=" + options.vaultOwnerToken.length + ")"
        : "NO"
    );
    if (options.vaultOwnerToken) {
      headers["Authorization"] = `Bearer ${options.vaultOwnerToken}`;
    }

    const url = `/api/kai/preferences/${options.userId}`;
    console.log("[KaiWeb] Fetching:", url, "Headers:", Object.keys(headers));

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    console.log("[KaiWeb] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[KaiWeb] Error response:", errorText);
      throw new Error("Failed to get preferences");
    }

    return response.json();
  }

  async resetPreferences(options: {
    userId: string;
    vaultOwnerToken: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch(`/api/kai/preferences/${options.userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${options.vaultOwnerToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to reset preferences");
    }

    return response.json();
  }

  async getInitialChatState(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    is_new_user: boolean;
    has_portfolio: boolean;
    has_financial_data: boolean;
    welcome_type: string;
    total_attributes: number;
    available_domains: string[];
  }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Use VAULT_OWNER token for consent-gated access
    if (options.vaultOwnerToken) {
      headers["Authorization"] = `Bearer ${options.vaultOwnerToken}`;
    }

    const response = await fetch(
      `/api/kai/chat/initial-state/${options.userId}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get initial chat state");
    }

    return response.json();
  }

  async chat(options: {
    userId: string;
    message: string;
    conversationId?: string;
    vaultOwnerToken: string;
  }): Promise<{
    response: string;
    conversationId: string;
    timestamp: string;
  }> {
    // Use VAULT_OWNER token for consent-gated access
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.vaultOwnerToken}`,
    };

    const response = await fetch("/api/kai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: options.userId,
        message: options.message,
        conversation_id: options.conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send chat message");
    }

    return response.json();
  }

  async importPortfolio(options: {
    userId: string;
    fileBase64?: string;
    fileName: string;
    mimeType: string;
    vaultOwnerToken: string;
  }): Promise<{
    success: boolean;
    holdings_count: number;
    total_value: number;
    losers: Array<{
      symbol: string;
      name: string;
      gain_loss_pct: number;
      gain_loss: number;
    }>;
    winners: Array<{
      symbol: string;
      name: string;
      gain_loss_pct: number;
      gain_loss: number;
    }>;
    kpis_stored: string[];
    portfolio_data?: {
      holdings: Array<{
        symbol: string;
        name: string;
        quantity: number;
        current_price: number;
        market_value: number;
        cost_basis?: number;
        gain_loss?: number;
        gain_loss_pct?: number;
      }>;
      kpis: Record<string, unknown>;
    };
    source: string;
    error?: string;
  }> {
    console.log("[KaiWeb] importPortfolio called:", {
      userId: options.userId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      hasFileBase64: !!options.fileBase64,
    });

    if (!options.fileBase64) {
      throw new Error("fileBase64 is required for web plugin");
    }

    // Decode base64 to binary
    const binaryString = atob(options.fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: options.mimeType });
    const file = new File([blob], options.fileName, { type: options.mimeType });

    // Create FormData
    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", options.userId);

    // Use VAULT_OWNER token for consent-gated access
    const response = await fetch("/api/kai/portfolio/import", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.vaultOwnerToken}`,
        // Note: Don't set Content-Type for FormData - browser sets it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.error || "Failed to import portfolio"
      );
    }

    return response.json();
  }

  async analyzePortfolioLosers(options: {
    userId: string;
    losers: Array<{
      symbol: string;
      name?: string;
      gain_loss_pct?: number;
      gain_loss?: number;
      market_value?: number;
    }>;
    thresholdPct?: number;
    maxPositions?: number;
    vaultOwnerToken: string;
  }): Promise<{
    criteria_context: string;
    summary: Record<string, unknown>;
    losers: Array<Record<string, unknown>>;
    portfolio_level_takeaways: string[];
  }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.vaultOwnerToken}`,
    };

    const body = {
      user_id: options.userId,
      losers: options.losers,
      threshold_pct: options.thresholdPct ?? -5.0,
      max_positions: options.maxPositions ?? 10,
    };

    const response = await fetch("/api/kai/portfolio/analyze-losers", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze portfolio losers");
    }

    return response.json();
  }
}
