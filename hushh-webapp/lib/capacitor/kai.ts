/**
 * Kai Plugin Interface
 *
 * Native plugin for Agent Kai stock analysis.
 * Separate plugin for modularity and customization.
 */

import { registerPlugin } from "@capacitor/core";

export interface KaiPlugin {
  /**
   * Grant consent for Kai analysis
   * Calls: POST /api/kai/consent/grant
   */
  grantConsent(options: {
    userId: string;
    scopes: string[];
    authToken?: string;
  }): Promise<{ token: string; expires_at: string }>;

  /**
   * Analyze stock ticker
   * Calls: POST /api/kai/analyze
   */
  analyze(options: {
    userId: string;
    ticker: string;
    consentToken?: string;
    riskProfile: string;
    processingMode: string;
    authToken?: string;
  }): Promise<any>; // Returns the full analysis response

  /**
   * Store encrypted preferences (risk profile, processing mode)
   * Calls: POST /api/kai/preferences/store
   */
  storePreferences(options: {
    userId: string;
    preferencesEncrypted: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get encrypted preferences
   * Calls: GET /api/kai/preferences/:userId
   */
  getPreferences(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ preferences: any[] }>;
}

export const Kai = registerPlugin<KaiPlugin>("Kai", {
  web: () => import("./plugins/kai-web").then((m) => new m.KaiWeb()),
});
