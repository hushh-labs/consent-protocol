// app/api/consent/history/route.ts

/**
 * Consent History API
 *
 * Returns paginated consent audit history for the archived/logs tab.
 *
 * SECURITY: Requires VAULT_OWNER token per BYOK authorization model.
 * The backend validates the token and ensures user_id matches.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

export const dynamic = "force-dynamic";

const BACKEND_URL = getPythonApiUrl();

export async function GET(request: NextRequest) {
  try {
    // BYOK Authorization: Require VAULT_OWNER token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization header with VAULT_OWNER token required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log(
      `[API] Fetching consent history for user: ${userId}, page: ${page}`
    );

    // Forward Authorization header to backend for token validation
    // Backend validates VAULT_OWNER token and checks user_id match
    const response = await fetch(
      `${BACKEND_URL}/api/consent/history?userId=${userId}&page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[API] Backend error:", error);
      return NextResponse.json(
        { error: "Failed to fetch consent history" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] History error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
