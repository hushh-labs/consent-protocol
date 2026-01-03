// lib/config.ts

/**
 * Environment Configuration
 *
 * ENVIRONMENT_MODE controls consent validation behavior:
 * - "development": Auto-grant consent for smoother testing
 * - "production": Full consent validation required
 *
 * Matches consent-protocol MCP server PRODUCTION_MODE pattern.
 */

export const ENVIRONMENT_MODE =
  process.env.ENVIRONMENT_MODE || process.env.NODE_ENV || "production";

export const isDevelopment = () => ENVIRONMENT_MODE === "development";
export const isProduction = () => ENVIRONMENT_MODE === "production";

// Backend URL for Python consent-protocol server
export const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

// Frontend URL
export const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

// ============================================================================
// SECURITY EVENT TYPES
// ============================================================================

/**
 * Security event types for audit logging.
 */
export type SecurityEventType =
  // Token validation events
  | "TOKEN_VALID"
  | "TOKEN_INVALID"
  | "TOKEN_VALIDATION_FAILED"
  | "TOKEN_VALIDATION_ERROR"
  | "SCOPE_MISMATCH"
  // Firebase auth events
  | "FIREBASE_TOKEN_VALID"
  | "FIREBASE_TOKEN_INVALID"
  | "FIREBASE_VALIDATION_ERROR"
  // Vault events
  | "VAULT_READ_REJECTED"
  | "VAULT_READ_SUCCESS"
  | "VAULT_WRITE_REJECTED"
  | "VAULT_WRITE_SUCCESS"
  | "VAULT_KEY_REJECTED"
  | "VAULT_KEY_SUCCESS"
  | "VAULT_CHECK_REJECTED"
  | "VAULT_CHECK_SUCCESS"
  | "VAULT_SETUP_SUCCESS"
  | "PREFERENCES_READ_REJECTED"
  | "PREFERENCES_READ_SUCCESS"
  // Consent events
  | "CONSENT_VERIFIED"
  | "CONSENT_REQUIRED"
  | "CONSENT_INVALID"
  // User events
  | "USER_MISMATCH"
  // Chat/Agent events
  | "CHAT_REJECTED"
  | "RECOMMEND_REJECTED"
  | "RECOMMEND_SUCCESS"
  // Development mode
  | "DEV_AUTO_GRANT"
  | "DEV_FIREBASE_BYPASS";

/**
 * Security event details payload.
 */
export interface SecurityEventDetails {
  userId?: string;
  agentId?: string;
  scope?: string;
  reason?: string;
  error?: string;
  domain?: string;
  field?: string;
  status?: number;
  expected?: string;
  actual?: string;
  exists?: boolean;
  count?: number;
  [key: string]: unknown;
}

/**
 * Log a security event with structured data.
 */
export function logSecurityEvent(
  event: SecurityEventType,
  details: SecurityEventDetails
) {
  const timestamp = new Date().toISOString();
  const mode = ENVIRONMENT_MODE;
  console.log(
    `[SECURITY ${mode.toUpperCase()}] ${timestamp} - ${event}`,
    details
  );
}
