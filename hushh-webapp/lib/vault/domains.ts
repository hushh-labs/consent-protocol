// lib/vault/domains.ts

/**
 * Vault Domain Abstraction
 *
 * DYNAMIC DOMAINS: Domains are now fetched from the backend at runtime.
 * This file provides helper functions for domain operations.
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
// DYNAMIC DOMAIN UTILITIES
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
 */
export async function fetchUserDomains(_userId: string): Promise<DomainInfo[]> {
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
