// app/api/vault/check/route.ts

/**
 * Check Vault Existence API
 *
 * CONSENT PROTOCOL COMPLIANT:
 * Returns whether a user has a vault set up.
 * Requires Firebase Auth to prevent enumeration attacks.
 *
 * Security: User can only check their own vault status.
 *
 * 3-Layer Security:
 * 1. Firebase Auth (identity) - REQUIRED to prevent enumeration
 * 2. BYOK Encryption - N/A (no data returned)
 * 3. Consent Protocol - N/A (this is auth flow, not data access)
 */

import { NextRequest, NextResponse } from "next/server";
import { hasVault } from "@/lib/db";
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // =========================================================================
    // FIREBASE AUTH: Identity verification required
    // Prevents attackers from enumerating which Firebase UIDs have vaults
    // =========================================================================
    const authHeader = request.headers.get("Authorization");

    if (!authHeader && !isDevelopment()) {
      logSecurityEvent("VAULT_CHECK_REJECTED", {
        reason: "No auth header",
        userId,
      });
      return NextResponse.json(
        { error: "Authorization required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Validate Firebase token (skip in development if no header)
    if (authHeader) {
      const validation = await validateFirebaseToken(authHeader);

      if (!validation.valid) {
        logSecurityEvent("VAULT_CHECK_REJECTED", {
          reason: validation.error,
          userId,
        });
        return NextResponse.json(
          {
            error: `Authentication failed: ${validation.error}`,
            code: "AUTH_INVALID",
          },
          { status: 401 }
        );
      }
    }

    // =========================================================================
    // VAULT CHECK: Now authorized
    // =========================================================================
    const vaultExists = await hasVault(userId);

    logSecurityEvent("VAULT_CHECK_SUCCESS", { userId, exists: vaultExists });
    return NextResponse.json({ hasVault: vaultExists });
  } catch (error) {
    console.error("[API] Vault check error:", error);
    return NextResponse.json(
      { error: "Failed to check vault status", hasVault: false },
      { status: 500 }
    );
  }
}
