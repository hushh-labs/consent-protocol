// lib/constants.ts
/**
 * Shared constants for Hushh PDA frontend
 */

/**
 * Consent scopes matching backend ConsentScope enum
 */
export const CONSENT_SCOPES = {
  // Vault READ scopes
  VAULT_READ_EMAIL: "vault.read.email",
  VAULT_READ_PHONE: "vault.read.phone",
  VAULT_READ_FOOD: "vault.read.food",
  VAULT_READ_PROFESSIONAL: "vault.read.professional",
  VAULT_READ_FINANCE: "vault.read.finance",
  VAULT_READ_ALL: "vault.read.all",

  // Vault WRITE scopes
  VAULT_WRITE_FOOD: "vault.write.food",
  VAULT_WRITE_FINANCE: "vault.write.finance",
  VAULT_WRITE_PROFESSIONAL: "vault.write.professional",

  // Agent permissioning
  AGENT_IDENTITY_VERIFY: "agent.identity.verify",
  AGENT_SHOPPING_PURCHASE: "agent.shopping.purchase",
  AGENT_FOOD_COLLECT: "agent.food.collect",

  // Custom scopes
  CUSTOM_TEMPORARY: "custom.temporary",
} as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[keyof typeof CONSENT_SCOPES];

/**
 * API timeouts (milliseconds)
 */
export const API_TIMEOUTS = {
  /** Consent polling/SSE timeout */
  CONSENT_POLL: 30000,
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
