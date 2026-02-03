/**
 * Hushh Consent Protocol - Capacitor Plugin Type Definitions
 *
 * These types mirror the consent-protocol Python types for parity:
 * - hushh_mcp/consent/token.py → HushhConsentPlugin
 * - hushh_mcp/trust/link.py → TrustLink types
 * - hushh_mcp/types.py → EncryptedPayload, VaultRecord
 * - hushh_mcp/constants.py → ConsentScope enum
 *
 * NOTE: Uses dynamic attr.DOMAIN.ATTRIBUTE scopes instead of legacy vault.read/vault.write scopes.
 */

// ==================== Consent Scopes ====================
// Mirrors: consent-protocol/hushh_mcp/constants.py

export enum ConsentScope {
  // Dynamic attr.* scopes (canonical - preferred)
  ATTR_FINANCIAL = "attr.financial.*",
  ATTR_FINANCIAL_RISK_PROFILE = "attr.financial.risk_profile",
  ATTR_KAI_DECISIONS = "attr.kai_decisions.*",
  ATTR_HEALTH = "attr.health.*",

  // World model scopes
  WORLD_MODEL_READ = "world_model.read",
  WORLD_MODEL_WRITE = "world_model.write",

  // Vault owner (master scope)
  VAULT_OWNER = "vault.owner",

  // Agent permissioning
  AGENT_SHOPPING_PURCHASE = "agent.shopping.purchase",
  AGENT_FINANCE_ANALYZE = "agent.finance.analyze",
  AGENT_IDENTITY_VERIFY = "agent.identity.verify",
  AGENT_SALES_OPTIMIZE = "agent.sales.optimize",
  AGENT_KAI_ANALYZE = "agent.kai.analyze",

  // Custom scopes
  CUSTOM_TEMPORARY = "custom.temporary",
  CUSTOM_SESSION_WRITE = "custom.session.write",

  // Legacy scopes (deprecated - for backward compatibility only)
  /** @deprecated */
  VAULT_READ_EMAIL = "vault.read.email",
  /** @deprecated */
  VAULT_READ_PHONE = "vault.read.phone",
  /** @deprecated Use ATTR_FINANCIAL instead */
  VAULT_READ_FINANCE = "vault.read.finance",
  /** @deprecated */
  VAULT_READ_CONTACTS = "vault.read.contacts",
  /** @deprecated Use VAULT_OWNER instead */
  VAULT_READ_ALL = "vault.read.all",
  /** @deprecated Use ATTR_FINANCIAL instead */
  VAULT_WRITE_FINANCE = "vault.write.finance",
}

// ==================== Token Types ====================
// Mirrors: consent-protocol/hushh_mcp/types.py

export interface HushhConsentToken {
  token: string;
  userId: string;
  agentId: string;
  scope: ConsentScope | string;
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  signature: string;
}

export interface TrustLink {
  fromAgent: string;
  toAgent: string;
  scope: ConsentScope | string;
  createdAt: number;
  expiresAt: number;
  signedByUser: string;
  signature: string;
}

// ==================== Vault Types ====================
// Mirrors: lib/vault/encrypt.ts

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
  encoding: "base64" | "hex";
  algorithm: "aes-256-gcm" | "chacha20-poly1305";
}

export interface VaultRecord {
  userId: string;
  domain: string;
  fieldName: string;
  data: EncryptedPayload;
  agentId?: string;
  createdAt: number;
  updatedAt?: number;
  consentTokenId?: string;
}

// ==================== Plugin Method Types ====================

export interface IssueTokenOptions {
  userId: string;
  agentId: string;
  scope: ConsentScope | string;
  expiresInMs?: number;
}

export interface IssueTokenResult {
  token: string;
  tokenId: string;
  expiresAt: number;
}

export interface ValidateTokenOptions {
  token: string;
  expectedScope?: ConsentScope | string;
}

export interface ValidateTokenResult {
  valid: boolean;
  reason?: string;
  agentId?: string;
  userId?: string;
  scope?: string;
}

export interface RevokeTokenOptions {
  token: string;
}

export interface CreateTrustLinkOptions {
  fromAgent: string;
  toAgent: string;
  scope: ConsentScope | string;
  signedByUser: string;
  expiresInMs?: number;
}

export interface VerifyTrustLinkOptions {
  link: TrustLink;
  requiredScope?: ConsentScope | string;
}

export interface VerifyTrustLinkResult {
  valid: boolean;
  reason?: string;
}

// ==================== Vault Plugin Method Types ====================

export interface EncryptDataOptions {
  plaintext: string;
  keyHex: string;
}

export interface DecryptDataOptions {
  payload: EncryptedPayload;
  keyHex: string;
}

export interface DecryptDataResult {
  plaintext: string;
}

export interface StorePreferenceOptions {
  userId: string;
  domain: string;
  fieldName: string;
  data: EncryptedPayload;
  consentTokenId?: string;
}

export interface GetPreferencesOptions {
  userId: string;
  domain: string;
}

export interface GetPreferencesResult {
  preferences: VaultRecord[];
}

export interface DeriveKeyOptions {
  passphrase: string;
  salt?: string;
  iterations?: number;
}

export interface DeriveKeyResult {
  keyHex: string;
  salt: string;
}

// ==================== Keychain Types ====================

export interface KeychainSetOptions {
  key: string;
  value: string;
  accessGroup?: string;
  accessible?: "whenUnlocked" | "afterFirstUnlock" | "always";
}

export interface KeychainGetOptions {
  key: string;
  accessGroup?: string;
}

export interface KeychainGetResult {
  value: string | null;
}

export interface KeychainDeleteOptions {
  key: string;
  accessGroup?: string;
}
