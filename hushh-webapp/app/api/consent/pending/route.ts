// app/api/consent/pending/route.ts

/**
 * Get Pending Consent Requests API
 *
 * Proxies to Python backend to get pending consent requests for a user.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log(`[API] Fetching pending consents for user: ${userId}`);

    const response = await fetch(
      `${BACKEND_URL}/api/consent/pending?userId=${userId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending consents" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Pending consents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
