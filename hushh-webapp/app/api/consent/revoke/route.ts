// app/api/consent/revoke/route.ts

/**
 * Revoke Consent API
 *
 * Revokes an active consent token, removing access for the app.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, scope } = body;

    if (!userId || !scope) {
      return NextResponse.json(
        { error: "userId and scope are required" },
        { status: 400 }
      );
    }

    console.log(`[API] Revoking consent for scope: ${scope}`);

    const response = await fetch(`${BACKEND_URL}/api/consent/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scope }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to revoke consent" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Revoke consent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
