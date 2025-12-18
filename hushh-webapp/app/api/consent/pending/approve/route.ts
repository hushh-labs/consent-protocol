// app/api/consent/pending/approve/route.ts

/**
 * Approve Pending Consent Request API (Zero-Knowledge)
 *
 * User approves a consent request. Browser decrypts data, re-encrypts with
 * export key, and sends encrypted payload. Server never sees plaintext.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      requestId,
      exportKey,
      encryptedData,
      encryptedIv,
      encryptedTag,
    } = body;

    if (!userId || !requestId) {
      return NextResponse.json(
        { error: "userId and requestId are required" },
        { status: 400 }
      );
    }

    console.log(`[API] User ${userId} approving consent request: ${requestId}`);
    console.log(`[API] Export data present: ${!!encryptedData}`);

    // Forward to FastAPI with encrypted export
    const response = await fetch(`${BACKEND_URL}/api/consent/pending/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        requestId,
        exportKey,
        encryptedData,
        encryptedIv,
        encryptedTag,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to approve consent" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API] Consent approved with token`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Approve consent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
