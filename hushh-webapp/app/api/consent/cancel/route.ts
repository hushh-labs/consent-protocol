// app/api/consent/cancel/route.ts

/**
 * Cancel Consent API
 *
 * Cancels a pending consent request when MCP disconnects or chat is interrupted.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

const BACKEND_URL = getPythonApiUrl();

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

    console.log(`[API] Cancelling consent request: ${requestId}`);

    const response = await fetch(`${BACKEND_URL}/api/consent/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, requestId }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to cancel consent" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Cancel consent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
