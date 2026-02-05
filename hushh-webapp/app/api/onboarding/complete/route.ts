// app/api/onboarding/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

export const dynamic = "force-dynamic";
const PYTHON_API_URL = getPythonApiUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const firebaseAuthHeader = request.headers.get("authorization");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const response = await fetch(`${PYTHON_API_URL}/api/onboarding/complete`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(firebaseAuthHeader ? { Authorization: firebaseAuthHeader } : {})
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API Proxy] Onboarding complete error:", response.status, errorText);
      return NextResponse.json({ error: "Backend error", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API Proxy] Onboarding complete fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
