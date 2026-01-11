/**
 * Kai Web Implementation
 *
 * Fallback for web platform - uses standard fetch to Next.js API routes
 */

import { WebPlugin } from "@capacitor/core";
import type { KaiEncryptedPreference, KaiPlugin } from "../kai";

export class KaiWeb extends WebPlugin implements KaiPlugin {
  async grantConsent(options: {
    userId: string;
    scopes: string[];
    authToken?: string;
  }): Promise<{ token: string; expires_at: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
    }

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
    authToken?: string;
  }): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
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
    authToken?: string;
  }): Promise<{ success: boolean }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
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
    authToken?: string;
  }): Promise<{ preferences: any[] }> {
    // Safety check: This should NOT be called on native platforms
    if (typeof window !== 'undefined') {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.isNativePlatform?.()) {
        console.error("[KaiWeb] ⚠️ Web plugin called on native platform! This is a bug.");
        console.error("[KaiWeb] Platform:", Capacitor.getPlatform?.());
        console.error("[KaiWeb] This will fail because there's no Next.js server on native.");
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
    }

    const response = await fetch(`/api/kai/preferences/${options.userId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
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
}
