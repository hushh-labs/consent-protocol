/**
 * World Model Plugin Interface
 *
 * Native plugin for World Model operations.
 * Provides platform-aware access to user's world model data.
 */

import { registerPlugin } from "@capacitor/core";

export interface HushhWorldModelPlugin {
  /**
   * Get user's world model metadata for UI display.
   * Calls: GET /api/world-model/metadata/:userId
   */
  getMetadata(options: { userId: string }): Promise<{
    userId: string;
    domains: Array<{
      key: string;
      displayName: string;
      icon: string;
      color: string;
      attributeCount: number;
      summary: Record<string, string | number>;
      availableScopes: string[];
      lastUpdated: string | null;
    }>;
    totalAttributes: number;
    modelCompleteness: number;
    suggestedDomains: string[];
    lastUpdated: string | null;
  }>;

  /**
   * Get user's world model index.
   * Calls: GET /api/world-model/index/:userId
   */
  getIndex(options: { userId: string }): Promise<{
    userId: string;
    domainSummaries: Record<string, Record<string, unknown>>;
    availableDomains: string[];
    computedTags: string[];
    activityScore: number | null;
    lastActiveAt: string | null;
    totalAttributes: number;
    modelVersion: number;
  }>;

  /**
   * Get attributes for a user, optionally filtered by domain.
   * Calls: GET /api/world-model/attributes/:userId
   */
  getAttributes(options: { userId: string; domain?: string }): Promise<{
    attributes: Array<{
      domain: string;
      attributeKey: string;
      ciphertext: string;
      iv: string;
      tag: string;
      algorithm: string;
      source: string;
      confidence: number | null;
      displayName: string | null;
      dataType: string;
    }>;
  }>;

  /**
   * Store an encrypted attribute.
   * Calls: POST /api/world-model/attributes
   */
  storeAttribute(options: {
    userId: string;
    attributeKey: string;
    ciphertext: string;
    iv: string;
    tag: string;
    domain?: string;
    displayName?: string;
    dataType?: string;
    source?: string;
  }): Promise<{ success: boolean; scope: string }>;

  /**
   * Delete a specific attribute.
   * Calls: DELETE /api/world-model/attributes/:userId/:domain/:attributeKey
   */
  deleteAttribute(options: {
    userId: string;
    domain: string;
    attributeKey: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get domains that have data for a user.
   * Calls: GET /api/world-model/domains/:userId
   */
  getUserDomains(options: { userId: string }): Promise<{
    domains: Array<{
      key: string;
      displayName: string;
      icon: string;
      color: string;
      attributeCount: number;
    }>;
  }>;

  /**
   * List all registered domains.
   * Calls: GET /api/world-model/domains
   */
  listDomains(options: { includeEmpty?: boolean }): Promise<{
    domains: Array<{
      key: string;
      displayName: string;
      description: string | null;
      icon: string;
      color: string;
      attributeCount: number;
      userCount: number;
    }>;
  }>;

  /**
   * Get available scopes for a user (MCP discovery).
   * Calls: GET /api/world-model/scopes/:userId
   */
  getAvailableScopes(options: { userId: string }): Promise<{
    userId: string;
    availableDomains: Array<{
      domain: string;
      displayName: string;
      scopes: string[];
    }>;
    allScopes: string[];
    wildcardScopes: string[];
  }>;

  /**
   * Get user's portfolio.
   * Calls: GET /api/world-model/portfolio/:userId
   */
  getPortfolio(options: {
    userId: string;
    portfolioName?: string;
  }): Promise<{ portfolio: Record<string, unknown> | null }>;

  /**
   * List all portfolios for a user.
   * Calls: GET /api/world-model/portfolios/:userId
   */
  listPortfolios(options: { userId: string }): Promise<{
    portfolios: Record<string, unknown>[];
  }>;

  /**
   * Get initial chat state for proactive welcome flow.
   * Calls: GET /api/kai/chat/initial-state/:userId
   */
  getInitialChatState(options: { userId: string }): Promise<{
    is_new_user: boolean;
    has_portfolio: boolean;
    welcome_type: string;
    total_attributes: number;
    available_domains: string[];
  }>;
}

export const HushhWorldModel = registerPlugin<HushhWorldModelPlugin>(
  "HushhWorldModel",
  {
    web: () =>
      import("./plugins/world-model-web").then(
        (m) => new m.HushhWorldModelWeb()
      ),
  }
);
