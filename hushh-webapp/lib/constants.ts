// lib/constants.ts
/**
 * Shared constants for Hushh PDA frontend
 */

/**
 * Consent scopes matching backend ConsentScope enum
 * 
 * NOTE: Uses dynamic attr.DOMAIN.ATTRIBUTE scopes instead of legacy vault.read/vault.write scopes.
 * Legacy scopes are kept for backward compatibility but should not be used in new code.
 */
export const CONSENT_SCOPES = {
  // Dynamic attr.* scopes (canonical - preferred)
  ATTR_FOOD: "attr.food.*",
  ATTR_PROFESSIONAL: "attr.professional.*",
  ATTR_FINANCIAL: "attr.financial.*",
  ATTR_FINANCIAL_RISK_PROFILE: "attr.financial.risk_profile",
  ATTR_KAI_DECISIONS: "attr.kai_decisions.*",
  ATTR_HEALTH: "attr.health.*",

  // World model scopes
  WORLD_MODEL_READ: "world_model.read",
  WORLD_MODEL_WRITE: "world_model.write",

  // Vault owner (master scope)
  VAULT_OWNER: "vault.owner",

  // Agent permissioning
  AGENT_IDENTITY_VERIFY: "agent.identity.verify",
  AGENT_SHOPPING_PURCHASE: "agent.shopping.purchase",
  AGENT_FOOD_COLLECT: "agent.food.collect",
  AGENT_KAI_ANALYZE: "agent.kai.analyze",

  // Custom scopes
  CUSTOM_TEMPORARY: "custom.temporary",

  // Legacy scopes (deprecated - for backward compatibility only)
  /** @deprecated Use ATTR_FOOD instead */
  VAULT_READ_EMAIL: "vault.read.email",
  /** @deprecated Use ATTR_FOOD instead */
  VAULT_READ_PHONE: "vault.read.phone",
  /** @deprecated Use ATTR_FOOD instead */
  VAULT_READ_FOOD: "vault.read.food",
  /** @deprecated Use ATTR_PROFESSIONAL instead */
  VAULT_READ_PROFESSIONAL: "vault.read.professional",
  /** @deprecated Use ATTR_FINANCIAL instead */
  VAULT_READ_FINANCE: "vault.read.finance",
  /** @deprecated Use VAULT_OWNER instead */
  VAULT_READ_ALL: "vault.read.all",
  /** @deprecated Use ATTR_FOOD instead */
  VAULT_WRITE_FOOD: "vault.write.food",
  /** @deprecated Use ATTR_FINANCIAL instead */
  VAULT_WRITE_FINANCE: "vault.write.finance",
  /** @deprecated Use ATTR_PROFESSIONAL instead */
  VAULT_WRITE_PROFESSIONAL: "vault.write.professional",
} as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[keyof typeof CONSENT_SCOPES];

/**
 * Consent timeout configuration (synced with backend via env var)
 * Set NEXT_PUBLIC_CONSENT_TIMEOUT_SECONDS in your .env to sync with backend
 */
export const CONSENT_TIMEOUT_SECONDS = parseInt(
  process.env.NEXT_PUBLIC_CONSENT_TIMEOUT_SECONDS || "120",
  10
);
export const CONSENT_TIMEOUT_MS = CONSENT_TIMEOUT_SECONDS * 1000;

/**
 * API timeouts (milliseconds)
 */
export const API_TIMEOUTS = {
  /** Consent wait timeout - synced with backend */
  CONSENT_WAIT: CONSENT_TIMEOUT_MS,
  /** Agent chat request timeout */
  AGENT_CHAT: 60000,
  /** Default API request timeout */
  DEFAULT: 10000,
} as const;

/**
 * Backend API configuration
 */
export const API_CONFIG = {
  /** Backend base URL */
  BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
  /** SSE endpoint for consent notifications */
  SSE_CONSENT_EVENTS: "/api/consent/events",
} as const;

/**
 * Consent token prefix
 */
export const CONSENT_TOKEN_PREFIX = "HCT" as const;

/**
 * Rate limit configuration (for client-side awareness)
 */
export const RATE_LIMITS = {
  /** Max consent requests per minute */
  CONSENT_REQUEST_PER_MIN: 10,
  /** Max consent actions (approve/deny) per minute */
  CONSENT_ACTION_PER_MIN: 20,
} as const;

/**
 * Agent identifiers
 */
export const AGENTS = {
  ORCHESTRATOR: "agent_orchestrator",
  FOOD_DINING: "agent_food_dining",
  PROFESSIONAL: "agent_professional_profile",
  IDENTITY: "agent_identity",
  SHOPPING: "agent_shopping",
} as const;

export type AgentId = (typeof AGENTS)[keyof typeof AGENTS];
