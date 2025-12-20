// app/api/vault/food/route.ts

/**
 * Food Domain Vault API
 *
 * CONSENT PROTOCOL COMPLIANT:
 * GET: Retrieve food preferences (requires session token)
 * POST: Store food preferences (requires consent token with vault.write.food scope)
 *
 * 3-Layer Security:
 * 1. Firebase Auth (identity) - handled by frontend session
 * 2. BYOK Encryption - data arrives pre-encrypted from client
 * 3. Consent Protocol - validated via Python backend
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllFoodData, storeFoodData } from "@/lib/db";
import {
  validateConsentToken,
  validateSessionToken,
  extractSessionToken,
  verifyUserMatch,
} from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

// ============================================================================
// GET: Read food preferences (requires session token)
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // =========================================================================
  // CONSENT PROTOCOL: Session token required for vault read
  // =========================================================================
  const sessionToken = extractSessionToken(request);

  if (!sessionToken && !isDevelopment()) {
    logSecurityEvent("VAULT_READ_REJECTED", {
      reason: "No session token",
      userId,
    });
    return NextResponse.json(
      {
        error: "Session token required for vault read",
        code: "SESSION_REQUIRED",
      },
      { status: 401 }
    );
  }

  // Validate session token (skip in development if no token)
  if (sessionToken) {
    const validation = await validateSessionToken(sessionToken);

    if (!validation.valid) {
      logSecurityEvent("VAULT_READ_REJECTED", {
        reason: validation.reason,
        userId,
      });
      return NextResponse.json(
        {
          error: `Session validation failed: ${validation.reason}`,
          code: "SESSION_INVALID",
        },
        { status: 403 }
      );
    }

    // Verify user match
    if (!verifyUserMatch(validation.userId, userId)) {
      return NextResponse.json(
        { error: "Session token user mismatch", code: "USER_MISMATCH" },
        { status: 403 }
      );
    }
  }

  // =========================================================================
  // VAULT READ: Now authorized
  // =========================================================================
  const data = await getAllFoodData(userId);

  if (!data) {
    return NextResponse.json(
      { error: "No food preferences found" },
      { status: 404 }
    );
  }

  logSecurityEvent("VAULT_READ_SUCCESS", { domain: "food", userId });
  return NextResponse.json({ domain: "food", preferences: data });
}

// ============================================================================
// POST: Write food preferences (requires consent token)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      fieldName,
      ciphertext,
      iv,
      tag,
      consentToken,
      consentTokenId,
    } = body;

    // Basic validation
    if (!userId || !fieldName || !ciphertext || !iv || !tag) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // =========================================================================
    // CONSENT PROTOCOL: Token required for vault write
    // =========================================================================
    if (!consentToken && !isDevelopment()) {
      logSecurityEvent("VAULT_WRITE_REJECTED", {
        reason: "No consent token",
        userId,
      });
      return NextResponse.json(
        {
          error: "Consent token required for vault write",
          code: "CONSENT_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Validate consent token
    if (consentToken) {
      const validation = await validateConsentToken(
        consentToken,
        "vault.write.food"
      );

      if (!validation.valid) {
        logSecurityEvent("VAULT_WRITE_REJECTED", {
          reason: validation.reason,
          userId,
        });
        return NextResponse.json(
          {
            error: `Consent validation failed: ${validation.reason}`,
            code: "CONSENT_INVALID",
          },
          { status: 403 }
        );
      }

      // Verify user match
      if (!verifyUserMatch(validation.userId, userId)) {
        return NextResponse.json(
          { error: "Consent token user mismatch", code: "USER_MISMATCH" },
          { status: 403 }
        );
      }

      logSecurityEvent("CONSENT_VERIFIED", {
        agent: validation.agentId,
        scope: validation.scope,
        userId,
      });
    }

    // =========================================================================
    // VAULT WRITE: Now authorized
    // Data is already encrypted (BYOK) - we just store ciphertext
    // =========================================================================
    await storeFoodData(userId, fieldName, ciphertext, iv, tag, consentTokenId);

    logSecurityEvent("VAULT_WRITE_SUCCESS", {
      domain: "food",
      field: fieldName,
      userId,
    });
    return NextResponse.json({
      success: true,
      domain: "food",
      field: fieldName,
    });
  } catch (error) {
    console.error("Food vault error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
