import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

/**
 * Proxy for /api/identity/profile
 * Refactored to POST for robust Body-based auth (matches Food/Finance agents)
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse body (expect consentToken)
    const body = await request.json();
    const { consent_token } = body;
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");

    if (!consent_token) {
      return NextResponse.json(
        { error: "Missing consent_token in body" },
        { status: 400 }
      );
    }

    const backendUrl = getPythonApiUrl();

    // 2. Call Backend with POST + Body
    const res = await fetch(`${backendUrl}/api/identity/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ consent_token }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Backend error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Identity Profile Proxy Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
