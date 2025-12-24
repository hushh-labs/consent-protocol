/**
 * Hushh Consent Protocol - Capacitor Native Plugins
 *
 * This file registers the native Swift plugins that implement the consent protocol.
 * The plugins provide:
 *
 * - HushhConsentPlugin: Token issuance, validation, revocation (mirrors token.py)
 * - HushhVaultPlugin: Encrypted storage with SQLCipher (mirrors encrypt.ts + vault)
 * - HushhKeychainPlugin: iOS Keychain for secure key storage
 *
 * IMPORTANT: These plugins call into native Swift code.
 * For web/cloud deployment, use the existing API routes instead.
 */

import { registerPlugin } from "@capacitor/core";

import type {
  // Consent types
  IssueTokenOptions,
  IssueTokenResult,
  ValidateTokenOptions,
  ValidateTokenResult,
  RevokeTokenOptions,
  CreateTrustLinkOptions,
  TrustLink,
  VerifyTrustLinkOptions,
  VerifyTrustLinkResult,
  // Vault types
  EncryptDataOptions,
  EncryptedPayload,
  DecryptDataOptions,
  DecryptDataResult,
  StorePreferenceOptions,
  GetPreferencesOptions,
  GetPreferencesResult,
  DeriveKeyOptions,
  DeriveKeyResult,
  // Keychain types
  KeychainSetOptions,
  KeychainGetOptions,
  KeychainGetResult,
  KeychainDeleteOptions,
} from "./types";

// ==================== HushhConsentPlugin ====================
// Mirrors: consent-protocol/hushh_mcp/consent/token.py
//          consent-protocol/hushh_mcp/trust/link.py

export interface HushhConsentPlugin {
  /**
   * Issue a new consent token
   * Mirrors: issue_token() in token.py
   *
   * Token format: HCT:base64(userId|agentId|scope|issuedAt|expiresAt).signature
   */
  issueToken(options: IssueTokenOptions): Promise<IssueTokenResult>;

  /**
   * Validate a consent token
   * Mirrors: validate_token() in token.py
   *
   * Checks: prefix, signature (HMAC-SHA256), expiry, scope match
   */
  validateToken(options: ValidateTokenOptions): Promise<ValidateTokenResult>;

  /**
   * Revoke a consent token
   * Mirrors: revoke_token() in token.py
   */
  revokeToken(options: RevokeTokenOptions): Promise<void>;

  /**
   * Check if a token is revoked
   * Mirrors: is_token_revoked() in token.py
   */
  isTokenRevoked(options: { token: string }): Promise<{ revoked: boolean }>;

  /**
   * Create a TrustLink for agent-to-agent delegation
   * Mirrors: create_trust_link() in link.py
   */
  createTrustLink(options: CreateTrustLinkOptions): Promise<TrustLink>;

  /**
   * Verify a TrustLink
   * Mirrors: verify_trust_link() in link.py
   */
  verifyTrustLink(
    options: VerifyTrustLinkOptions
  ): Promise<VerifyTrustLinkResult>;
}

export const HushhConsent = registerPlugin<HushhConsentPlugin>("HushhConsent", {
  // Web fallback - in web/cloud mode, these would call the API routes
  web: () =>
    import("./plugins/consent-web").then((m) => new m.HushhConsentWeb()),
});

// ==================== HushhVaultPlugin ====================
// Mirrors: lib/vault/encrypt.ts (client-side encryption)
//          consent-protocol vault storage concepts

export interface HushhVaultPlugin {
  /**
   * Derive an encryption key from passphrase
   * Mirrors: PBKDF2 key derivation in encrypt.ts
   *
   * Uses: PBKDF2 with 100,000 iterations, SHA-256, 256-bit output
   */
  deriveKey(options: DeriveKeyOptions): Promise<DeriveKeyResult>;

  /**
   * Encrypt data using AES-256-GCM
   * Mirrors: encryptData() in encrypt.ts
   *
   * Uses: 12-byte IV, returns ciphertext + IV + tag in base64
   */
  encryptData(options: EncryptDataOptions): Promise<EncryptedPayload>;

