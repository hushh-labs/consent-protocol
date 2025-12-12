import { NextRequest, NextResponse } from "next/server";

// ADK Base URL (Cloud Run deployment)
const ADK_BASE_URL = "https://hushh-kai-demo-832747646411.us-central1.run.app";

// Agent mode to endpoint mapping
const MODE_ENDPOINTS: Record<string, string> = {
  optimizer: "/kai",
  curator: "/nav",
  professional: "/kushal",
  orchestrator: "/",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, mode = "orchestrator", sessionId } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get the appropriate endpoint for the mode
    const endpoint = MODE_ENDPOINTS[mode] || "/";
    const url = `${ADK_BASE_URL}${endpoint}`;

    console.log(`[ADK Chat] Mode: ${mode}, Endpoint: ${url}`);

    // Make request to ADK
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        message: message,
        session_id: sessionId || `session-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      console.error(`[ADK Chat] Error: ${response.status} ${response.statusText}`);
      
      // Return fallback response for error cases
      return NextResponse.json({
        response: `I'm having trouble connecting to the ${mode} service right now. Please try again in a moment.`,
        mode: mode,
        error: true,
        dataUsed: [],
      });
    }

    // Parse the response
    const data = await response.json();

    // Extract the response text (ADK returns different formats)
    let responseText = "";
    if (typeof data === "string") {
      responseText = data;
    } else if (data.response) {
      responseText = data.response;
    } else if (data.content) {
      responseText = data.content;
    } else if (data.text) {
      responseText = data.text;
    } else {
      responseText = JSON.stringify(data);
    }

    // Determine what data was used based on the response content
    const dataUsed: string[] = [];
    const lowerResponse = responseText.toLowerCase();
    if (lowerResponse.includes("spending") || lowerResponse.includes("$") || lowerResponse.includes("budget")) {
      dataUsed.push("Financial");
    }
    if (lowerResponse.includes("calendar") || lowerResponse.includes("meeting") || lowerResponse.includes("schedule")) {
      dataUsed.push("Calendar");
    }
    if (lowerResponse.includes("skill") || lowerResponse.includes("project") || lowerResponse.includes("experience")) {
      dataUsed.push("Professional");
    }
    if (lowerResponse.includes("health") || lowerResponse.includes("fitness") || lowerResponse.includes("sleep")) {
      dataUsed.push("Health");
    }
    if (lowerResponse.includes("prefer") || lowerResponse.includes("like") || lowerResponse.includes("style")) {
      dataUsed.push("Preferences");
    }

    return NextResponse.json({
      response: responseText,
      mode: mode,
      dataUsed: dataUsed,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("[ADK Chat] Exception:", error);
    
    return NextResponse.json({
      response: "I encountered an error processing your request. Please try again.",
      mode: "orchestrator",
      error: true,
      dataUsed: [],
    });
  }
}

// Health check
export async function GET() {
  try {
    // Check if ADK is reachable
    const response = await fetch(ADK_BASE_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    return NextResponse.json({
      status: "ok",
      adkReachable: response.ok,
      adkUrl: ADK_BASE_URL,
      modes: Object.keys(MODE_ENDPOINTS),
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      adkReachable: false,
      error: String(error),
    });
  }
}
