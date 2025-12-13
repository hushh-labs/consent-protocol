import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, agentId } = body;

    // Map agent IDs to local ports (Microservice architecture)
    const PORT_MAP: Record<string, number> = {
      'agent_orchestrator': 10003,
      'agent_professional_profile': 10004
    };

    const port = PORT_MAP[agentId] || 10003;
    const apiUrl = `http://127.0.0.1:${port}/agent/chat`; // ADK standard endpoint

    console.log(`[API] Proxying message to ${agentId} on port ${port}...`);

    // Call the Python Agent
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: message,
        // In a real app, passing user_id token here for consent
        user_id: "user_mock_001" 
      })
    });

    if (!response.ok) {
      throw new Error(`Agent service returned ${response.status}`);
    }

    const data = await response.json();
    
    // The ADK usually returns { response: "text" }
    return NextResponse.json({ 
      content: data.response || data.text || "No response text found.",
      // If the agent returned delegation metadata, pass it through
      delegation: data.delegation || null
    });

  } catch (error) {
    console.error("[API Error]", error);
    return NextResponse.json(
      { content: "Error: Could not connect to the agent. Is the Python service running?" },
      { status: 500 }
    );
  }
}