  /**
   * Decrypt data using AES-256-GCM
   * Mirrors: decryptData() in encrypt.ts
   */
  decryptData(options: DecryptDataOptions): Promise<DecryptDataResult>;

  /**
   * Store encrypted preference in local SQLCipher database
   * Requires valid consent token
   */
  storePreference(options: StorePreferenceOptions): Promise<void>;

  /**
   * Retrieve preferences from local SQLCipher database
   */
  getPreferences(options: GetPreferencesOptions): Promise<GetPreferencesResult>;

  /**
   * Delete preferences for a domain
   */
  deletePreferences(options: { userId: string; domain: string }): Promise<void>;

  // ==================== Cloud DB Methods ====================
  // These call the Cloud Run backend directly from iOS

  /**
   * Check if user has a vault on Cloud DB
   * Replaces: /api/vault/check endpoint on iOS
   */
  hasVault(options: { userId: string; authToken?: string }): Promise<{ exists: boolean }>;

  /**
   * Get encrypted vault key from Cloud DB
   * Replaces: /api/vault/get endpoint on iOS
   */
  getVault(options: { userId: string; authToken?: string }): Promise<{
    authMethod: string;
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
  }>;

  /**
   * Store encrypted vault key to Cloud DB
   * Replaces: /api/vault/setup endpoint on iOS
   */
  setupVault(options: {
    userId: string;
    authMethod?: string;
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;
}

export const HushhVault = registerPlugin<HushhVaultPlugin>("HushhVault", {
  web: () => import("./plugins/vault-web").then((m) => new m.HushhVaultWeb()),
});

// ==================== HushhKeychainPlugin ====================
// iOS Keychain for secure storage of vault key and secrets

export interface HushhKeychainPlugin {
  /**
   * Store a value in iOS Keychain
   */
  set(options: KeychainSetOptions): Promise<void>;

  /**
   * Retrieve a value from iOS Keychain
   */
  get(options: KeychainGetOptions): Promise<KeychainGetResult>;

  /**
   * Delete a value from iOS Keychain
   */
  delete(options: KeychainDeleteOptions): Promise<void>;

  /**
   * Check if biometric authentication is available
   */
  isBiometricAvailable(): Promise<{
    available: boolean;
    type: "faceId" | "touchId" | "none";
  }>;

  /**
   * Store a value requiring biometric authentication to retrieve
   */
  setBiometric(
    options: KeychainSetOptions & { promptMessage: string }
  ): Promise<void>;

  /**
   * Retrieve a biometric-protected value
   */
  getBiometric(
    options: KeychainGetOptions & { promptMessage: string }
  ): Promise<KeychainGetResult>;
}

export const HushhKeychain = registerPlugin<HushhKeychainPlugin>(
  "HushhKeychain",
  {
    web: () =>
      import("./plugins/keychain-web").then((m) => new m.HushhKeychainWeb()),
  }
);

// ==================== HushhSettingsPlugin ====================
// Settings management - DEV defaults to remote

export interface HushhSettingsData {
  useRemoteSync: boolean;
  syncOnWifiOnly: boolean;
  useRemoteLLM: boolean;
  preferredLLMProvider: "local" | "mlx" | "openai" | "anthropic" | "google";
  requireBiometricUnlock: boolean;
  autoLockTimeout: number;
  theme: "system" | "light" | "dark";
  hapticFeedback: boolean;
  showDebugInfo: boolean;
  verboseLogging: boolean;
}

export interface HushhSettingsPlugin {
  getSettings(): Promise<HushhSettingsData>;
  updateSettings(options: Partial<HushhSettingsData>): Promise<{ success: boolean }>;
  resetSettings(): Promise<{ success: boolean }>;
  shouldUseLocalAgents(): Promise<{ value: boolean }>;
  shouldSyncToCloud(): Promise<{ value: boolean }>;
}

export const HushhSettingsNative = registerPlugin<HushhSettingsPlugin>(
  "HushhSettings",
  {
    web: () =>
      import("./plugins/settings-web").then((m) => new m.HushhSettingsWeb()),
  }
);

// ==================== HushhDatabasePlugin ====================
// Local SQLite/IndexedDB storage

export interface HushhDatabasePlugin {
  initialize(): Promise<{ success: boolean }>;
  hasVault(options: { userId: string }): Promise<{ exists: boolean }>;
  storeVaultKey(options: {
    userId: string;
    authMethod: string;
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
  }): Promise<{ success: boolean }>;
  getVaultKey(options: { userId: string }): Promise<{
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
  }>;
  storeFoodPreferences(options: {
    userId: string;
    dietaryRestrictions?: EncryptedPayload;
    cuisinePreferences?: EncryptedPayload;
    monthlyBudget?: EncryptedPayload;
  }): Promise<{ success: boolean }>;
  getFoodPreferences(options: { userId: string }): Promise<{
    data: Record<string, EncryptedPayload> | null;
  }>;
  close(): Promise<{ success: boolean }>;
}

export const HushhDatabase = registerPlugin<HushhDatabasePlugin>(
  "HushhDatabase",
  {
    web: () =>
      import("./plugins/database-web").then((m) => new m.HushhDatabaseWeb()),
  }
);

// ==================== HushhAgentPlugin ====================
// Local agent runtime

export interface AgentResponse {
  response: string;
  sessionState?: Record<string, unknown>;
  collectedData?: Record<string, unknown>;
  isComplete: boolean;
  needsConsent: boolean;
  consentScope?: string;
  uiType?: "buttons" | "checkbox" | "text";
  options?: string[];
  allowCustom?: boolean;
  allowNone?: boolean;
  consentToken?: string;
  consentIssuedAt?: number;
  consentExpiresAt?: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  port: number;
  available: boolean;
}

export interface HushhAgentPlugin {
  handleMessage(options: {
    message: string;
    userId: string;
    agentId?: string;
    sessionState?: Record<string, unknown>;
  }): Promise<AgentResponse>;
  classifyIntent(options: { message: string }): Promise<{
    hasDelegate: boolean;
    targetAgent: string;
    targetPort?: number;
    domain: string;
  }>;
  getAgentInfo(): Promise<{
    agents: AgentInfo[];
    version: string;
    protocolVersion: string;
  }>;
}

export const HushhAgent = registerPlugin<HushhAgentPlugin>("HushhAgent", {
  web: () => import("./plugins/agent-web").then((m) => new m.HushhAgentWeb()),
});

// ==================== HushhSyncPlugin ====================
// Handles local-cloud data synchronization

export interface SyncResult {
  success: boolean;
  pushedRecords: number;
  pulledRecords: number;
  conflicts: number;
  timestamp: number;
}

export interface SyncStatus {
  pendingCount: number;
  lastSyncTimestamp: number;
  hasPendingChanges: boolean;
}

export interface HushhSyncPlugin {
  /**
   * Full sync: push local changes then pull remote changes
   */
  sync(options?: { authToken?: string }): Promise<SyncResult>;

  /**
   * Push local changes to cloud
   */
  push(options?: { authToken?: string }): Promise<{ success: boolean; pushedRecords: number }>;

  /**
   * Pull remote changes to local
   */
  pull(options?: { authToken?: string }): Promise<{ success: boolean; pulledRecords: number }>;

  /**
   * Sync a specific user's vault
   */
  syncVault(options: { userId: string; authToken?: string }): Promise<{ success: boolean }>;

  /**
   * Get current sync status
   */
  getSyncStatus(): Promise<SyncStatus>;
}

export const HushhSync = registerPlugin<HushhSyncPlugin>("HushhSync", {
  web: () => import("./plugins/sync-web").then((m) => new m.HushhSyncWeb()),
});

// ==================== Export all ====================

export * from "./types";
