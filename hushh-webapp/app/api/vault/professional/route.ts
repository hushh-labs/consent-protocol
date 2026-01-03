// app/api/vault/professional/route.ts

/**
 * Professional Domain Vault API - Symmetric with Native
 *
 * Native Swift: POST /db/professional/get with {userId} body, optional authToken header
 * Web Next.js: GET /api/vault/professional → proxies to Python /db/professional/get
 *
 * Auth is handled by Python backend, not here (matches native).
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Python backend URL (same as native apps use)
const PYTHON_API_URL =
  process.env.PYTHON_API_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

// ============================================================================
// GET: Read professional data (proxies to Python /db/professional/get)
// Matches Swift: fetchDomainData(domain: "professional", call: call)
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const authHeader = request.headers.get("Authorization");

  // =========================================================================
  // PROXY TO PYTHON BACKEND (Same as native iOS/Android)
  // Swift calls: performRequest(urlStr: "\(backendUrl)/db/professional/get", body: ["userId": userId])
  // =========================================================================
  try {
    const response = await fetch(`${PYTHON_API_URL}/db/professional/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ userId }),
    });

    // Swift returns: ["domain": domain, "preferences": json["preferences"] ?? NSNull()]
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Professional fetch error:", error);
    return NextResponse.json(
      { domain: "professional", preferences: null },
      { status: 200 }
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

    const response = await fetch(`${PYTHON_API_URL}/db/professional/store`, {
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
