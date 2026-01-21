import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getPythonApiUrl } from "@/app/api/_utils/backend";

/**
 * Kai Catch-All Proxy
 *
 * Forwards all requests from /api/kai/* to the Python backend.
 * Matches the architecture of /api/vault/food.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  return proxyRequest(request, params);
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  return proxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  return proxyRequest(request, params);
}

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const url = `${getPythonApiUrl()}/api/kai/${path}`;

  // Debug: Check if Authorization header is present
  const authHeader = request.headers.get("authorization");
  console.log(`[Kai API] Proxying ${request.method} ${path}`);
  console.log(`[Kai API] Authorization header present: ${!!authHeader}`);
  if (authHeader) {
    console.log(`[Kai API] Auth header prefix: ${authHeader.substring(0, 30)}...`);
  }

  try {
    const headers = new Headers(request.headers);
    // Remove host header to avoid confusion
    headers.delete("host");

    const body =
      request.method !== "GET" && request.method !== "DELETE"
        ? await request.text()
        : undefined;

    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: body,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[Kai API] Error calling ${url}: ${response.status}`);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Kai API] Internal Error proxying to ${url}:`, error);
    return NextResponse.json(
      { error: "Internal Proxy Error" },
      { status: 500 }
    );
  }
}
