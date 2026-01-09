// app/api/consent/pending/deny/route.ts

/**
 * Deny Pending Consent Request API
 *
 * User denies a pending consent request from a developer.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, requestId } = body;

    if (!userId || !requestId) {
      return NextResponse.json(
        { error: "userId and requestId are required" },
        { status: 400 }
      );
    }

    console.log(`[API] User ${userId} denying consent request: ${requestId}`);

    const response = await fetch(
      `${BACKEND_URL}/api/consent/pending/deny?userId=${userId}&requestId=${requestId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to deny consent" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API] Consent denied: ${JSON.stringify(data)}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Deny consent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
