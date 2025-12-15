// app/api/agent/recommend/route.ts

/**
 * Next.js API Route -> Python Agent Proxy
 *
 * This proxies requests from the dashboard to the Python FastAPI backend.
 */

import { NextRequest, NextResponse } from "next/server";

// Backend URL - use consistent env var pattern
const PYTHON_API_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("🔗 Proxying to Python agent...");

    const response = await fetch(
      `${PYTHON_API_URL}/api/agents/food-dining/recommend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || "Agent request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`✅ Got ${data.recommendations.length} recommendations`);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ Agent proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect to agent" },
      { status: 500 }
    );
  }
}
