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

// ==================== HushhAuthPlugin ====================
// Native iOS Google Sign-In using ASWebAuthenticationSession

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string;
  emailVerified?: boolean;
}

export interface HushhAuthPlugin {
  /**
   * Sign in with Google using native iOS UI
   * Returns ID token + access token for Firebase credential exchange
   */
  signIn(): Promise<{
    idToken: string;
    accessToken: string;
    user: AuthUser;
  }>;

  /**
   * Sign out from Google (clears tokens from Keychain)
   */
  signOut(): Promise<void>;

  /**
   * Get cached ID token (from memory or Keychain)
   */
  getIdToken(): Promise<{ idToken: string | null }>;

  /**
   * Get currently signed-in user
   */
  getCurrentUser(): Promise<{ user: AuthUser | null }>;

  /**
   * Check if user is signed in
   */
  isSignedIn(): Promise<{ signedIn: boolean }>;
}

export const HushhAuth = registerPlugin<HushhAuthPlugin>("HushhAuth", {
  web: () => import("./plugins/auth-web").then((m) => new m.HushhAuthWeb()),
});

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

  // ==================== Backend API Methods ====================

  /**
   * Issue VAULT_OWNER consent token for authenticated user.
   *
   * Called after vault unlock. Verifies Firebase ID token and issues
   * the master VAULT_OWNER scope token for accessing own vault data.
   *
   * Platform routing:
   * - iOS/Android: Native HTTP call to /api/consent/vault-owner-token
   * - Web: Proxies through Next.js API route (not typically called directly)
   */
  issueVaultOwnerToken(options: {
    userId: string;
    authToken: string; // Firebase ID token
  }): Promise<{
    token: string;
    expiresAt: number;
    scope: string;
  }>;

  getPending(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ consents: any[] }>;

  getActive(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ consents: any[] }>;

  getHistory(options: {
    userId: string;
    authToken?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[] }>;

  approve(options: {
    requestId: string;
    userId?: string;
    encryptedData?: string;
    encryptedIv?: string;
    encryptedTag?: string;
    exportKey?: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  deny(options: {
    requestId: string;
    userId: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  cancel(options: {
    requestId: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  revokeConsent(options: {
    userId: string;
    scope: string;
    authToken?: string;
  }): Promise<{ success: boolean; lockVault?: boolean }>;
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
  hasVault(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ exists: boolean }>;

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

  /**
   * Get Food Preferences from Cloud DB
   * Replaces: /api/vault/food on iOS
   * Requires: VAULT_OWNER token for consent-first architecture
   */
  getFoodPreferences(options: {
    userId: string;
    vaultOwnerToken: string;
    authToken?: string;
  }): Promise<{
    domain: string;
    preferences: Record<string, EncryptedPayload> | null;
  }>;

  /**
   * Get Professional Data from Cloud DB
   * Replaces: /api/vault/professional on iOS
   * Requires: VAULT_OWNER token for consent-first architecture
   */
  getProfessionalData(options: {
    userId: string;
    vaultOwnerToken: string;
    authToken?: string;
  }): Promise<{
    domain: string;
    preferences: Record<string, EncryptedPayload> | null;
  }>;

  // Consents (New)
  /**
   * Store a single encrypted preference field to the Cloud DB.
   * Native method mapping to /db/$domain/store
   */
  storePreferencesToCloud(options: {
    userId: string;
    domain: string;
    fieldName: string;
    ciphertext: string;
    iv: string;
    tag: string;
    consentToken: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  getPendingConsents(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ pending: any[] }>;

  getActiveConsents(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ active: any[] }>;

  getConsentHistory(options: {
    userId: string;
    authToken?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[] }>;
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
  updateSettings(
    options: Partial<HushhSettingsData>
  ): Promise<{ success: boolean }>;
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
  push(options?: {
    authToken?: string;
  }): Promise<{ success: boolean; pushedRecords: number }>;

  /**
   * Pull remote changes to local
   */
  pull(options?: {
    authToken?: string;
  }): Promise<{ success: boolean; pulledRecords: number }>;

  /**
   * Sync a specific user's vault
   */
  syncVault(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;

  /**
   * Get current sync status
   */
  getSyncStatus(): Promise<SyncStatus>;
}

export const HushhSync = registerPlugin<HushhSyncPlugin>("HushhSync", {
  web: () => import("./plugins/sync-web").then((m) => new m.HushhSyncWeb()),
});

// ==================== HushhIdentityPlugin ====================
// Investor identity detection and confirmation for Kai onboarding
// Separate modular plugin for identity resolution

export interface InvestorMatch {
  id: number;
  name: string;
  firm: string | null;
  title: string | null;
  aum_billions: number | null;
  investment_style: string[] | null;
  top_holdings: any[] | null;
  confidence: number;
}

export interface InvestorProfile {
  id: number;
  name: string;
  cik: string | null;
  firm: string | null;
  title: string | null;
  investor_type: string | null;
  photo_url: string | null;
  aum_billions: number | null;
  top_holdings: any[] | null;
  sector_exposure: Record<string, number> | null;
  investment_style: string[] | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  portfolio_turnover: string | null;
  recent_buys: string[] | null;
  recent_sells: string[] | null;
  public_quotes: any[] | null;
  biography: string | null;
  education: string[] | null;
  board_memberships: string[] | null;
  peer_investors: string[] | null;
  is_insider: boolean;
  insider_company_ticker: string | null;
}

export interface IdentityStatusResult {
  has_confirmed_identity: boolean;
  confirmed_at: string | null;
  investor_name: string | null;
  investor_firm: string | null;
}

export interface HushhIdentityPlugin {
  /**
   * Auto-detect investor from Firebase displayName.
   * Calls /api/identity/auto-detect on backend.
   */
  autoDetect(options: { authToken: string }): Promise<{
    detected: boolean;
    display_name: string | null;
    matches: InvestorMatch[];
  }>;

  /**
   * Search investor profiles by name (public endpoint).
   * Calls /api/investors/search on backend.
   */
  searchInvestors(options: {
    name: string;
    limit?: number;
  }): Promise<{ investors: InvestorMatch[] }>;

  /**
   * Get full investor profile by ID (public endpoint).
   * Calls /api/investors/{id} on backend.
   */
  getInvestor(options: { id: number }): Promise<InvestorProfile>;

  /**
   * Confirm identity and save encrypted profile to vault.
   * Requires VAULT_OWNER token.
   * Calls /api/identity/confirm on backend.
   */
  confirmIdentity(options: {
    investorId: number;
    profileDataCiphertext: string;
    profileDataIv: string;
    profileDataTag: string;
    vaultOwnerToken: string;
  }): Promise<{ success: boolean; message: string }>;

  /**
   * Get identity status (has user confirmed identity?).
   * Requires VAULT_OWNER token.
   * Calls /api/identity/status on backend.
   */
  getIdentityStatus(options: {
    vaultOwnerToken: string;
  }): Promise<IdentityStatusResult>;

  /**
   * Get encrypted investor profile (ciphertext).
   * Requires VAULT_OWNER token.
   * Calls POST /api/identity/profile on backend.
   */
  getEncryptedProfile(options: {
    vaultOwnerToken: string;
  }): Promise<{ profile_data: { ciphertext: string; iv: string; tag: string } }>;

  /**
   * Reset/delete confirmed identity.
   * Requires VAULT_OWNER token.
   * Calls DELETE /api/identity/profile on backend.
   */
  resetIdentity(options: {
    vaultOwnerToken: string;
  }): Promise<{ success: boolean }>;
}

export const HushhIdentity = registerPlugin<HushhIdentityPlugin>(
  "HushhIdentity",
  {
    web: () =>
      import("./plugins/identity-web").then((m) => new m.HushhIdentityWeb()),
  }
);

// ==================== Export all ====================

export * from "./types";
