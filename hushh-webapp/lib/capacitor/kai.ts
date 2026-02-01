/**
 * Kai Plugin Interface
 *
 * Native plugin for Agent Kai stock analysis.
 * Separate plugin for modularity and customization.
 */

import { registerPlugin } from "@capacitor/core";

export type KaiEncryptedPreference = {
  field_name: string;
  ciphertext: string;
  iv: string;
  tag?: string;
};

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
    context?: any;
    authToken?: string;
  }): Promise<any>; // Returns the full analysis response

  /**
   * Store encrypted preferences (risk profile, processing mode)
   * Calls: POST /api/kai/preferences/store
   */
  storePreferences(options: {
    userId: string;
    /**
     * Canonical payload for backend (`consent-protocol/api/routes/kai.py`)
     */
    preferences?: KaiEncryptedPreference[];
    /**
     * Deprecated legacy payload (stringified JSON array).
     * Kept for backward compatibility during cleanup.
     */
    preferencesEncrypted?: string;
    authToken?: string;
    /** VAULT_OWNER consent token - required for secure access */
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get encrypted preferences
   * Calls: GET /api/kai/preferences/:userId
   */
  getPreferences(options: {
    userId: string;
    authToken?: string;
    /** VAULT_OWNER consent token - required for secure access */
    vaultOwnerToken?: string;
  }): Promise<{ preferences: any[] }>;

  /**
   * Delete all encrypted preferences for a user.
   * Calls: DELETE /api/kai/preferences/:userId
   * Requires: VAULT_OWNER consent token
   */
  resetPreferences(options: {
    userId: string;
    vaultOwnerToken: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get initial chat state for proactive welcome flow.
   * Calls: GET /api/kai/chat/initial-state/:userId
   */
  getInitialChatState(options: {
    userId: string;
    authToken?: string;
  }): Promise<{
    is_new_user: boolean;
    has_portfolio: boolean;
    has_financial_data: boolean;
    welcome_type: string;
    total_attributes: number;
    available_domains: string[];
  }>;

  /**
   * Send a chat message to Kai.
   * Calls: POST /api/kai/chat
   */
  chat(options: {
    userId: string;
    message: string;
    conversationId?: string;
    vaultOwnerToken: string;
    authToken?: string;
  }): Promise<{
    response: string;
    conversationId: string;
    timestamp: string;
  }>;
}

export const Kai = registerPlugin<KaiPlugin>("Kai", {
  web: () => import("./plugins/kai-web").then((m) => new m.KaiWeb()),
});
