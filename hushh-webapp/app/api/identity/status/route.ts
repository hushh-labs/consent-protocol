import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Proxy for /api/identity/status and /api/identity/profile
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

    const response = await fetch(`${BACKEND_URL}/api/identity/status`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Identity Proxy] Status error:", error);
    return NextResponse.json(
      { error: "Failed to get identity status" },
      { status: 500 }
    );
  }
}

/**
 * Proxy for DELETE /api/identity/profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/identity/profile`, {
      method: "DELETE",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Identity Proxy] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to reset identity" },
      { status: 500 }
    );
  }
}
