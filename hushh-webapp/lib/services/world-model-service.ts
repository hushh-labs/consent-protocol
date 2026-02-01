// hushh-webapp/lib/services/world-model-service.ts
/**
 * World Model Service - Frontend service for world model operations.
 *
 * Provides platform-aware methods for:
 * - Fetching user metadata (domains, attributes)
 * - Storing encrypted attributes
 * - Managing domain discovery
 * - Scope validation
 *
 * Tri-Flow Compliant: Uses HushhWorldModel plugin on native, Next.js API on web.
 */

import { Capacitor } from "@capacitor/core";
import { HushhWorldModel } from "@/lib/capacitor";

// ==================== Types ====================

export interface DomainSummary {
  key: string;
  displayName: string;
  icon: string;
  color: string;
  attributeCount: number;
  summary: Record<string, string | number>;
  availableScopes: string[];
  lastUpdated: string | null;
}

export interface WorldModelMetadata {
  userId: string;
  domains: DomainSummary[];
  totalAttributes: number;
  modelCompleteness: number;
  suggestedDomains: string[];
  lastUpdated: string | null;
}

export interface WorldModelIndex {
  userId: string;
  domainSummaries: Record<string, Record<string, unknown>>;
  availableDomains: string[];
  computedTags: string[];
  activityScore: number | null;
  lastActiveAt: string | null;
  totalAttributes: number;
  modelVersion: number;
}

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm?: string;
}

export interface EncryptedAttribute extends EncryptedValue {
  domain: string;
  attributeKey: string;
  source: string;
  confidence: number | null;
  displayName: string | null;
  dataType: string;
}

export interface DomainInfo {
  key: string;
  displayName: string;
  description: string | null;
  icon: string;
  color: string;
  attributeCount: number;
  userCount: number;
}

export interface ScopeDiscovery {
  userId: string;
  availableDomains: {
    domain: string;
    displayName: string;
    scopes: string[];
  }[];
  allScopes: string[];
  wildcardScopes: string[];
}

export interface ScopeDisplayInfo {
  displayName: string;
  domain: string;
  attribute: string | null;
  isWildcard: boolean;
}

// ==================== Service ====================

export class WorldModelService {
  /**
   * Get auth header from session storage.
   */
  private static async getAuthHeader(): Promise<string> {
    const token = sessionStorage.getItem("vault_owner_token");
    return token ? `Bearer ${token}` : "";
  }

  /**
   * Get user's world model metadata for UI display.
   * This is the primary method for fetching profile data.
   */
  static async getMetadata(userId: string): Promise<WorldModelMetadata> {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor plugin for native platforms
      const result = await HushhWorldModel.getMetadata({ userId });
      return {
        userId: result.userId,
        domains: result.domains.map((d) => ({
          key: d.key,
          displayName: d.displayName,
          icon: d.icon,
          color: d.color,
          attributeCount: d.attributeCount,
          summary: d.summary,
          availableScopes: d.availableScopes,
          lastUpdated: d.lastUpdated,
        })),
        totalAttributes: result.totalAttributes,
        modelCompleteness: result.modelCompleteness,
        suggestedDomains: result.suggestedDomains,
        lastUpdated: result.lastUpdated,
      };
    }

