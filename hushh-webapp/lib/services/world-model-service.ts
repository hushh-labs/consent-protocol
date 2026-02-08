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
   * 
   * SECURITY: Token must be passed explicitly from useVault() hook.
   * Never reads from sessionStorage (XSS protection).
   */
  private static getAuthHeaders(vaultOwnerToken?: string): HeadersInit {
    return vaultOwnerToken ? { Authorization: `Bearer ${vaultOwnerToken}` } : {};
  }

  private static getVaultOwnerToken(vaultOwnerToken?: string): string | undefined {
    // SECURITY: Only use explicitly passed token, no sessionStorage fallback
    return vaultOwnerToken;
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
  static async getMetadata(
    userId: string,
    forceRefresh = false,
    vaultOwnerToken?: string
  ): Promise<WorldModelMetadata> {
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
      // Native plugins return snake_case from backend - transform to camelCase
      const nativeResult = await HushhWorldModel.getMetadata({
        userId,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      result = {
        userId: raw.user_id || raw.userId || userId,
        domains: (raw.domains || []).map((d: Record<string, unknown>) => ({
          key: (d.domain_key || d.key) as string,
          displayName: (d.display_name || d.displayName) as string,
          icon: (d.icon_name || d.icon) as string,
          color: (d.color_hex || d.color) as string,
          attributeCount: (d.attribute_count || d.attributeCount || 0) as number,
          summary: (d.summary || {}) as Record<string, string | number>,
          availableScopes: (d.available_scopes || d.availableScopes || []) as string[],
          lastUpdated: (d.last_updated || d.lastUpdated || null) as string | null,
        })),
        totalAttributes: raw.total_attributes || raw.totalAttributes || 0,
        modelCompleteness: raw.model_completeness || raw.modelCompleteness || 0,
        suggestedDomains: raw.suggested_domains || raw.suggestedDomains || [],
        lastUpdated: raw.last_updated || raw.lastUpdated || null,
      };
    } else {
      // Web: Use ApiService.apiFetch() for tri-flow compliance
      const response = await ApiService.apiFetch(`/api/world-model/metadata/${userId}`, {
        headers: this.getAuthHeaders(vaultOwnerToken),
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
  static async getIndex(
    userId: string,
    vaultOwnerToken?: string
  ): Promise<WorldModelIndex> {
    if (Capacitor.isNativePlatform()) {
      const nativeResult = await HushhWorldModel.getIndex({
        userId,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      return {
        userId: raw.user_id || raw.userId || userId,
        domainSummaries: raw.domain_summaries || raw.domainSummaries || {},
        availableDomains: raw.available_domains || raw.availableDomains || [],
        computedTags: raw.computed_tags || raw.computedTags || [],
        activityScore: raw.activity_score ?? raw.activityScore ?? null,
        lastActiveAt: raw.last_active_at || raw.lastActiveAt || null,
        totalAttributes: raw.total_attributes || raw.totalAttributes || 0,
        modelVersion: raw.model_version || raw.modelVersion || 2,
      };
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/index/${userId}`, {
      headers: this.getAuthHeaders(vaultOwnerToken),
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
      const nativeResult = await HushhWorldModel.getAttributes({
        userId,
        domain,
        vaultOwnerToken: this.getVaultOwnerToken(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      return (raw.attributes || []).map((a: Record<string, unknown>) => ({
        domain: a.domain as string,
        attributeKey: (a.attribute_key || a.attributeKey) as string,
        ciphertext: a.ciphertext as string,
        iv: a.iv as string,
        tag: a.tag as string,
        algorithm: (a.algorithm || "aes-256-gcm") as string,
        source: a.source as string,
        confidence: (a.confidence ?? null) as number | null,
        displayName: (a.display_name || a.displayName || null) as string | null,
        dataType: (a.data_type || a.dataType || "string") as string,
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
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }> {
    if (Capacitor.isNativePlatform()) {
      return HushhWorldModel.storeDomainData({
        userId: params.userId,
        domain: params.domain,
        encryptedBlob: {
          ciphertext: params.encryptedBlob.ciphertext,
          iv: params.encryptedBlob.iv,
          tag: params.encryptedBlob.tag,
          algorithm: params.encryptedBlob.algorithm || "aes-256-gcm",
        },
        summary: params.summary,
        vaultOwnerToken: this.getVaultOwnerToken(params.vaultOwnerToken),
      });
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch("/api/world-model/store-domain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(params.vaultOwnerToken),
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
        vaultOwnerToken: this.getVaultOwnerToken(),
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
   * Delete a specific attribute (client-side blob update for BYOK).
   * Fetches full blob, decrypts, removes the key from the domain, re-encrypts, stores.
   * Requires vaultKey and vaultOwnerToken when using the blob flow (web or native).
   */
  static async deleteAttribute(
    userId: string,
    domain: string,
    attributeKey: string,
    options?: { vaultKey: string; vaultOwnerToken?: string }
  ): Promise<boolean> {
    const vaultOwnerToken = options?.vaultOwnerToken ?? this.getVaultOwnerToken();
    const vaultKey = options?.vaultKey;

    if (Capacitor.isNativePlatform()) {
      if (vaultKey) {
        return this.deleteAttributeBlobFlow(userId, domain, attributeKey, vaultKey, vaultOwnerToken);
      }
      const result = await HushhWorldModel.deleteAttribute({
        userId,
        domain,
        attributeKey,
        vaultOwnerToken: vaultOwnerToken ?? undefined,
      });
      return result.success;
    }

    // Web: client-side blob flow (required; legacy DELETE returns 410)
    if (vaultKey) {
      return this.deleteAttributeBlobFlow(userId, domain, attributeKey, vaultKey, vaultOwnerToken);
    }
    const response = await ApiService.apiFetch(
      `/api/world-model/attributes/${userId}/${domain}/${encodeURIComponent(attributeKey)}`,
      { method: "DELETE", headers: this.getAuthHeaders(vaultOwnerToken) }
    );
    if (response.status === 410) {
      return false;
    }
    return response.ok;
  }

  private static async deleteAttributeBlobFlow(
    userId: string,
    domain: string,
    attributeKey: string,
    vaultKey: string,
    vaultOwnerToken?: string
  ): Promise<boolean> {
    const blob = await WorldModelService.getDomainData(userId, domain, vaultOwnerToken);
    if (!blob) {
      return true;
    }
    const { decryptData } = await import("@/lib/vault/encrypt");
    const { HushhVault } = await import("@/lib/capacitor");
    let full: Record<string, Record<string, unknown>>;
    try {
      const decrypted = await decryptData(
        {
          ciphertext: blob.ciphertext,
          iv: blob.iv,
          tag: blob.tag,
          encoding: "base64",
          algorithm: (blob.algorithm || "aes-256-gcm") as "aes-256-gcm",
        },
        vaultKey
      );
      full = JSON.parse(decrypted) as Record<string, Record<string, unknown>>;
    } catch {
      return false;
    }
    if (!full[domain]) {
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(full[domain], attributeKey)) {
      return true;
    }
    delete full[domain][attributeKey];
    const metadata = await WorldModelService.getMetadata(userId, true, vaultOwnerToken);
    const domainMeta = metadata.domains.find((d) => d.key === domain);
    const currentSummary = domainMeta?.summary ?? {};
    const updatedSummary: Record<string, unknown> = { ...currentSummary };
    const countKeys = ["holdings_count", "attribute_count", "item_count"];
    for (const key of countKeys) {
      const v = updatedSummary[key];
      if (typeof v === "number" && v > 0) {
        updatedSummary[key] = v - 1;
        break;
      }
    }
    updatedSummary.last_updated = new Date().toISOString();
    const encrypted = await HushhVault.encryptData({
      keyHex: vaultKey,
      plaintext: JSON.stringify(full),
    });
    const result = await WorldModelService.storeDomainData({
      userId,
      domain,
      encryptedBlob: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        algorithm: "aes-256-gcm",
      },
      summary: updatedSummary as Record<string, string | number>,
      vaultOwnerToken: vaultOwnerToken ?? undefined,
    });
    return result.success;
  }

  /**
   * Get domains that have data for a user.
   */
  static async getUserDomains(userId: string): Promise<DomainSummary[]> {
    if (Capacitor.isNativePlatform()) {
      const nativeResult = await HushhWorldModel.getUserDomains({
        userId,
        vaultOwnerToken: this.getVaultOwnerToken(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      const domains = raw.domains || raw.data || [];
      return (domains as Record<string, unknown>[]).map((d) => ({
        key: (d.domain_key || d.key) as string,
        displayName: (d.display_name || d.displayName) as string,
        icon: (d.icon_name || d.icon) as string,
        color: (d.color_hex || d.color) as string,
        attributeCount: (d.attribute_count || d.attributeCount || 0) as number,
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
      const nativeResult = await HushhWorldModel.listDomains({
        includeEmpty,
        vaultOwnerToken: this.getVaultOwnerToken(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      const domains = raw.domains || raw.data || [];
      return (domains as Record<string, unknown>[]).map((d) => ({
        key: (d.domain_key || d.key) as string,
        displayName: (d.display_name || d.displayName) as string,
        description: (d.description || null) as string | null,
        icon: (d.icon_name || d.icon) as string,
        color: (d.color_hex || d.color) as string,
        attributeCount: (d.attribute_count || d.attributeCount || 0) as number,
        userCount: (d.user_count || d.userCount || 0) as number,
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
  static async getAvailableScopes(
    userId: string,
    vaultOwnerToken?: string
  ): Promise<ScopeDiscovery> {
    if (Capacitor.isNativePlatform()) {
      const nativeResult = await HushhWorldModel.getAvailableScopes({
        userId,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      return {
        userId: raw.user_id || raw.userId || userId,
        availableDomains: (raw.available_domains || raw.availableDomains || []).map(
          (d: Record<string, unknown>) => ({
            domain: d.domain as string,
            displayName: (d.display_name || d.displayName) as string,
            scopes: (d.scopes || []) as string[],
          })
        ),
        allScopes: raw.all_scopes || raw.allScopes || [],
        wildcardScopes: raw.wildcard_scopes || raw.wildcardScopes || [],
      };
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/scopes/${userId}`, {
      headers: this.getAuthHeaders(vaultOwnerToken),
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
    portfolioName = "Main Portfolio",
    vaultOwnerToken?: string
  ): Promise<Record<string, unknown> | null> {
    if (Capacitor.isNativePlatform()) {
      const nativeResult = await HushhWorldModel.getPortfolio({
        userId,
        portfolioName,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      return raw.portfolio || null;
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/portfolio/${userId}?portfolio_name=${encodeURIComponent(portfolioName)}`,
      {
        headers: this.getAuthHeaders(vaultOwnerToken),
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
    userId: string,
    vaultOwnerToken?: string
  ): Promise<Record<string, unknown>[]> {
    if (Capacitor.isNativePlatform()) {
      const nativeResult = await HushhWorldModel.listPortfolios({
        userId,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = nativeResult as any;
      return raw.portfolios || raw.data || [];
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(`/api/world-model/portfolios/${userId}`, {
      headers: this.getAuthHeaders(vaultOwnerToken),
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
    domain: string,
    vaultOwnerToken?: string
  ): Promise<EncryptedValue | null> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.getDomainData({
        userId,
        domain,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      if (!result.encrypted_blob) {
        return null;
      }
      return {
        ciphertext: result.encrypted_blob.ciphertext,
        iv: result.encrypted_blob.iv,
        tag: result.encrypted_blob.tag,
        algorithm: result.encrypted_blob.algorithm || "aes-256-gcm",
      };
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/domain-data/${userId}/${domain}`,
      {
        headers: this.getAuthHeaders(vaultOwnerToken),
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
    domain: string,
    vaultOwnerToken?: string
  ): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhWorldModel.clearDomain({
        userId,
        domain,
        vaultOwnerToken: this.getVaultOwnerToken(vaultOwnerToken),
      });
      return result.success;
    }

    // Web: Use ApiService.apiFetch() for tri-flow compliance
    const response = await ApiService.apiFetch(
      `/api/world-model/domain-data/${userId}/${domain}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(vaultOwnerToken),
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
