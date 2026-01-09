// app/api/agents/food-dining/chat/route.ts

/**
 * Food Agent Chat API Route
 *
 * Proxies chat requests to the Python food agent and manages session state.
 * Handles vault storage when conversation completes with consent.
 */

import { NextRequest, NextResponse } from "next/server";
import { storeUserData } from "@/lib/db";

// Food Agent backend URL
const FOOD_AGENT_URL =
  process.env.FOOD_AGENT_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

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

    // If conversation is complete and user consented, store to vault
    if (data.isComplete && data.collectedData) {
      await storePreferencesToVault(userId, data.collectedData);
      console.log(`✅ Stored preferences for user: ${userId}`);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Food Agent Chat Error]", error);

    // Fallback: try direct agent call if backend is down
    return handleDirectAgentCall(req);
  }
}

/**
 * Store collected preferences to vault
 */
async function storePreferencesToVault(
  userId: string,
  data: Record<string, unknown>
) {
  // For now, store as plaintext JSON (encryption happens in vault layer)
  // In production, this would use consent tokens and encryption

  if (data.dietary_restrictions) {
    await storeUserData(
      userId,
      "food.dietary_restrictions",
      JSON.stringify(data.dietary_restrictions),
      "", // iv - to be generated
      "" // tag - to be generated
    );
  }

  if (data.cuisine_preferences) {
    await storeUserData(
      userId,
      "food.cuisine_preferences",
      JSON.stringify(data.cuisine_preferences),
      "",
      ""
    );
  }

  if (data.monthly_budget) {
    await storeUserData(
      userId,
      "food.monthly_budget",
      JSON.stringify(data.monthly_budget),
      "",
      ""
    );
  }

  // Store any custom/other fields with dynamic scopes
  if (data.custom && typeof data.custom === "object") {
    for (const [key, value] of Object.entries(
      data.custom as Record<string, unknown>
    )) {
      await storeUserData(
        userId,
        `food.custom.${key}`,
        JSON.stringify(value),
        "",
        ""
      );
    }
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