    // Web: Use Next.js proxy
    const response = await fetch(`/api/world-model/metadata/${userId}`, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to get metadata: ${response.status}`);
    }

    const data = await response.json();

    // Transform snake_case to camelCase
    return {
      userId: data.user_id,
      domains: (data.domains || []).map((d: Record<string, unknown>) => ({
        key: (d.domain_key || d.key) as string,
        displayName: (d.display_name || d.displayName) as string,
        icon: (d.icon_name || d.icon) as string,
        color: (d.color_hex || d.color) as string,
        attributeCount: (d.attribute_count || d.attributeCount) as number,
        summary: (d.summary || {}) as Record<string, string | number>,
        availableScopes: (d.available_scopes || []) as string[],
        lastUpdated: (d.last_updated || null) as string | null,
      })),
      totalAttributes: data.total_attributes || 0,
      modelCompleteness: data.model_completeness || 0,
      suggestedDomains: data.suggested_domains || [],
      lastUpdated: data.last_updated,
    };
  }

  /**
   * Get user's world model index.
   */
  static async getIndex(userId: string): Promise<WorldModelIndex> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getIndex({ userId });
      return {
        userId: result.userId,
        domainSummaries: result.domainSummaries,
        availableDomains: result.availableDomains,
        computedTags: result.computedTags,
        activityScore: result.activityScore,
        lastActiveAt: result.lastActiveAt,
        totalAttributes: result.totalAttributes,
        modelVersion: result.modelVersion,
      };
    }

    const response = await fetch(`/api/world-model/index/${userId}`, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to get index: ${response.status}`);
    }

    const data = await response.json();

    return {
      userId: data.user_id,
      domainSummaries: data.domain_summaries || {},
      availableDomains: data.available_domains || [],
      computedTags: data.computed_tags || [],
      activityScore: data.activity_score,
      lastActiveAt: data.last_active_at,
      totalAttributes: data.total_attributes || 0,
      modelVersion: data.model_version || 2,
    };
  }

  /**
   * Get attributes for a user, optionally filtered by domain.
   */
  static async getAttributes(
    userId: string,
    domain?: string
  ): Promise<EncryptedAttribute[]> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getAttributes({ userId, domain });
      return result.attributes.map((a) => ({
        domain: a.domain,
        attributeKey: a.attributeKey,
        ciphertext: a.ciphertext,
        iv: a.iv,
        tag: a.tag,
        algorithm: a.algorithm,
        source: a.source,
        confidence: a.confidence,
        displayName: a.displayName,
        dataType: a.dataType,
      }));
    }

    const url = domain
      ? `/api/world-model/attributes/${userId}?domain=${domain}`
      : `/api/world-model/attributes/${userId}`;

    const response = await fetch(url, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to get attributes: ${response.status}`);
    }

    const data = await response.json();

    return (data.attributes || []).map((a: Record<string, unknown>) => ({
      domain: a.domain,
      attributeKey: a.attribute_key,
      ciphertext: a.ciphertext,
      iv: a.iv,
      tag: a.tag,
      algorithm: a.algorithm || "aes-256-gcm",
      source: a.source,
      confidence: a.confidence,
      displayName: a.display_name,
      dataType: a.data_type || "string",
    }));
  }

  /**
   * Store an encrypted attribute.
   * Domain will be auto-inferred if not provided.
   */
  static async storeAttribute(
    userId: string,
    attributeKey: string,
    encryptedValue: EncryptedValue,
    options?: {
      domain?: string;
      displayName?: string;
      dataType?: string;
      source?: string;
    }
  ): Promise<{ success: boolean; scope: string }> {
    if (Capacitor.isNativePlatform()) {
      return HushhWorldModel.storeAttribute({
        userId,
        attributeKey,
        ciphertext: encryptedValue.ciphertext,
        iv: encryptedValue.iv,
        tag: encryptedValue.tag,
        domain: options?.domain,
        displayName: options?.displayName,
        dataType: options?.dataType,
        source: options?.source,
      });
    }

    const response = await fetch("/api/world-model/attributes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.getAuthHeader(),
      },
      body: JSON.stringify({
        user_id: userId,
        domain: options?.domain,
        attribute_key: attributeKey,
        ciphertext: encryptedValue.ciphertext,
        iv: encryptedValue.iv,
        tag: encryptedValue.tag,
        algorithm: encryptedValue.algorithm || "aes-256-gcm",
        source: options?.source || "explicit",
        display_name: options?.displayName,
        data_type: options?.dataType || "string",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store attribute: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      scope: data.scope,
    };
  }

  /**
   * Delete a specific attribute.
   */
  static async deleteAttribute(
    userId: string,
    domain: string,
    attributeKey: string
  ): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.deleteAttribute({
        userId,
        domain,
        attributeKey,
      });
      return result.success;
    }

    const response = await fetch(
      `/api/world-model/attributes/${userId}/${domain}/${attributeKey}`,
      {
        method: "DELETE",
        headers: { Authorization: await this.getAuthHeader() },
      }
    );

    return response.ok;
  }

  /**
   * Get domains that have data for a user.
   */
  static async getUserDomains(userId: string): Promise<DomainSummary[]> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getUserDomains({ userId });
      return result.domains.map((d) => ({
        key: d.key,
        displayName: d.displayName,
        icon: d.icon,
        color: d.color,
        attributeCount: d.attributeCount,
        summary: {},
        availableScopes: [],
        lastUpdated: null,
      }));
    }

    const response = await fetch(`/api/world-model/domains/${userId}`, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user domains: ${response.status}`);
    }

    const data = await response.json();

    return (data.domains || []).map((d: Record<string, unknown>) => ({
      key: (d.domain_key || d.key) as string,
      displayName: (d.display_name || d.displayName) as string,
      icon: (d.icon_name || d.icon) as string,
      color: (d.color_hex || d.color) as string,
      attributeCount: (d.attribute_count || d.attributeCount) as number,
      summary: {},
      availableScopes: [],
      lastUpdated: null,
    }));
  }

  /**
   * List all registered domains.
   */
  static async listDomains(includeEmpty = false): Promise<DomainInfo[]> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.listDomains({ includeEmpty });
      return result.domains.map((d) => ({
        key: d.key,
        displayName: d.displayName,
        description: d.description,
        icon: d.icon,
        color: d.color,
        attributeCount: d.attributeCount,
        userCount: d.userCount,
      }));
    }

    const response = await fetch(
      `/api/world-model/domains?include_empty=${includeEmpty}`
    );

    if (!response.ok) {
      throw new Error(`Failed to list domains: ${response.status}`);
    }

    const data = await response.json();

    return (data.domains || []).map((d: Record<string, unknown>) => ({
      key: (d.domain_key || d.key) as string,
      displayName: (d.display_name || d.displayName) as string,
      description: d.description as string | null,
      icon: (d.icon_name || d.icon) as string,
      color: (d.color_hex || d.color) as string,
      attributeCount: (d.attribute_count || d.attributeCount) as number,
      userCount: (d.user_count || d.userCount) as number,
    }));
  }

  /**
   * Get available scopes for a user (MCP discovery).
   */
  static async getAvailableScopes(userId: string): Promise<ScopeDiscovery> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getAvailableScopes({ userId });
      return {
        userId: result.userId,
        availableDomains: result.availableDomains,
        allScopes: result.allScopes,
        wildcardScopes: result.wildcardScopes,
      };
    }

    const response = await fetch(`/api/world-model/scopes/${userId}`, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to get scopes: ${response.status}`);
    }

    const data = await response.json();

    return {
      userId: data.user_id,
      availableDomains: data.available_domains || [],
      allScopes: data.all_scopes || [],
      wildcardScopes: data.wildcard_scopes || [],
    };
  }

  /**
   * Get user's portfolio.
   */
  static async getPortfolio(
    userId: string,
    portfolioName = "Main Portfolio"
  ): Promise<Record<string, unknown> | null> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getPortfolio({
        userId,
        portfolioName,
      });
      return result.portfolio;
    }

    const response = await fetch(
      `/api/world-model/portfolio/${userId}?portfolio_name=${encodeURIComponent(portfolioName)}`,
      {
        headers: { Authorization: await this.getAuthHeader() },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get portfolio: ${response.status}`);
    }

    const data = await response.json();
    return data.portfolio;
  }

  /**
   * Get scope display info for dynamic rendering.
   * Parses attr.{domain}.{attribute} pattern.
   */
  static getScopeDisplayInfo(scope: string): ScopeDisplayInfo {
    const match = scope.match(/^attr\.([^.]+)\.?(.*)$/);
    if (!match) {
      return {
        displayName: scope,
        domain: "",
        attribute: null,
        isWildcard: false,
      };
    }

    const [, domain, attribute] = match;
    const isWildcard = attribute === "*" || !attribute;

    return {
      displayName: isWildcard
        ? `All ${domain} Data`
        : `${domain} - ${(attribute || "").replace(/_/g, " ")}`,
      domain: domain || "",
      attribute: isWildcard ? null : attribute || null,
      isWildcard,
    };
  }

  /**
   * Get all portfolios for a user.
   */
  static async listPortfolios(
    userId: string
  ): Promise<Record<string, unknown>[]> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.listPortfolios({ userId });
      return result.portfolios;
    }

    const response = await fetch(`/api/world-model/portfolios/${userId}`, {
      headers: { Authorization: await this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Failed to list portfolios: ${response.status}`);
    }

    const data = await response.json();
    return data.portfolios || [];
  }
}

// Export default instance for convenience
export default WorldModelService;
