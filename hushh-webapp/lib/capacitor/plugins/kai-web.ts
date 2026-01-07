/**
 * Kai Web Implementation
 *
 * Fallback for web platform - uses standard fetch to Next.js API routes
 */

import { WebPlugin } from "@capacitor/core";
import type { KaiPlugin } from "../kai";

export class KaiWeb extends WebPlugin implements KaiPlugin {
  async grantConsent(options: {
    userId: string;
    scopes: string[];
    authToken?: string;
  }): Promise<{ token: string; expires_at: string }> {
    const response = await fetch("/api/kai/consent/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    consentToken: string;
    riskProfile: string;
    processingMode: string;
    authToken?: string;
  }): Promise<any> {
    const response = await fetch("/api/kai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: options.userId,
        ticker: options.ticker,
        consent_token: options.consentToken,
        risk_profile: options.riskProfile,
        processing_mode: options.processingMode,
      }),
    });

    if (!response.ok) {
      throw new Error("Analysis failed");
    }

    // Return the full response directly, matching native plugin behavior
    return response.json();
  }

  async storePreferences(options: {
    userId: string;
    preferencesEncrypted: string;
    authToken?: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch("/api/kai/preferences/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: options.userId,
        preferences_encrypted: options.preferencesEncrypted,
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
    const response = await fetch(`/api/kai/preferences/${options.userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to get preferences");
    }

    return response.json();
  }
}
