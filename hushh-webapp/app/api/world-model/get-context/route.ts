/**
 * World Model Context Proxy
 *
 * Forwards POST /api/world-model/get-context to Python backend
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getPythonApiUrl } from "@/app/api/_utils/backend";

/**
 * Get Stock Context Endpoint
 *
 * Retrieves user's context for stock analysis:
 * - Holdings matching the ticker symbol
 * - Recent decisions for the ticker
 * - Portfolio allocation percentages
 * 
 * NOTE: user_id is extracted from VAULT_OWNER token (validated by backend middleware).
 * The frontend no longer sends user_id in the request body.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const consentToken = request.headers.get("authorization")?.replace("Bearer ", "") || "";

  // Validate ticker is present
  if (!body.ticker) {
    return NextResponse.json(
      { error: "Missing required fields", details: "ticker is required" },
      { status: 400 }
    );
  }

  const url = `${getPythonApiUrl()}/api/world-model/get-context`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${consentToken}`,
      },
      body: JSON.stringify({
        ticker: body.ticker.toUpperCase(),
        // user_id is no longer sent - extracted from token by backend
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[World Model Context] Error calling backend: ${response.status}`, data);
      
      // Return error from backend with proper status code
      return NextResponse.json(data, { 
        status: response.status,
        statusText: response.statusText 
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[World Model Context] Internal Error:`, error);
    
    // Handle network errors and other exceptions
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Internal Proxy Error", 
        details: errorMessage,
        hint: "Check if Python backend is running" 
      },
      { status: 502 }
    );
  }
}