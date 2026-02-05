// app/api/onboarding/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

export const dynamic = "force-dynamic";
const PYTHON_API_URL = getPythonApiUrl();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const firebaseAuthHeader = request.headers.get("authorization");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const url = `${PYTHON_API_URL}/api/onboarding/status?userId=${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        ...(firebaseAuthHeader ? { Authorization: firebaseAuthHeader } : {})
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API Proxy] Onboarding status error:", response.status, errorText);
      return NextResponse.json({ error: "Backend error", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API Proxy] Onboarding status fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
