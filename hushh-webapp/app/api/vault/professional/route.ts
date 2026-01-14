// app/api/vault/professional/route.ts

/**
 * Professional Domain Vault API - Consent-First Architecture
 *
 * All endpoints require VAULT_OWNER token for data access.
 * Matches native plugin routing (iOS/Android).
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

export const dynamic = "force-dynamic";

// Python backend URL (same as native apps use)
const PYTHON_API_URL = getPythonApiUrl();

// ============================================================================
// GET: Read professional data with VAULT_OWNER token
// Route: /api/vault/professional/preferences?userId=xxx&consentToken=xxx
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const consentToken = searchParams.get("consentToken");

  if (!userId || !consentToken) {
    return NextResponse.json(
      { error: "userId and consentToken are required" },
      { status: 400 }
    );
  }

  try {
    // Proxy to Python backend with token for validation (note: /api/professional, not /api/vault/professional)
    const response = await fetch(`${PYTHON_API_URL}/api/professional/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, consentToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Python backend error:", response.status, errorText);
      return NextResponse.json(
        { error: "Backend error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Professional data fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Write professional data (proxies to Python /db/professional/store)
// Matches Swift: storePreferencesToCloud
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fieldName, ciphertext, iv, tag, consentToken } = body;

    if (!userId || !fieldName || !ciphertext || !iv || !tag) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");

    const response = await fetch(`${PYTHON_API_URL}/api/professional/preferences/store`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        userId,
        fieldName,
        ciphertext,
        iv,
        tag,
        consentToken,
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

    return NextResponse.json({
      success: true,
      domain: "professional",
      field: fieldName,
    });
  } catch (error) {
    console.error("Professional vault error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
