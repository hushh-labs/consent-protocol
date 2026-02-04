/**
 * World Model Web Implementation
 *
 * Fallback for web platform - uses standard fetch to Next.js API routes.
 * This plugin provides the web implementation for HushhWorldModel.
 */

import { WebPlugin } from "@capacitor/core";
import type { HushhWorldModelPlugin } from "@/lib/capacitor/world-model";

export class HushhWorldModelWeb
  extends WebPlugin
  implements HushhWorldModelPlugin
{
  private async getAuthHeader(overrideToken?: string): Promise<string> {
    const token = overrideToken || sessionStorage.getItem("vault_owner_token");
    return token ? `Bearer ${token}` : "";
  }

  async getMetadata(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
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
  }> {
    const response = await fetch(`/api/world-model/metadata/${options.userId}`, {
      headers: {
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
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

  async getIndex(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    userId: string;
    domainSummaries: Record<string, Record<string, unknown>>;
    availableDomains: string[];
    computedTags: string[];
    activityScore: number | null;
    lastActiveAt: string | null;
    totalAttributes: number;
    modelVersion: number;
  }> {
    const response = await fetch(`/api/world-model/index/${options.userId}`, {
      headers: {
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
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

  async getAttributes(options: {
    userId: string;
    domain?: string;
    vaultOwnerToken?: string;
  }): Promise<{
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
  }> {
    const url = options.domain
      ? `/api/world-model/attributes/${options.userId}?domain=${options.domain}`
      : `/api/world-model/attributes/${options.userId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get attributes: ${response.status}`);
    }

    const data = await response.json();

    return {
      attributes: (data.attributes || []).map((a: Record<string, unknown>) => ({
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
      })),
    };
  }

  async storeAttribute(options: {
    userId: string;
    attributeKey: string;
    ciphertext: string;
    iv: string;
    tag: string;
    domain?: string;
    displayName?: string;
    dataType?: string;
    source?: string;
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean; scope: string }> {
    const response = await fetch("/api/world-model/attributes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
      body: JSON.stringify({
        user_id: options.userId,
        domain: options.domain,
        attribute_key: options.attributeKey,
        ciphertext: options.ciphertext,
        iv: options.iv,
        tag: options.tag,
        algorithm: "aes-256-gcm",
        source: options.source || "explicit",
        display_name: options.displayName,
        data_type: options.dataType || "string",
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

  async deleteAttribute(options: {
    userId: string;
    domain: string;
    attributeKey: string;
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch(
      `/api/world-model/attributes/${options.userId}/${options.domain}/${options.attributeKey}`,
      {
        method: "DELETE",
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    return { success: response.ok };
  }

  async getUserDomains(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    domains: Array<{
      key: string;
      displayName: string;
      icon: string;
      color: string;
      attributeCount: number;
    }>;
  }> {
    const response = await fetch(`/api/world-model/domains/${options.userId}`, {
      headers: {
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user domains: ${response.status}`);
    }

    const data = await response.json();

    return {
      domains: (data.domains || []).map((d: Record<string, unknown>) => ({
        key: (d.domain_key || d.key) as string,
        displayName: (d.display_name || d.displayName) as string,
        icon: (d.icon_name || d.icon) as string,
        color: (d.color_hex || d.color) as string,
        attributeCount: (d.attribute_count || d.attributeCount) as number,
      })),
    };
  }

  async listDomains(options: {
    includeEmpty?: boolean;
    vaultOwnerToken?: string;
  }): Promise<{
    domains: Array<{
      key: string;
      displayName: string;
      description: string | null;
      icon: string;
      color: string;
      attributeCount: number;
      userCount: number;
    }>;
  }> {
    const response = await fetch(
      `/api/world-model/domains?include_empty=${options.includeEmpty || false}`,
      {
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list domains: ${response.status}`);
    }

    const data = await response.json();

    return {
      domains: (data.domains || []).map((d: Record<string, unknown>) => ({
        key: (d.domain_key || d.key) as string,
        displayName: (d.display_name || d.displayName) as string,
        description: d.description as string | null,
        icon: (d.icon_name || d.icon) as string,
        color: (d.color_hex || d.color) as string,
        attributeCount: (d.attribute_count || d.attributeCount) as number,
        userCount: (d.user_count || d.userCount) as number,
      })),
    };
  }

  async getAvailableScopes(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    userId: string;
    availableDomains: Array<{
      domain: string;
      displayName: string;
      scopes: string[];
    }>;
    allScopes: string[];
    wildcardScopes: string[];
  }> {
    const response = await fetch(`/api/world-model/scopes/${options.userId}`, {
      headers: {
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
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

  async getPortfolio(options: {
    userId: string;
    portfolioName?: string;
    vaultOwnerToken?: string;
  }): Promise<{ portfolio: Record<string, unknown> | null }> {
    const portfolioName = options.portfolioName || "Main Portfolio";
    const response = await fetch(
      `/api/world-model/portfolio/${options.userId}?portfolio_name=${encodeURIComponent(portfolioName)}`,
      {
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get portfolio: ${response.status}`);
    }

    const data = await response.json();
    return { portfolio: data.portfolio };
  }

  async listPortfolios(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    portfolios: Record<string, unknown>[];
  }> {
    const response = await fetch(
      `/api/world-model/portfolios/${options.userId}`,
      {
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list portfolios: ${response.status}`);
    }

    const data = await response.json();
    return { portfolios: data.portfolios || [] };
  }

  async storeDomainData(options: {
    userId: string;
    domain: string;
    encryptedBlob: {
      ciphertext: string;
      iv: string;
      tag: string;
      algorithm?: string;
    };
    summary: Record<string, unknown>;
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch("/api/world-model/store-domain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.getAuthHeader(options.vaultOwnerToken),
      },
      body: JSON.stringify({
        user_id: options.userId,
        domain: options.domain,
        encrypted_blob: {
          ciphertext: options.encryptedBlob.ciphertext,
          iv: options.encryptedBlob.iv,
          tag: options.encryptedBlob.tag,
          algorithm: options.encryptedBlob.algorithm || "aes-256-gcm",
        },
        summary: options.summary,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store domain data: ${response.status}`);
    }

    return response.json();
  }

  async getDomainData(options: {
    userId: string;
    domain: string;
    vaultOwnerToken?: string;
  }): Promise<{
    encrypted_blob?: {
      ciphertext: string;
      iv: string;
      tag: string;
      algorithm?: string;
    };
  }> {
    const response = await fetch(
      `/api/world-model/domain-data/${options.userId}/${options.domain}`,
      {
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get domain data: ${response.status}`);
    }

    return response.json();
  }

  async clearDomain(options: {
    userId: string;
    domain: string;
    vaultOwnerToken?: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch(
      `/api/world-model/domain-data/${options.userId}/${options.domain}`,
      {
        method: "DELETE",
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    return { success: response.ok };
  }

  async getInitialChatState(options: {
    userId: string;
    vaultOwnerToken?: string;
  }): Promise<{
    is_new_user: boolean;
    has_portfolio: boolean;
    has_financial_data?: boolean;
    welcome_type: string;
    total_attributes: number;
    available_domains: string[];
  }> {
    const response = await fetch(
      `/api/kai/chat/initial-state/${options.userId}`,
      {
        headers: {
          Authorization: await this.getAuthHeader(options.vaultOwnerToken),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get initial chat state: ${response.status}`);
    }

    return response.json();
  }
}
