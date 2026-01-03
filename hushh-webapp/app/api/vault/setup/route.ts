// app/api/vault/setup/route.ts

/**
 * Vault Setup API
 *
 * SYMMETRIC WITH NATIVE:
 * This route proxies to Python backend /db/vault/setup
 * to maintain consistency with iOS/Android native plugins.
 *
 * Native (Swift/Kotlin): POST /db/vault/setup → Python
 * Web (Next.js): POST /api/vault/setup → Python (proxy)
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

export const dynamic = "force-dynamic";

// Python backend URL (same as native apps use)
const PYTHON_API_URL =
  process.env.PYTHON_API_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      authMethod,
      encryptedVaultKey,
      salt,
      iv,
      recoveryEncryptedVaultKey,
      recoverySalt,
      recoveryIv,
    } = body;

    if (
      !userId ||
      !authMethod ||
      !encryptedVaultKey ||
      !salt ||
      !iv ||
      !recoveryEncryptedVaultKey ||
      !recoverySalt ||
      !recoveryIv
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // =========================================================================
    // FIREBASE AUTH (optional in dev)
    // =========================================================================
    const authHeader = request.headers.get("Authorization");

    if (authHeader) {
      const validation = await validateFirebaseToken(authHeader);
      if (!validation.valid && !isDevelopment()) {
        return NextResponse.json(
          { error: "Authentication failed", code: "AUTH_INVALID" },
          { status: 401 }
        );
      }
    }

    // =========================================================================
    // PROXY TO PYTHON BACKEND (Same as native iOS/Android)
    // =========================================================================
    const response = await fetch(`${PYTHON_API_URL}/db/vault/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        userId,
        authMethod,
        encryptedVaultKey,
        salt,
        iv,
        recoveryEncryptedVaultKey,
        recoverySalt,
        recoveryIv,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Python backend error:", response.status, errorText);
      return NextResponse.json(
        { error: "Backend error" },
        { status: response.status }
      );
    }

    const result = await response.json();

    logSecurityEvent("VAULT_SETUP_SUCCESS", { userId, authMethod });
    console.log(`✅ Vault setup for user: ${userId} (${authMethod})`);

    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error("Vault setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
