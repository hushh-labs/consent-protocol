import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Proxy for /api/identity/auto-detect
 * Forwards Firebase token to backend for investor detection
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/identity/auto-detect`, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Identity Proxy] Auto-detect error:", error);
    return NextResponse.json(
      { error: "Failed to detect identity" },
      { status: 500 }
    );
  }
}
