// hushh-webapp/app/api/world-model/metadata/[userId]/route.ts
/**
 * World Model Metadata API Proxy
 *
 * Dedicated route for fetching user's world model metadata.
 * Used by frontend to determine if user has existing data.
 *
 * This is a critical endpoint for the Kai flow:
 * - Returns 404 for new users (no data) -> shows import prompt
 * - Returns metadata for existing users -> shows dashboard
 *
 * Production-grade with:
 * - Proper error handling
 * - Request timeout
 * - Detailed logging
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 10000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const startTime = Date.now();

  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate userId format (basic sanitization)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    // Forward authorization header if present
    const authHeader = request.headers.get("authorization");

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/world-model/metadata/${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Handle different response statuses
      if (response.status === 404) {
        // New user - no data found (expected case)
        return NextResponse.json(
          { error: "No world model data found for user" },
          { status: 404 }
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(
          `[world-model/metadata] Backend error for ${userId}: ${response.status} - ${errorText}`
        );
        return NextResponse.json(
          { error: `Backend returned ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();

      // Log successful request timing
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.warn(
          `[world-model/metadata] Slow request for ${userId}: ${duration}ms`
        );
      }

      return NextResponse.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(
          `[world-model/metadata] Request timeout for ${userId} after ${REQUEST_TIMEOUT}ms`
        );
        return NextResponse.json(
          { error: "Request timeout - backend did not respond in time" },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[world-model/metadata] Error after ${duration}ms:`,
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      { error: "Failed to fetch world model metadata" },
      { status: 500 }
    );
  }
}
