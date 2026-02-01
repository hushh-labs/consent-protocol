/**
 * Kai Plugin Interface
 *
 * Native plugin for Agent Kai stock analysis.
 * Separate plugin for modularity and customization.
 *
 * Authentication:
 * - All consent-gated operations use VAULT_OWNER token
 * - Token proves both identity (user_id) and consent (vault unlocked)
 * - Firebase is only used for bootstrap (issuing VAULT_OWNER token)
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
   * Note: This is a bootstrap operation - may need Firebase auth initially
   */
  grantConsent(options: {
    userId: string;
    scopes: string[];
    vaultOwnerToken?: string;
  }): Promise<{ token: string; expires_at: string }>;

  /**
   * Analyze stock ticker
   * Calls: POST /api/kai/analyze
   * Requires: VAULT_OWNER token
   */
  analyze(options: {
    userId: string;
    ticker: string;
    consentToken?: string;
    riskProfile: string;
    processingMode: string;
    context?: any;
    vaultOwnerToken?: string;
  }): Promise<any>; // Returns the full analysis response

  /**
   * Store encrypted preferences (risk profile, processing mode)
   * Calls: POST /api/kai/preferences/store
   * Requires: VAULT_OWNER token
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
    /** VAULT_OWNER consent token - required for secure access */
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get encrypted preferences
   * Calls: GET /api/kai/preferences/:userId
   * Requires: VAULT_OWNER token
   */
  getPreferences(options: {
    userId: string;
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
   * Requires: VAULT_OWNER token
   */
  getInitialChatState(options: {
    userId: string;
    vaultOwnerToken?: string;
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
   * Requires: VAULT_OWNER token
   */
  chat(options: {
    userId: string;
    message: string;
    conversationId?: string;
    vaultOwnerToken: string;
  }): Promise<{
    response: string;
    conversationId: string;
    timestamp: string;
  }>;

  /**
   * Import portfolio from brokerage statement file.
   * Calls: POST /api/kai/portfolio/import
   * Requires: VAULT_OWNER token
   *
   * Accepts CSV or PDF files from major brokerages (Schwab, Fidelity, Robinhood).
   * Returns parsed portfolio data with losers/winners analysis.
   *
   * Note: On native platforms, file must be passed as base64-encoded content
   * since Capacitor plugins cannot directly handle File objects.
   */
  importPortfolio(options: {
    userId: string;
    /** Base64-encoded file content (for native) or File object (web only) */
    fileBase64?: string;
    /** Original filename with extension (e.g., "portfolio.csv") */
    fileName: string;
    /** MIME type of the file */
    mimeType: string;
    /** VAULT_OWNER token for authentication */
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
  }>;
}

export const Kai = registerPlugin<KaiPlugin>("Kai", {
  web: () => import("./plugins/kai-web").then((m) => new m.KaiWeb()),
});
