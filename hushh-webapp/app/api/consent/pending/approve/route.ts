// app/api/consent/pending/approve/route.ts

/**
 * Approve Pending Consent Request API
 *
 * User approves a pending consent request from a developer.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

    console.log(`[API] User ${userId} approving consent request: ${requestId}`);

    const response = await fetch(
      `${BACKEND_URL}/api/consent/pending/approve?userId=${userId}&requestId=${requestId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to approve consent" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API] Consent approved: ${JSON.stringify(data)}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Approve consent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
