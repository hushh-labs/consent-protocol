// lib/vault/domains.ts

/**
 * Vault Domain Abstraction
 *
 * Provides a scalable, reusable pattern for accessing vault data across domains.
 * Each domain (food, professional, finance, etc.) follows the same consent-based
 * access pattern with proper validation.
 *
 * 3-Layer Security:
 * 1. Firebase Auth (identity) - user is who they claim to be
 * 2. BYOK Encryption - data is encrypted/decrypted client-side only
 * 3. Consent Protocol - scoped tokens for each action
 */

import { ApiService } from "@/lib/services/api-service";

// ============================================================================
// DOMAIN DEFINITIONS
// ============================================================================

/**
 * Available vault domains.
 * Add new domains here as the system scales.
 */
export type VaultDomain = "food" | "professional" | "finance" | "health";

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
  /** Required scope for reading this domain */
  readScope: string;
  /** Required scope for writing this domain */
  writeScope: string;
  /** Database getter function */
  getData: (
    userId: string,
    consentToken?: string
  ) => Promise<Record<string, unknown> | null>;
  /** Field names in this domain */
  fields: string[];
}

/**
 * Domain registry - single source of truth for all vault domains.
 */
export const VAULT_DOMAINS: Record<VaultDomain, DomainConfig> = {
  food: {
    displayName: "Food & Dining",
    icon: "🍽️",
    description: "Dietary restrictions, cuisine preferences, and budget",
    readScope: "vault.read.food",
    writeScope: "vault.write.food",
    getData: async (userId, token) => {
      if (!token) {
        console.error("[domains] No consent token provided for food data");
        return null;
      }
      const res = await ApiService.getFoodPreferences(userId, token);
      if (!res.ok) return null;
      const json = await res.json();
      return json.preferences;
    },
    fields: [
      "dietary_restrictions",
      "cuisine_preferences",
      "monthly_food_budget",
    ],
  },
  professional: {
    displayName: "Professional Profile",
    icon: "💼",
    description: "Job title, skills, experience, and preferences",
    readScope: "vault.read.professional",
    writeScope: "vault.write.professional",
    getData: async (userId, token) => {
      if (!token) {
        console.error(
          "[domains] No consent token provided for professional data"
        );
        return null;
      }
      const res = await ApiService.getProfessionalProfile(userId, token);
      if (!res.ok) return null;
      const json = await res.json();
      return json.preferences;
    },
    fields: [
      "professional_title",
      "skills",
      "experience_level",
      "job_preferences",
    ],
  },
  finance: {
    displayName: "Finance",
    icon: "💰",
    description: "Financial preferences and budgeting",
    readScope: "vault.read.finance",
    writeScope: "vault.write.finance",
    getData: async () => null, // Coming soon
    fields: [],
  },
  health: {
    displayName: "Health & Wellness",
    icon: "🏥",
    description: "Health preferences and wellness goals",
    readScope: "vault.read.health",
    writeScope: "vault.write.health",
    getData: async () => null, // Coming soon
    fields: [],
  },
};

// ============================================================================
// DOMAIN UTILITIES
// ============================================================================

/**
 * Get config for a domain.
 */
export function getDomainConfig(domain: VaultDomain): DomainConfig {
  return VAULT_DOMAINS[domain];
}

/**
 * Get all active domains (those with getData implemented).
 */
export function getActiveDomains(): VaultDomain[] {
  return (Object.keys(VAULT_DOMAINS) as VaultDomain[]).filter(
    (d) => VAULT_DOMAINS[d].fields.length > 0
  );
}

/**
 * Get all domains including coming soon.
 */
export function getAllDomains(): VaultDomain[] {
  return Object.keys(VAULT_DOMAINS) as VaultDomain[];
}

/**
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
