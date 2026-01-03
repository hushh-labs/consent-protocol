// app/api/vault/get/route.ts

/**
 * Get Vault Key Metadata API
 *
 * SYMMETRIC WITH NATIVE:
 * This route proxies to Python backend /db/vault/get
 * to maintain consistency with iOS/Android native plugins.
 *
 * Native (Swift/Kotlin): POST /db/vault/get → Python
 * Web (Next.js): GET /api/vault/get → Python (proxy)
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

export const dynamic = "force-dynamic";

// Python backend URL (same as native apps use)
const PYTHON_API_URL =
  process.env.PYTHON_API_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // =========================================================================
  // FIREBASE AUTH: Identity verification required
  // =========================================================================
  const authHeader = request.headers.get("Authorization");

  if (!authHeader && !isDevelopment()) {
    logSecurityEvent("VAULT_KEY_REJECTED", {
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
      logSecurityEvent("VAULT_KEY_REJECTED", {
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
  // PROXY TO PYTHON BACKEND (Same as native iOS/Android)
  // =========================================================================
  try {
    const response = await fetch(`${PYTHON_API_URL}/db/vault/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ userId }),
    });

    if (response.status === 404) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Python backend error:", response.status, errorText);
      return NextResponse.json(
        { error: "Backend error" },
        { status: response.status }
      );
    }

    const vault = await response.json();

    logSecurityEvent("VAULT_KEY_SUCCESS", { userId });
    return NextResponse.json(vault);
  } catch (error) {
    console.error("[API] Vault get error:", error);
    return NextResponse.json({ error: "Failed to get vault" }, { status: 500 });
  }
}
