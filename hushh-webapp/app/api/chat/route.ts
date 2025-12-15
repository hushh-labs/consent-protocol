// app/api/chat/route.ts

/**
 * Unified Chat API Route
 *
 * ALL chat traffic goes through here → Orchestrator → Domain Agents
 *
 * Flow:
 * 1. User message → Orchestrator (10003)
 * 2. Orchestrator classifies intent → returns delegation info
 * 3. If delegated → follow up with domain agent
 * 4. Return consolidated response
 */

import { NextRequest, NextResponse } from "next/server";

// Agent Port Mapping - Keep in sync with consent-protocol/hushh_mcp/constants.py AGENT_PORTS
const PORT_MAP: Record<string, number> = {
  agent_orchestrator: 10000,
  agent_food_dining: 10001,
  agent_professional_profile: 10002,
  agent_identity: 10003,
  agent_shopper: 10004,
  // Future agents (placeholders)
  agent_finance: 10005,
  agent_health_wellness: 10006,
  agent_travel: 10007,
};

// Backend URL - use server-side env var or fallback to client-side or localhost
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";
console.log(`[API] Using BACKEND_URL: ${BACKEND_URL}`);

interface ChatRequest {
  message: string;
  userId?: string;
  sessionState?: Record<string, unknown>;
  agentId?: string; // Optional: for explicit routing (bypass orchestrator)
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, userId, sessionState, agentId } = body;

    // Validate userId is provided - must come from authenticated frontend
    if (!userId) {
      console.error("[API] No userId provided - authentication required");
      return NextResponse.json(
        { content: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    // If explicit agentId provided and it's a domain agent with active session,
    // continue that conversation
    if (agentId && agentId !== "agent_orchestrator" && sessionState?.step) {
      return handleDomainAgentChat(agentId, message, userId, sessionState);
    }

    // Default: Route through Orchestrator
    console.log(`[API] Routing to Orchestrator: "${message.slice(0, 50)}..."`);

    const orchestratorResponse = await callOrchestrator(message, userId);

    // Check if orchestrator delegated to a domain agent
    if (orchestratorResponse.delegation) {
      const { target_agent, target_port } = orchestratorResponse.delegation;

      console.log(
        `[API] Orchestrator delegated to ${target_agent} (port ${target_port})`
      );

      // For food agent, start the conversational flow
      if (target_agent === "agent_food_dining") {
        const foodResponse = await callFoodAgentChat(message, userId, null);
        return NextResponse.json({
          content: foodResponse.response,
          delegation: orchestratorResponse.delegation,
          sessionState: foodResponse.sessionState,
          agentId: "agent_food_dining",
          needsConsent: foodResponse.needsConsent || false,
          isComplete: foodResponse.isComplete || false,
          ui_type: foodResponse.ui_type || null,
          options: foodResponse.options || null,
          allow_custom: foodResponse.allow_custom,
          allow_none: foodResponse.allow_none,
          // CONSENT PROTOCOL: Pass through consent token
          consent_token: foodResponse.consent_token,
          consent_issued_at: foodResponse.consent_issued_at,
          consent_expires_at: foodResponse.consent_expires_at,
        });
      }

      // For professional profile agent
      if (target_agent === "agent_professional_profile") {
        const profResponse = await callProfessionalAgentChat(
          message,
          userId,
          null
        );
        return NextResponse.json({
          content: profResponse.response,
          delegation: orchestratorResponse.delegation,
          sessionState: profResponse.sessionState,
          agentId: "agent_professional_profile",
          needsConsent: profResponse.needsConsent || false,
          isComplete: profResponse.isComplete || false,
          ui_type: profResponse.ui_type || null,
          options: profResponse.options || null,
          allow_custom: profResponse.allow_custom,
          allow_none: profResponse.allow_none,
          // CONSENT PROTOCOL: Pass through consent token
          consent_token: profResponse.consent_token,
          consent_issued_at: profResponse.consent_issued_at,
          consent_expires_at: profResponse.consent_expires_at,
        });
      }

      // For other agents, return delegation info (frontend can follow up)
      return NextResponse.json({
        content: orchestratorResponse.response,
        delegation: orchestratorResponse.delegation,
        agentId: target_agent,
      });
    }

    // No delegation - orchestrator handled directly
    return NextResponse.json({
      content: orchestratorResponse.response,
      delegation: null,
      agentId: "agent_orchestrator",
    });
  } catch (error) {
    console.error("[API Error]", error);
    return NextResponse.json(
      {
        content:
          "Error: Could not connect to the agent. Is the Python service running?",
      },
      { status: 500 }
    );
  }
}

/**
 * Call the Orchestrator agent
 */
async function callOrchestrator(message: string, userId: string) {
  try {
    // Try Python orchestrator - use BACKEND_URL for cloud compatibility
    const response = await fetch(`${BACKEND_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: message, user_id: userId }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log("[API] Orchestrator not running, using fallback");
  }

  // Fallback: Use intent classification directly
  return fallbackIntentClassification(message);
}

/**
 * Fallback intent classification when Python orchestrator is unavailable
 */
function fallbackIntentClassification(message: string) {
  const msg = message.toLowerCase();

  // Simple keyword matching
  if (
    msg.includes("food") ||
    msg.includes("diet") ||
    msg.includes("restaurant") ||
    msg.includes("cuisine") ||
    msg.includes("eat") ||
    msg.includes("preference")
  ) {
    return {
      response: "I'll connect you to our Food & Dining specialist.",
      delegation: {
        target_agent: "agent_food_dining",
        target_port: 10001, // Matches AGENT_PORTS in constants.py
        domain: "food_dining",
      },
    };
  }

  if (
    msg.includes("resume") ||
    msg.includes("job") ||
    msg.includes("career") ||
    msg.includes("skill") ||
    msg.includes("professional")
  ) {
    return {
      response: "I'll connect you to our Professional Profile specialist.",
      delegation: {
        target_agent: "agent_professional_profile",
        target_port: 10002, // Matches AGENT_PORTS in constants.py
        domain: "professional",
      },
    };
  }

  // No specific domain detected
  return {
    response:
      "Hi! I can help you with:\n\n• 🍽️ Food & Dining preferences\n• 💼 Professional profile\n\nWhat would you like to set up?",
    delegation: null,
  };
}

/**
 * Call Food Agent Chat endpoint (conversational flow)
 */
async function callFoodAgentChat(
  message: string,
  userId: string,
  sessionState: Record<string, unknown> | null
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/agents/food-dining/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message, sessionState }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log("[API] Food agent not running");
  }

  return {
    response: "The Food Agent is being set up. Please try again in a moment.",
    sessionState: { step: "error" },
    needsConsent: false,
    isComplete: false,
  };
}

/**
 * Call Professional Profile Agent Chat endpoint (conversational flow)
 */
async function callProfessionalAgentChat(
  message: string,
  userId: string,
  sessionState: Record<string, unknown> | null
) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/agents/professional-profile/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message, sessionState }),
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log("[API] Professional agent not running");
  }

  return {
    response:
      "The Professional Profile Agent is being set up. Please try again in a moment.",
    sessionState: { step: "error" },
    needsConsent: false,
    isComplete: false,
  };
}

/**
 * Handle domain agent chat continuation
 */
async function handleDomainAgentChat(
  agentId: string,
  message: string,
  userId: string,
  sessionState: Record<string, unknown>
) {
  if (agentId === "agent_food_dining") {
    const response = await callFoodAgentChat(message, userId, sessionState);
    return NextResponse.json({
      content: response.response,
      sessionState: response.sessionState,
      agentId: "agent_food_dining",
      needsConsent: response.needsConsent || false,
      isComplete: response.isComplete || false,
      ui_type: response.ui_type || null,
      options: response.options || null,
      allow_custom: response.allow_custom,
      allow_none: response.allow_none,
      // CONSENT PROTOCOL: Pass through consent token
      consent_token: response.consent_token,
      consent_issued_at: response.consent_issued_at,
      consent_expires_at: response.consent_expires_at,
    });
  }

  // Professional profile agent
  if (agentId === "agent_professional_profile") {
    const response = await callProfessionalAgentChat(
      message,
      userId,
      sessionState
    );
    return NextResponse.json({
      content: response.response,
      sessionState: response.sessionState,
      agentId: "agent_professional_profile",
      needsConsent: response.needsConsent || false,
      isComplete: response.isComplete || false,
      ui_type: response.ui_type || null,
      options: response.options || null,
      allow_custom: response.allow_custom,
      allow_none: response.allow_none,
      // CONSENT PROTOCOL: Pass through consent token
      consent_token: response.consent_token,
      consent_issued_at: response.consent_issued_at,
      consent_expires_at: response.consent_expires_at,
    });
  }

  // Other domain agents - not yet implemented
  return NextResponse.json({
    content: "This agent is not yet available.",
    agentId,
  });
}
