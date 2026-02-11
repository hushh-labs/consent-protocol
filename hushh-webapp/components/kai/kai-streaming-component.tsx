"use client";

/**
 * Kai Streaming Component - Reusable SSE Streaming Engine
 * 
 * Provides a common streaming interface for Kai agent debates.
 * Features:
 * - Reusable StreamingTokens component with CSS animation
 * - SSE event parsing and handling
 * - Comprehensive error logging with request ID tracking
 * - Agent state management (waiting, analyzing, complete, error)
 * - Debate rounds tracking
 * - Thinking messages with token streaming
 * - Decision results with full KPI data
 * 
 * Usage:
 * ```tsx
 * <KaiStreamingComponent
 *   ticker="AAPL"
 *   userId="user123"
 *   vaultOwnerToken="token123"
 *   onComplete={(result) => console.log(result)}
 *   onError={(error, context) => console.error(error, context)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { streamKaiAnalysis } from "@/lib/services/kai-service";

// ============================================================================
// TYPES
// ============================================================================

interface AgentState {
  status: "waiting" | "analyzing" | "complete" | "error";
  summary?: string;
  recommendation?: string;
  confidence?: number;
  error?: string;
  streamingText?: string;
}

interface DebateRound {
  round: number;
  statements: Record<string, string>;
}

interface ThinkingMessage {
  phase: string;
  message: string;
  tokens: string[];
}

interface DecisionResult {
  ticker: string;
  decision: "buy" | "hold" | "reduce";
  confidence: number;
  consensus_reached: boolean;
  final_statement: string;
  raw_card?: any;
  agent_votes?: Record<string, string>;
  dissenting_opinions?: string[];
}

interface KaiStreamingComponentProps {
  // Required
  ticker: string;
  userId: string;
  vaultOwnerToken: string;
  
  // Optional
  riskProfile?: string;
  userContext?: any;
  
  // Callbacks
  onComplete: (result: DecisionResult) => void;
  onError: (error: string, context?: any) => void;
  
  // Styling
  className?: string;
}

// ============================================================================
// STREAMING TOKEN COMPONENT (CSS-based animation)
// ============================================================================

export function StreamingTokens({ tokens, isComplete }: { tokens: string[]; isComplete: boolean }) {
  return (
    <div className="font-mono text-sm text-muted-foreground leading-relaxed">
      {tokens.map((token, index) => (
        <span
          key={index}
          className="inline mr-1 animate-in fade-in slide-in-from-bottom-1 duration-200"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
        >
          {token}
        </span>
      ))}
      {!isComplete && (
        <span className="inline-block w-2 h-4 bg-hushh-blue ml-1 animate-pulse" />
      )}
    </div>
  );
}

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

interface SSEEvent {
  event?: string;
  data: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KaiStreamingComponent({
  ticker,
  userId,
  vaultOwnerToken,
  riskProfile = "balanced",
  userContext,
  onComplete,
  onError,
  className = "",
}: KaiStreamingComponentProps) {
  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentData, setAgentData] = useState<Record<string, AgentState>>({
    fundamental: { status: "waiting" },
    sentiment: { status: "waiting" },
    valuation: { status: "waiting" },
  });
  const [agentStreamingText, setAgentStreamingText] = useState<Record<string, string>>({});
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<ThinkingMessage[]>([]);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>("idle");
  const [requestId, setRequestId] = useState<string>("");
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `kai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Comprehensive error logging
  const logError = useCallback((error: string, context?: any) => {
    const errorContext = {
      requestId,
      ticker,
      userId,
      phase: currentPhase,
      error,
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    console.error(`[KaiStreaming] Request ${requestId} failed:`, errorContext);
    setError(error);
    setIsAnalyzing(false);
    onError?.(error, errorContext);
  }, [requestId, ticker, userId, currentPhase, onError]);

  // Parse SSE text into events
  // SSE format: "data: {\"event\": \"...\", \"data\": {...}, \"id\": \"...\"}"
  // The parsed JSON has both "event" and "data" fields - we need to extract the inner data
  const parseSSEEvents = useCallback((text: string): SSEEvent[] => {
    const events: SSEEvent[] = [];
    const lines = text.split('\n');
    let currentEvent: SSEEvent | null = null;
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        if (currentEvent && currentEvent.data) {
          events.push(currentEvent);
        }
        currentEvent = { event: line.slice(6).trim(), data: '' };
      } else if (line.startsWith('data:')) {
        const dataContent = line.slice(5).trim();
        if (currentEvent) {
          currentEvent.data = dataContent;
        } else {
          currentEvent = { data: dataContent };
        }
      } else if (line === '' && currentEvent && currentEvent.data) {
        events.push(currentEvent);
        currentEvent = null;
      }
    }
    
    // Don't forget the last event
    if (currentEvent && currentEvent.data) {
      events.push(currentEvent);
    }
    
    return events;
  }, []);

  // Parse the inner data field from SSE event
  const parseInnerEventData = useCallback((dataString: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(dataString);
      // SSE events from sse_starlette have nested structure:
      // { "event": "<type>", "data": {...}, "id": "..." }
      // Extract the inner "data" field which contains the actual payload
      return parsed.data as Record<string, any>;
    } catch {
      return null;
    }
  }, []);

  // Handle SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    try {
      // Parse the inner data field from SSE event
      const parsedData = parseInnerEventData(event.data);
      if (!parsedData) {
        throw new Error(`Failed to parse event data: ${event.data}`);
      }
      console.log(`[KaiStreaming] Request ${requestId} event received:`, parsedData);
      
      // kai_thinking event
      if (parsedData.phase && parsedData.message && parsedData.tokens) {
        setThinkingMessages(prev => [...prev, parsedData]);
        setCurrentPhase(parsedData.phase);
      }
      
      // agent_start event
      else if (parsedData.agent && parsedData.agent_name && !parsedData.summary) {
        setAgentData(prev => ({
          ...prev,
          [parsedData.agent]: { ...prev[parsedData.agent], ...parsedData, isLoading: true }
        }));
      }
      
      // agent_complete event
      else if (parsedData.agent && parsedData.summary) {
        setAgentData(prev => ({
          ...prev,
          [parsedData.agent]: { ...parsedData, isLoading: false }
        }));
        // Clear streaming text when complete
        setAgentStreamingText(prev => ({
          ...prev,
          [parsedData.agent]: ''
        }));
      }
      
      // agent_token event - streaming tokens from Gemini
      else if (parsedData.type === "token" && parsedData.agent && parsedData.text) {
        setAgentStreamingText(prev => ({
          ...prev,
          [parsedData.agent]: (prev[parsedData.agent] || '') + parsedData.text
        }));
      }
      
      // round_start event
      else if (parsedData.round !== undefined && parsedData.description) {
        setCurrentPhase(`round${parsedData.round}`);
      }
      
      // debate_round event
      else if (parsedData.round !== undefined && parsedData.statements) {
        setRounds(prev => {
          const existing = prev.find(r => r.round === parsedData.round);
          if (existing) return prev;
          return [...prev, parsedData];
        });
      }
      
      // decision event
      else if (parsedData.decision && parsedData.final_statement) {
        setDecision(parsedData);
        setCurrentPhase("decision");
        setIsAnalyzing(false);
        onComplete(parsedData);
      }
      
      // error event
      else if (parsedData.message && parsedData.ticker) {
        logError(parsedData.message, { event: 'error', data: parsedData });
      }
    } catch (e) {
      console.error(`[KaiStreaming] Request ${requestId} failed to parse event:`, e);
      logError(`Failed to parse event: ${e instanceof Error ? e.message : String(e)}`, { rawEvent: event });
    }
  }, [requestId, onComplete, logError]);
  const handleParsedEvent = useCallback((event: SSEEvent) => {
    // Create a synthetic MessageEvent-like object using the inner data
    try {
      const parsedData = parseInnerEventData(event.data);
      if (parsedData) {
        handleEvent({ data: parsedData } as SSEEvent);
      }
    } catch (e) {
      console.error(`[KaiStreaming] Request ${requestId} failed to parse SSE event data:`, e);
      logError(`Failed to parse SSE event data: ${e instanceof Error ? e.message : String(e)}`, { rawEvent: event });
    }
  }, [requestId, handleEvent, logError]);

  // Start analysis via Kai service streaming API (supports auth headers)
  const startAnalysis = useCallback(async () => {
    // Generate request ID
    const newRequestId = generateRequestId();
    setRequestId(newRequestId);
    
    if (!ticker || !userId || !vaultOwnerToken) {
      logError("Missing required parameters: ticker, userId, or vaultOwnerToken");
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    setAgentData({});
    setAgentStreamingText({});
    setRounds([]);
    setThinkingMessages([]);
    setDecision(null);
    setCurrentPhase("analysis");

    console.log(`[KaiStreaming] Starting analysis for ${ticker} (Request ${newRequestId})`);

    try {
      const response = await streamKaiAnalysis({
        userId,
        ticker,
        riskProfile,
        userContext,
        vaultOwnerToken,
      });

      console.log(`[KaiStreaming] Request ${newRequestId} response status:`, response.status);
      console.log(`[KaiStreaming] Request ${newRequestId} Content-Type:`, response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[KaiStreaming] Request ${newRequestId} HTTP error:`, response.status, errorText);
        logError(`HTTP ${response.status}: ${errorText}`, { status: response.status });
        return;
      }

      if (!response.body) {
        logError("No response body received");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const events = parseSSEEvents(buffer);
            events.forEach(handleParsedEvent);
          }
          console.log(`[KaiStreaming] Request ${newRequestId} stream complete`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        console.log(`[KaiStreaming] Request ${newRequestId} chunk received, buffer length:`, buffer.length);
        
        // Process complete events (separated by double newline)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Keep incomplete last part
        
        for (const part of parts) {
          if (part.trim()) {
            console.log(`[KaiStreaming] Request ${newRequestId} Processing SSE part:`, part.substring(0, 100));
            const events = parseSSEEvents(part + '\n\n');
            console.log(`[KaiStreaming] Request ${newRequestId} Parsed events count:`, events.length);
            events.forEach(handleParsedEvent);
          }
        }
      }
    } catch (e) {
      console.error(`[KaiStreaming] Request ${newRequestId} Fetch error:`, e);
      logError(`Connection error: ${e instanceof Error ? e.message : String(e)}`, { error: e });
    }
  }, [ticker, userId, vaultOwnerToken, riskProfile, userContext, generateRequestId, parseSSEEvents, handleParsedEvent, logError]);

  // Start on mount (once only)
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, userId, vaultOwnerToken, riskProfile, userContext, startAnalysis]);

  // Agent configuration
  const agentConfig: Record<string, { name: string; color: string; icon: string }> = {
    fundamental: { name: "Fundamental", color: "#3b82f6", icon: "🔍" },
    sentiment: { name: "Sentiment", color: "#8b5cf6", icon: "📰" },
    valuation: { name: "Valuation", color: "#10b981", icon: "🧮" },
  };
  
  const getAgentConfig = (agent: string) => agentConfig[agent] ?? {
    name: agent,
    color: "#888",
    icon: "🤖"
  };

  return (
    <div className={`kai-streaming-component ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hushh-blue to-purple-500 flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Analyzing {ticker}</h2>
            <p className="text-xs text-muted-foreground">
              {isAnalyzing ? "Multi-agent debate in progress..." : decision ? "Analysis complete" : ""}
            </p>
          </div>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="capitalize">{currentPhase.replace(/([0-9])/g, ' $1')}</span>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/5 mb-6">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <p className="text-xs text-red-400 mt-1">Request ID: {requestId}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {Object.keys(agentConfig).map((agent) => (
          <Card
            key={agent}
            className={`rounded-xl p-4 border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              agentData[agent]?.status === "analyzing"
                ? "border-hushh-blue/50 bg-hushh-blue/5 shadow-lg"
                : agentData[agent]?.status === "complete"
                ? "border-border/50 bg-card/50"
                : "border-border/50 bg-card/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${getAgentConfig(agent).color}20` }}
              >
                <span style={{ color: getAgentConfig(agent).color }}>{getAgentConfig(agent).icon}</span>
              </div>
              <span className="font-semibold text-sm">{getAgentConfig(agent).name}</span>
              {agentData[agent]?.recommendation && (
                <div className="ml-auto flex items-center gap-1">
                  <span className={`text-xs font-bold uppercase ${
                    agentData[agent].recommendation === "buy" ? "text-green-500" :
                    agentData[agent].recommendation === "reduce" ? "text-red-500" : "text-orange-500"
                  }`}>{agentData[agent].recommendation}</span>
                </div>
              )}
            </div>
            
            {/* Show streaming text if available during analysis */}
            {agentStreamingText[agent] ? (
              <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto">
                <p className="whitespace-pre-wrap font-mono leading-relaxed">
                  {agentStreamingText[agent]}
                  <span className="inline-block w-1.5 h-3 bg-hushh-blue ml-0.5 animate-pulse" />
                </p>
              </div>
            ) : agentData[agent]?.summary ? (
              <p className="text-xs text-muted-foreground line-clamp-3">{agentData[agent].summary}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span className="truncate">{agentData[agent]?.summary ? "Analyzing..." : "Waiting for analysis"}</span>
              </div>
            )}
            
            {agentData[agent]?.confidence && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: getAgentConfig(agent).color,
                      width: `${agentData[agent].confidence * 100}%`
                    }}
                  />
                </div>
                <span className="text-xs font-mono">{Math.round(agentData[agent].confidence * 100)}%</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Debate Rounds */}
      {rounds.length > 0 && (
        <div className="space-y-3 mb-6">
          {rounds.map((round) => (
            <Card key={round.round} className="border-border/50">
              <CardContent className="pt-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Round {round.round}
                </div>
                {Object.entries(round.statements).map(([agent, statement]) => (
                  <div key={agent} className="flex items-start gap-3 mb-3 last:mb-0">
                    <div
                      className="w-2 h-2 rounded-full mt-2"
                      style={{
                        backgroundColor: agent === "fundamental" ? "#3b82f6" :
                                         agent === "sentiment" ? "#8b5cf6" : "#10b981"
                      }}
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        {getAgentConfig(agent).name || agent}
                      </p>
                      <p className="text-sm">{statement}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Card */}
      {decision && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Final Decision
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Request ID: {requestId}</p>
              </div>
              <div
                className={`px-6 py-3 rounded-xl border text-2xl font-black uppercase tracking-tighter ${
                  decision.decision === "buy"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : decision.decision === "reduce"
                    ? "bg-red-500/10 border-red-500/20 text-red-500"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-500"
                }`}
              >
                {decision.decision}
              </div>
            </div>
            <p className="text-sm font-medium leading-relaxed">
              {decision.final_statement}
            </p>
          </CardContent>
        </Card>
      )}

      <style jsx>{`
        .kai-streaming-component {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
      `}</style>
    </div>
  );
}