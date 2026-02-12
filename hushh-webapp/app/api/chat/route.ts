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
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

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

    // =========================================================================
    // FIREBASE AUTH: Verify identity before allowing chat
    // =========================================================================
    const authHeader = req.headers.get("Authorization");

    if (!authHeader && !isDevelopment()) {
      logSecurityEvent("CHAT_REJECTED", { reason: "No auth header", userId });
      return NextResponse.json(
        {
          content: "Authorization required. Please log in.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    if (authHeader) {
      const validation = await validateFirebaseToken(authHeader);
      if (!validation.valid) {
        logSecurityEvent("CHAT_REJECTED", { reason: validation.error, userId });
        return NextResponse.json(
          {
            content: `Authentication failed: ${validation.error}`,
            code: "AUTH_INVALID",
          },
          { status: 401 }
        );
      }
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
  } catch (_e) {
    console.log("[API] Orchestrator not running, using fallback");
  }

  // Fallback: Use intent classification directly
  return fallbackIntentClassification(message);
}

/**
 * Fallback intent classification when Python orchestrator is unavailable
 */
function fallbackIntentClassification(_message: string) {
  // No specific domain detected; use Kai or world-model flows
  return {
    response:
      "Hi! I can help with investment analysis (Kai) and world-model domains. What would you like to do?",
    delegation: null,
  };
}

/**
 * Handle domain agent chat continuation
 */
async function handleDomainAgentChat(
  agentId: string,
  _message: string,
  _userId: string,
  _sessionState: Record<string, unknown>
) {
  // Other domain agents - not yet implemented
  return NextResponse.json({
    content: "This agent is not yet available.",
    agentId,
  });
}
