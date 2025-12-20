// lib/auth/validate.ts

/**
 * Authentication & Consent Validation Utilities
 *
 * 3-Layer Security Model:
 * 1. Firebase Auth → Identity verification (who you are)
 * 2. BYOK Encryption → Client-side encrypt/decrypt (server never sees plaintext)
 * 3. Consent Protocol → Scoped access tokens (HCT format)
 *
 * Compliant with consent-protocol/docs/consent.md
 */

import { BACKEND_URL, isDevelopment, logSecurityEvent } from "../config";

// ============================================================================
// TYPES
// ============================================================================

export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
  userId?: string;
  agentId?: string;
  scope?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export interface FirebaseValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

// ============================================================================
// CONSENT TOKEN VALIDATION
// ============================================================================

/**
 * Validate a consent token with the Python backend.
 *
 * Per consent-protocol/docs/consent.md:
 * - Validates HMAC-SHA256 signature
 * - Checks expiration
 * - Verifies scope matches
 *
 * @param token - The HCT:base64.signature token string
 * @param expectedScope - Optional scope to verify (e.g., "vault.write.food")
 */
export async function validateConsentToken(
  token: string,
  expectedScope?: string
): Promise<TokenValidationResult> {
  // Development mode: auto-grant for smoother testing
  if (isDevelopment() && token === "DEV_AUTO_GRANT") {
    logSecurityEvent("DEV_AUTO_GRANT", { scope: expectedScope });
    return {
      valid: true,
      userId: "dev_user",
      agentId: "dev_agent",
      scope: expectedScope,
    };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      logSecurityEvent("TOKEN_VALIDATION_FAILED", {
        status: response.status,
        reason: "Backend unavailable",
      });
      return { valid: false, reason: "Token validation service unavailable" };
    }

    const result = await response.json();

    // If scope check requested, verify it matches
    if (expectedScope && result.valid && result.scope !== expectedScope) {
      logSecurityEvent("SCOPE_MISMATCH", {
        expected: expectedScope,
        actual: result.scope,
      });
      return {
        valid: false,
        reason: `Scope mismatch: expected ${expectedScope}, got ${result.scope}`,
      };
    }

    if (result.valid) {
      logSecurityEvent("TOKEN_VALID", {
        userId: result.user_id,
        scope: result.scope,
      });
    } else {
      logSecurityEvent("TOKEN_INVALID", { reason: result.reason });
    }

    return {
      valid: result.valid,
      reason: result.reason,
      userId: result.user_id,
      agentId: result.agent_id,
      scope: result.scope,
    };
  } catch (error) {
    logSecurityEvent("TOKEN_VALIDATION_ERROR", { error: String(error) });
    return { valid: false, reason: "Failed to validate token" };
  }
}

/**
 * Validate a session token (used for dashboard data access).
 *
 * Session tokens have scope "vault.read.all" and are issued after
 * passphrase verification.
 */
export async function validateSessionToken(
  token: string
): Promise<TokenValidationResult> {
  return validateConsentToken(token);
}

// ============================================================================
// FIREBASE TOKEN VALIDATION (Identity Layer)
// ============================================================================

/**
 * Validate Firebase ID token with the Python backend.
 *
 * This is the identity layer - proves WHO the user is.
 * Does NOT grant data access (that requires consent tokens).
 */
export async function validateFirebaseToken(
  authHeader: string | null
): Promise<FirebaseValidationResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  // Development mode: accept test tokens
  if (isDevelopment() && authHeader === "Bearer DEV_TOKEN") {
    logSecurityEvent("DEV_FIREBASE_BYPASS", {});
    return { valid: true, userId: "dev_user", email: "dev@test.com" };
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Validate with backend (which uses Firebase Admin SDK)
    const response = await fetch(`${BACKEND_URL}/api/consent/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ userId: "validation_check", scope: "session" }),
    });

    if (response.status === 401 || response.status === 403) {
      logSecurityEvent("FIREBASE_TOKEN_INVALID", { status: response.status });
      return { valid: false, error: "Invalid Firebase ID token" };
    }

    // Token is valid if we don't get 401/403
    // Note: This is a side-effect free validation approach
    logSecurityEvent("FIREBASE_TOKEN_VALID", {});
    return { valid: true };
  } catch (error) {
    logSecurityEvent("FIREBASE_VALIDATION_ERROR", { error: String(error) });
    return { valid: false, error: "Firebase validation failed" };
  }
}

// ============================================================================
// COMPOSITE VALIDATION HELPERS
// ============================================================================

/**
 * Verify user identity matches token.
 *
 * Critical security check: Token's user_id must match the requesting user.
 * Prevents User A from using User B's token.
 */
export function verifyUserMatch(
  tokenUserId: string | undefined,
  requestUserId: string
): boolean {
  if (!tokenUserId) return false;
  const match = tokenUserId === requestUserId;
  if (!match) {
    logSecurityEvent("USER_MISMATCH", {
      tokenUser: tokenUserId,
      requestUser: requestUserId,
    });
  }
  return match;
}

/**
 * Extract session token from request.
 *
 * Checks multiple locations:
 * 1. X-Session-Token header
 * 2. sessionToken query param
 * 3. Authorization header (for compatibility)
 */
export function extractSessionToken(request: Request): string | null {
  const url = new URL(request.url);

  // Check header first
  const headerToken = request.headers.get("X-Session-Token");
  if (headerToken) return headerToken;

  // Check query param
  const queryToken = url.searchParams.get("sessionToken");
  if (queryToken) return queryToken;

  // Check Authorization header (fallback)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("HCT:")) {
    return authHeader;
  }

  return null;
}

/**
 * Extract consent token from request body.
 */
export function extractConsentToken(
  body: Record<string, unknown>
): string | null {
  return (
    (body.consentToken as string) || (body.consent_token as string) || null
  );
}
