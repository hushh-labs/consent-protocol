// hushh-webapp/app/api/world-model/[...path]/route.ts
/**
 * World Model API Proxy
 * 
 * Proxies requests to the Python backend for world model operations.
 * Supports GET, POST, DELETE methods.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/world-model/${path}${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("World model proxy GET error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join("/");
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/world-model/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("Authorization") || "",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("World model proxy POST error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join("/");

    const response = await fetch(`${BACKEND_URL}/api/world-model/${path}`, {
      method: "DELETE",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("World model proxy DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join("/");
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/world-model/${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("Authorization") || "",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("World model proxy PUT error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 }
    );
  }
}
