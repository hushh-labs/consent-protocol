"use client";

import { useEffect, useState, useRef } from "react";
import { ImportProgressView, ImportStage } from "./views/import-progress-view";

// ============================================================================
// TYPES
// ============================================================================

interface AgentStreamingState {
  stage: ImportStage;
  streamedText: string;
  totalChars: number;
  chunkCount: number;
  thoughts: string[];
  thoughtCount: number;
  errorMessage?: string;
}

interface KaiAgentStreamingViewProps {
  agent: "fundamental" | "sentiment" | "valuation";
  agentName: string;
  agentIcon: React.ReactNode;
  agentColor: string;
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  onCancel?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KaiAgentStreamingView({
  agent,
  agentName: _agentName,
  agentIcon: _agentIcon,
  agentColor: _agentColor,
  ticker,
  userId,
  riskProfile = "balanced",
  vaultOwnerToken,
  onCancel,
}: KaiAgentStreamingViewProps) {
  const [streamingState, setStreamingState] = useState<AgentStreamingState>({
    stage: "analyzing",
    streamedText: "",
    totalChars: 0,
    chunkCount: 0,
    thoughts: [],
    thoughtCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Start streaming when component mounts
  useEffect(() => {
    async function startStreaming() {
      if (!vaultOwnerToken) {
        setStreamingState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: "Vault must be unlocked",
        }));
        return;
      }

      try {
        setStreamingState({
          stage: "analyzing",
          streamedText: "",
          totalChars: 0,
          chunkCount: 0,
          thoughts: [],
          thoughtCount: 0,
        });

        abortControllerRef.current = new AbortController();

        // Call the streaming API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/kai/analyze/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${vaultOwnerToken}`,
            },
            body: JSON.stringify({
              user_id: userId,
              ticker: ticker.toUpperCase(),
              risk_profile: riskProfile,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream available");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullStreamedText = "";
        let lastActivityTime = Date.now();
        const STREAM_TIMEOUT = 120000; // 2 minutes without activity

        while (true) {
          // Check for stream timeout
          if (Date.now() - lastActivityTime > STREAM_TIMEOUT) {
            reader.cancel();
            throw new Error("Stream timeout - no data received");
          }

          const { done, value } = await reader.read();
          if (done) break;

          lastActivityTime = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                // Handle different SSE events
                if (data.event === "agent_start") {
                  setStreamingState((prev) => ({
                    ...prev,
                    stage: "analyzing",
                  }));
                } else if (data.event === "agent_token") {
                  // Streaming tokens from Gemini
                  if (data.data?.token) {
                    fullStreamedText += data.data.token;
                  }
                  setStreamingState((prev) => ({
                    ...prev,
                    streamedText: fullStreamedText,
                    totalChars: data.data?.total_chars || prev.totalChars,
                    chunkCount: data.data?.chunk_count || prev.chunkCount,
                  }));
                } else if (data.event === "agent_complete") {
                  // Agent finished with summary
                  setStreamingState((prev) => ({
                    ...prev,
                    stage: "complete",
                    streamedText: fullStreamedText,
                    totalChars: data.data?.total_chars || prev.totalChars,
                    chunkCount: data.data?.chunk_count || prev.chunkCount,
                  }));
                } else if (data.event === "kai_thinking") {
                  // AI orchestration reasoning
                  setStreamingState((prev) => {
                    const newThoughts = data.data?.thought 
                      ? [...prev.thoughts, data.data.thought]
                      : prev.thoughts;
                    return {
                      ...prev,
                      thoughts: newThoughts,
                      thoughtCount: data.data?.thought_count || newThoughts.length,
                    };
                  });
                } else if (data.event === "error") {
                  setStreamingState((prev) => ({
                    ...prev,
                    stage: "error",
                    errorMessage: data.data?.message,
                  }));
                  throw new Error(data.data?.message || "Unknown error");
                }
              } catch (parseError) {
                // Ignore JSON parse errors for incomplete chunks
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[KaiAgentStreamingView] Streaming cancelled");
          return;
        }

        console.error("[KaiAgentStreamingView] Streaming error:", err);
        setStreamingState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    }

    startStreaming();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [agent, ticker, userId, riskProfile, vaultOwnerToken]);

  return (
    <ImportProgressView
      stage={streamingState.stage}
      streamedText={streamingState.streamedText}
      isStreaming={streamingState.stage === "analyzing"}
      totalChars={streamingState.totalChars}
      chunkCount={streamingState.chunkCount}
      thoughts={streamingState.thoughts}
      thoughtCount={streamingState.thoughtCount}
      errorMessage={streamingState.errorMessage}
      onCancel={onCancel}
      className="border-l-4"
    />
  );
}