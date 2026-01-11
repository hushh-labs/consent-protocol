// app/api/agents/food-dining/chat/route.ts

/**
 * Food Agent Chat API Route
 *
 * Proxies chat requests to the Python food agent and manages session state.
 * Handles vault storage when conversation completes with consent.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

// Food Agent backend URL
const FOOD_AGENT_URL = process.env.FOOD_AGENT_URL || getPythonApiUrl();

interface ChatRequest {
  userId: string;
  message: string;
  sessionState?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { userId, message, sessionState } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 }
      );
    }

    // Call Python food agent
    const response = await fetch(
      `${FOOD_AGENT_URL}/api/agents/food-dining/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message,
          sessionState,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Food agent returned ${response.status}`);
    }

    const data = await response.json();

    // IMPORTANT: Do NOT store plaintext to vault from server routes.
    // The frontend must encrypt with BYOK and then perform a consented vault write.

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Food Agent Chat Error]", error);

    // Fallback: try direct agent call if backend is down
    return handleDirectAgentCall(req);
  }
}

/**
 * Fallback: Handle direct agent call when Python backend is unavailable
 */
async function handleDirectAgentCall(req: NextRequest) {
  try {
    const body = await req.json();

    // Simple fallback response
    return NextResponse.json({
      response:
        "The Food Agent service is currently unavailable. Please ensure the Python backend is running on port 8000.",
      sessionState: { step: "error" },
      collectedData: {},
      isComplete: false,
      needsConsent: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
