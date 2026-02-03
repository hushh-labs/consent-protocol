// lib/vault/domains.ts

/**
 * Vault Domain Abstraction
 *
 * DYNAMIC DOMAINS: Domains are now fetched from the backend at runtime.
 * This file provides backward compatibility and helper functions.
 *
 * 3-Layer Security:
 * 1. Firebase Auth (identity) - user is who they claim to be
 * 2. BYOK Encryption - data is encrypted/decrypted client-side only
 * 3. Consent Protocol - scoped tokens for each action
 *
 * NOTE: Uses dynamic attr.{domain}.* scopes.
 */

import {
  WorldModelService,
  DomainInfo,
  ScopeDisplayInfo
} from "@/lib/services/world-model-service";

// ============================================================================
// DYNAMIC DOMAIN TYPES
// ============================================================================

/**
 * Domain metadata from WorldModelService.
 * Re-exported for backward compatibility.
 */
export type { DomainInfo, ScopeDisplayInfo } from "@/lib/services/world-model-service";

// ============================================================================
// LEGACY SUPPORT (Deprecated)
// ============================================================================

/**
 * @deprecated Use DomainInfo from WorldModelService.listDomains() instead.
 * Legacy type kept for backward compatibility.
 */
export type VaultDomain = "finance" | "health";

/**
 * Domain configuration.
 */
export interface DomainConfig {
  /** Human-readable display name */
  displayName: string;
  /** Icon emoji for UI */
  icon: string;
  /** Description for consent dialogs */
  description: string;
  /** Required scope for accessing this domain (dynamic attr.* pattern) */
  scope: string;
  /** Database getter function */
  getData: (
    userId: string,
    consentToken?: string
  ) => Promise<Record<string, unknown> | null>;
  /** Field names in this domain */
  fields: string[];
}

/**
 * @deprecated Legacy domain registry - Use WorldModelService.listDomains() instead.
 * Kept for backward compatibility only. DO NOT add new domains here.
 */
export const VAULT_DOMAINS: Record<VaultDomain, DomainConfig> = {
  finance: {
    displayName: "Finance",
    icon: "💰",
    description: "Financial preferences and budgeting",
    scope: "attr.financial.*",
    getData: async () => null, // Coming soon
    fields: [],
  },
  health: {
    displayName: "Health & Wellness",
    icon: "🏥",
    description: "Health preferences and wellness goals",
    scope: "attr.health.*",
    getData: async () => null, // Coming soon
    fields: [],
  },
};

// ============================================================================
// DYNAMIC DOMAIN UTILITIES (PREFERRED)
// ============================================================================

/**
 * Fetch all domains dynamically from backend.
 * This is the preferred way to get domain information.
 */
export async function fetchDomains(includeEmpty = false): Promise<DomainInfo[]> {
  try {
    return await WorldModelService.listDomains(includeEmpty);
  } catch (error) {
    console.error("[domains] Failed to fetch domains:", error);
    return [];
  }
}

/**
 * Fetch domains for a specific user.
 * Only returns domains where the user has data.
 * 
 * @deprecated Use WorldModelService.listDomains() instead - it now includes all domains.
 * This function is kept for backward compatibility but just calls listDomains().
 */
export async function fetchUserDomains(userId: string): Promise<DomainInfo[]> {
  try {
    // For now, just return all domains - the backend will eventually support user-specific filtering
    return await WorldModelService.listDomains(false);
  } catch (error) {
    console.error("[domains] Failed to fetch user domains:", error);
    return [];
  }
}

/**
 * Get scope display info for any scope.
 * Parses attr.{domain}.{attribute} pattern.
 */
export function getScopeDisplayInfo(scope: string): ScopeDisplayInfo {
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

// ============================================================================
// LEGACY UTILITIES (Deprecated but kept for compatibility)
// ============================================================================

/**
 * @deprecated Use fetchDomains() instead.
 * Get config for a domain.
 */
export function getDomainConfig(domain: VaultDomain): DomainConfig {
  return VAULT_DOMAINS[domain];
}

/**
 * @deprecated Use fetchDomains() with filter instead.
 * Get all active domains (those with getData implemented).
 */
export function getActiveDomains(): VaultDomain[] {
  return (Object.keys(VAULT_DOMAINS) as VaultDomain[]).filter(
    (d) => VAULT_DOMAINS[d].fields.length > 0
  );
}

/**
 * @deprecated Use fetchDomains() instead.
 * Get all domains including coming soon.
 */
export function getAllDomains(): VaultDomain[] {
  return Object.keys(VAULT_DOMAINS) as VaultDomain[];
}

/**
 * @deprecated Use fetchUserDomains() instead.
 * Check if a domain is active (has data).
 */
export function isDomainActive(domain: VaultDomain): boolean {
  return VAULT_DOMAINS[domain].fields.length > 0;
}

/**
 * Get all preferences across all active domains for a user.
 * Returns encrypted data only - decryption happens client-side.
 */
export async function getAllUserPreferences(
  userId: string,
  consentToken?: string
): Promise<Record<string, unknown> | null> {
  const results: Record<string, unknown> = {};
  let hasData = false;

  for (const domain of getActiveDomains()) {
    const config = VAULT_DOMAINS[domain];
    const data = await config.getData(userId, consentToken);
    if (data) {
      Object.assign(results, data);
      hasData = true;
    }
  }

  return hasData ? results : null;
}

/**
 * Get preferences for a specific domain.
 */
export async function getDomainPreferences(
  userId: string,
  domain: VaultDomain,
  consentToken?: string
): Promise<Record<string, unknown> | null> {
  const config = VAULT_DOMAINS[domain];
  return config.getData(userId, consentToken);
}
