import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getPythonApiUrl } from "@/app/api/_utils/backend";

/**
 * Kai Catch-All Proxy
 *
 * Forwards all requests from /api/kai/* to the Python backend.
 * Supports:
 * - JSON requests (chat, analyze, etc.)
 * - Multipart form data (portfolio import)
 * - SSE streaming (analysis stream)
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
  // Forward query string to backend
  const queryString = request.nextUrl.search;
  const url = `${getPythonApiUrl()}/api/kai/${path}${queryString}`;

  // Debug: Check if Authorization header is present
  const authHeader = request.headers.get("authorization");
  const contentType = request.headers.get("content-type") || "";
  console.log(`[Kai API] Proxying ${request.method} ${path}`);
  console.log(`[Kai API] Authorization header present: ${!!authHeader}`);
  console.log(`[Kai API] Content-Type: ${contentType}`);

  try {
    const headers = new Headers();
    
    // Copy authorization header
    if (authHeader) {
      headers.set("Authorization", authHeader);
    }

    let body: BodyInit | undefined;
    
    // Handle different content types
    if (request.method === "GET" || request.method === "DELETE") {
      body = undefined;
    } else if (contentType.includes("multipart/form-data")) {
      // For file uploads, pass through the FormData
      // Don't set Content-Type - let fetch set it with boundary
      const formData = await request.formData();
      body = formData;
      console.log(`[Kai API] Forwarding multipart form data`);
    } else {
      // For JSON requests
      headers.set("Content-Type", "application/json");
      body = await request.text();
    }

    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: body,
    });

    // Check for SSE stream response
    const responseContentType = response.headers.get("content-type");
    if (responseContentType?.includes("text/event-stream")) {
      console.log(`[Kai API] SSE stream detected, passing through`);
      // Return SSE stream directly without parsing
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Content-Encoding": "none",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[Kai API] Error calling ${url}: ${response.status}`, data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Kai API] Internal Error proxying to ${url}:`, error);
    return NextResponse.json(
      { error: "Internal Proxy Error", details: String(error) },
      { status: 500 }
    );
  }
}
