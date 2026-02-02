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
 * Tri-Flow Compliant: Uses HushhWorldModel plugin on native, ApiService.apiFetch() on web.
 * 
 * IMPORTANT: This service MUST NOT use direct fetch("/api/...") calls.
 * All web requests go through ApiService.apiFetch() for consistent auth handling.
 * 
 * Caching: Uses CacheService for in-memory caching with TTL to reduce API calls.
 */

import { Capacitor } from "@capacitor/core";
import { HushhWorldModel } from "@/lib/capacitor";
import { ApiService } from "./api-service";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "./cache-service";

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
   * Get auth headers for API requests.
   * Returns headers object with Authorization if vault_owner_token is available.
   */
  private static getAuthHeaders(): HeadersInit {
    const token = typeof window !== "undefined" 
      ? sessionStorage.getItem("vault_owner_token") 
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Get user's world model metadata for UI display.
   * This is the primary method for fetching profile data.
   * 
   * Uses in-memory caching with 5-minute TTL to reduce API calls.
   * 
   * @param userId - User's ID
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   */
  static async getMetadata(userId: string, forceRefresh = false): Promise<WorldModelMetadata> {
    const cache = CacheService.getInstance();
    const cacheKey = CACHE_KEYS.WORLD_MODEL_METADATA(userId);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get<WorldModelMetadata>(cacheKey);
      if (cached) {
        console.log("[WorldModelService] Using cached metadata");
        return cached;
      }
    }

    let result: WorldModelMetadata;

    if (Capacitor.isNativePlatform()) {
      // Use Capacitor plugin for native platforms
      const nativeResult = await HushhWorldModel.getMetadata({ userId });
      result = {
        userId: nativeResult.userId,
        domains: nativeResult.domains.map((d) => ({
          key: d.key,
          displayName: d.displayName,
          icon: d.icon,
          color: d.color,
          attributeCount: d.attributeCount,
          summary: d.summary,
          availableScopes: d.availableScopes,
          lastUpdated: d.lastUpdated,
        })),
        totalAttributes: nativeResult.totalAttributes,
        modelCompleteness: nativeResult.modelCompleteness,
        suggestedDomains: nativeResult.suggestedDomains,
        lastUpdated: nativeResult.lastUpdated,
      };
    } else {
      // Web: Use ApiService.apiFetch() for tri-flow compliance
      const response = await ApiService.apiFetch(`/api/world-model/metadata/${userId}`, {
        headers: this.getAuthHeaders(),
      });

      // Handle 404 as valid "no data" response for new users
      if (response.status === 404) {
        result = {
          userId,
          domains: [],
          totalAttributes: 0,
          modelCompleteness: 0,
          suggestedDomains: [],
          lastUpdated: null,
        };
      } else if (!response.ok) {
        throw new Error(`Failed to get metadata: ${response.status}`);
      } else {
        const data = await response.json();

        // Transform snake_case to camelCase
        result = {
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
    }

    // Cache the result
    cache.set(cacheKey, result, CACHE_TTL.MEDIUM);
    console.log("[WorldModelService] Cached metadata for", userId);

    return result;
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/index/${userId}`, {
      headers: this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const url = domain
      ? `/api/world-model/attributes/${userId}?domain=${domain}`
      : `/api/world-model/attributes/${userId}`;

    const response = await ApiService.apiFetch(url, {
      headers: this.getAuthHeaders(),
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
  /**
   * Store domain data (NEW blob-based architecture).
   *
   * This is the NEW method for storing user data following BYOK principles.
   * Client encrypts entire domain object and backend stores only ciphertext.
   *
   * @param params.userId - User's ID
   * @param params.domain - Domain key (e.g., "financial", "food")
   * @param params.encryptedBlob - Pre-encrypted data from client
   * @param params.summary - Non-sensitive metadata for world_model_index_v2
   */
  static async storeDomainData(params: {
    userId: string;
    domain: string;
    encryptedBlob: EncryptedValue;
    summary: Record<string, unknown>;
  }): Promise<{ success: boolean }> {
    if (Capacitor.isNativePlatform()) {
      // TODO: Add native plugin method for blob storage
      // For now, fall through to web implementation
      console.warn("[WorldModelService] Native storeDomainData not yet implemented");
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch("/api/world-model/store-domain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        user_id: params.userId,
        domain: params.domain,
        encrypted_blob: {
          ciphertext: params.encryptedBlob.ciphertext,
          iv: params.encryptedBlob.iv,
          tag: params.encryptedBlob.tag,
          algorithm: params.encryptedBlob.algorithm || "aes-256-gcm",
        },
        summary: params.summary,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to store domain data: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Store an encrypted attribute in the World Model.
   * Domain will be auto-inferred if not provided.
   * 
   * @deprecated Use storeDomainData() for new code (blob-based architecture)
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch("/api/world-model/attributes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/attributes/${userId}/${domain}/${attributeKey}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/domains/${userId}`, {
      headers: this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/scopes/${userId}`, {
      headers: this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/portfolio/${userId}?portfolio_name=${encodeURIComponent(portfolioName)}`,
      {
        headers: this.getAuthHeaders(),
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

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/portfolios/${userId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list portfolios: ${response.status}`);
    }

    const data = await response.json();
    return data.portfolios || [];
  }

  /**
   * Get encrypted domain data blob for decryption on client.
   * This retrieves the encrypted blob stored via storeDomainData().
   * 
   * @param userId - User's ID
   * @param domain - Domain key (e.g., "financial")
   * @returns Encrypted blob with ciphertext, iv, tag, algorithm or null if not found
   */
  static async getDomainData(
    userId: string,
    domain: string
  ): Promise<EncryptedValue | null> {
    if (Capacitor.isNativePlatform()) {
      // TODO: Add native plugin method for blob retrieval
      console.warn("[WorldModelService] Native getDomainData not yet implemented");
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/domain-data/${userId}/${domain}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get domain data: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.encrypted_blob) {
      return null;
    }

    return {
      ciphertext: data.encrypted_blob.ciphertext,
      iv: data.encrypted_blob.iv,
      tag: data.encrypted_blob.tag,
      algorithm: data.encrypted_blob.algorithm || "aes-256-gcm",
    };
  }

  /**
   * Clear all data for a specific domain.
   * This removes the encrypted blob and updates the world model index.
   * 
   * @param userId - User's ID
   * @param domain - Domain key (e.g., "financial")
   * @returns Success status
   */
  static async clearDomain(
    userId: string,
    domain: string
  ): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      // TODO: Add native plugin method for domain clearing
      console.warn("[WorldModelService] Native clearDomain not yet implemented");
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/domain-data/${userId}/${domain}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to clear domain: ${response.status}`);
    }

    return true;
  }
}

// Export default instance for convenience
export default WorldModelService;
