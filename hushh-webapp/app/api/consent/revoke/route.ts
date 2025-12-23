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

    console.log(`[API] Revoking consent for user: ${userId}, scope: ${scope}`);

    const backendUrl = `${BACKEND_URL}/api/consent/revoke`;
    console.log(`[API] Calling backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scope }),
    });

    const responseText = await response.text();
    console.log(`[API] Backend response status: ${response.status}`);
    console.log(`[API] Backend response body: ${responseText}`);

    if (!response.ok) {
      console.error("[API] Backend error:", responseText);
      return NextResponse.json(
        { error: responseText || "Failed to revoke consent" },
        { status: response.status }
      );
    }

    // Parse JSON response
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ status: "revoked", raw: responseText });
    }
  } catch (error) {
    console.error("[API] Revoke consent error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
