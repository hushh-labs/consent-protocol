"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { StreamingAccordion } from "@/lib/morphy-ux/streaming-accordion";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity,
  BarChart3,
  Shield,
  TrendingUp,
  TrendingDown,
  Brain,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  ArrowRight,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// ============================================================================
// SSE EVENT TYPES (from backend sse_starlette)
// ============================================================================

/**
 * SSE Event structure from Python backend
 * Format: {"event": "<type>", "data": {...}, "id": "..."}
 */
interface SSEEvent {
  event?: string;
  data: string;
}

const chartConfig = {
  current: {
    label: "Current",
    color: "var(--destructive)",
  },
  optimized: {
    label: "Optimized",
    color: "var(--primary)",
  },
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

interface InteractiveStreamingViewProps {
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  onClose?: () => void;
}

export function InteractiveStreamingView({
  ticker,
  userId,
  riskProfile = "balanced",
  vaultOwnerToken,
  onClose,
}: InteractiveStreamingViewProps) {
  const { isVaultUnlocked } = useVault();
  
  // Loading and result state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [currentStage, setCurrentStage] = useState<string>("analyzing");
  const abortControllerRef = useRef<AbortController | null>(null);

  // New streaming states for granular control
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [thoughtCount, setThoughtCount] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [streamedText, setStreamedText] = useState("");

  // Debate rounds state (from working component)
  const [rounds, setRounds] = useState<any[]>([]);
  const [agentStreamingText, setAgentStreamingText] = useState<Record<string, string>>({});
  const [agentData, setAgentData] = useState<Record<string, any>>({
    fundamental: { status: "waiting" },
    sentiment: { status: "waiting" },
    valuation: { status: "waiting" },
  });
  const [currentPhase, setCurrentPhase] = useState<string>("idle");
  const [requestId, setRequestId] = useState<string>("");
  const [decision, setDecision] = useState<any>(null);

  // Parse SSE text into events
  // SSE format from sse_starlette:
  // event: agent_start
  // data: {"event": "agent_start", "data": {...}, "id": "..."}
  const parseSSEEvents = useCallback((text: string): SSEEvent[] => {
    const events: SSEEvent[] = [];
    const lines = text.split('\n');
    let currentEvent: SSEEvent | null = null;
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        // Finalize previous event if we have one
        if (currentEvent && currentEvent.data) {
          events.push(currentEvent);
        }
        // Start new event
        currentEvent = { event: line.slice(6).trim(), data: '' };
      } else if (line.startsWith('data:')) {
        const dataContent = line.slice(5).trim();
        if (currentEvent) {
          currentEvent.data = dataContent;
        } else {
          // Edge case: data line without event line
          currentEvent = { data: dataContent };
        }
      } else if (line === '' && currentEvent && currentEvent.data) {
        // Empty line ends the event
        events.push(currentEvent);
        currentEvent = null;
      }
    }
    
    // Don't forget the last event if buffer doesn't end with empty line
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
      // Also try direct parse in case sse_starlette doesn't nest
      try {
        return JSON.parse(dataString);
      } catch {
        return null;
      }
    }
  }, []);

  // Handle parsed SSE event (extract inner data and process)
  const handleParsedEvent = useCallback((event: SSEEvent) => {
    try {
      const parsedData = parseInnerEventData(event.data);
      if (!parsedData) {
        console.warn(`[SSE Parse] Failed to parse event data: ${event.data}`);
        return;
      }
      
      // Use the outer event type as our internal type
      const eventType = event.event || "unknown";
      
      console.log(`[SSE Parse] Event: ${eventType}`, parsedData);
      
      // Process the event
      switch (eventType) {
        case "ping":
          console.log("[Kai Stream] Connected:", parsedData.message);
          break;
        case "kai_thinking":
          console.log("[Kai Thinking]", parsedData.phase, ":", parsedData.message);
          break;
        case "agent_start":
          setCurrentStage(`Analyzing ${parsedData.agent}...`);
          setIsThinking(true);
          break;
        case "agent_token":
          setStreamingText(prev => prev + parsedData.text);
          break;
        case "agent_complete":
          setStreamingText(prev => prev + "\n\n");
          setIsThinking(false);
          break;
        case "agent_error":
          console.error("[Agent Error]", parsedData.agent, ":", parsedData.error);
          break;
        case "round_start":
          console.log("[Round Start]", `Round ${parsedData.round}:`, parsedData.description);
          break;
        case "debate_round":
          console.log("[Debate Round]", parsedData.round, "statements:", Object.keys(parsedData.statements));
          setCurrentStage(`Debate Round ${parsedData.round}...`);
          break;
        case "decision":
          console.log("[Decision] Analysis complete:", parsedData.decision);
          setResult(parsedData);
          setIsComplete(true);
          setIsStreaming(false);
          setIsThinking(false);
          setIsExtracting(false);
          break;
        case "error":
          console.error("[Kai Stream Error]", parsedData.message);
          throw new Error(parsedData.message);
      }
    } catch (e) {
      console.error(`[SSE Parse] Failed to process event:`, e);
    }
  }, [parseInnerEventData]);

  // Stage messages for display
  const stageMessages: Record<string, string> = {
    analyzing: "Initializing analysis pipeline...",
    "Analyzing fundamental...": "Analyzing SEC filings and financial health...",
    "Analyzing sentiment...": "Scanning news and market sentiment...",
    "Analyzing valuation...": "Calculating valuation metrics...",
    "Debate Round 1...": "Agents presenting their positions...",
    "Debate Round 2...": "Agents debating and challenging...",
  };

  const thoughtsText = useMemo(() => {
    return thoughts.map((t, i) => `[${i + 1}] ${t.replace(/\*\*/g, "")}`).join("\n");
  }, [thoughts]);

  const radarData = useMemo(() => {
    if (!result?.analytics?.health_radar) return [];
    const current = result.analytics.health_radar.current;
    const optimized = result.analytics.health_radar.optimized;
    return Object.keys(current).map(key => ({
      subject: key,
      A: current[key] || 0,
      B: optimized[key] || 0,
      fullMark: 100
    }));
  }, [result]);

  const sectorData = useMemo(() => {
    return result?.analytics?.sector_shift || [];
  }, [result]);

  // ============================================================================
// HELPER FUNCTIONS (from working component)
  // ============================================================================

// Agent configuration for UI
const getAgentConfig = useCallback((agent: string) => {
  const configs: Record<string, { name: string; icon: any; color: string }> = {
    fundamental: {
      name: "Fundamental",
      icon: BarChart3,
      color: "#3b82f6", // blue
    },
    sentiment: {
      name: "Sentiment",
      icon: TrendingUp,
      color: "#8b5cf6", // purple
    },
    valuation: {
      name: "Valuation",
      icon: Shield,
      color: "#10b981", // green
    },
  };
  return configs[agent] || { name: agent, icon: Brain, color: "#64748b" };
}, []);

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
  setIsStreaming(false);
  setIsThinking(false);
  setIsExtracting(false);
  toast({
    title: "Analysis Error",
    description: error,
    variant: "destructive",
  });
}, [requestId, ticker, userId, currentPhase, toast]);

// Parse SSE text into events (from working component)
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

// Parse the inner data field from SSE event (from working component)
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

// Handle SSE events (from working component - handles all 8 event types)
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
      setThoughts(prev => [...prev, parsedData.message]);
      setThoughtCount(prev => prev + 1);
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
      setIsStreaming(false);
      setIsThinking(false);
      setIsExtracting(false);
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
}, [requestId, onComplete, logError, parseInnerEventData]);

// Handle parsed SSE event (extract inner data and process)
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
}, [requestId, handleEvent, logError, parseInnerEventData]);

// ============================================================================
// STREAMING ANALYSIS
// ============================================================================

  // Run streaming analysis
  useEffect(() => {
    async function runStreamingAnalysis() {
      if (!isVaultUnlocked) {
        setLoading(false);
        setError("Vault must be unlocked for analysis");
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        setIsStreaming(true);
        setIsComplete(false);
        setStreamingText("");
        setThoughts([]);
        setThoughtCount(0);
        setStreamedText("");
        setCurrentStage("analyzing");
        setIsThinking(false);
        setIsExtracting(false);
        
        // Initialize debate state
        setRounds([]);
        setAgentStreamingText({});
        setAgentData({
          fundamental: { status: "waiting" },
          sentiment: { status: "waiting" },
          valuation: { status: "waiting" },
        });
        setRequestId(generateRequestId());
        setDecision(null);

        abortControllerRef.current = new AbortController();

        const response = await ApiService.streamKaiAnalysis({
          userId: userId,
          ticker: ticker,
          riskProfile: riskProfile,
          vaultOwnerToken: vaultOwnerToken,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as any)?.detail ||
            (errorData as any)?.error ||
            "Analysis failed"
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          
          if (value) {
            buffer += decoder.decode(value, { stream: true });
          }
          
          // Process complete SSE events (separated by double newline)
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || ''; // Keep incomplete last part in buffer

          for (const part of parts) {
            if (part.trim()) {
              const events = parseSSEEvents(part + '\n\n');
              for (const event of events) {
                handleParsedEvent(event);
              }
            }
          }

          if (done) {
            // Process any remaining buffer
            if (buffer.trim()) {
              const events = parseSSEEvents(buffer);
              for (const event of events) {
                handleParsedEvent(event);
              }
            }
            break;
          }
        }

      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.log("[InteractiveStreamingView] Analysis aborted");
        } else {
          setError((e as Error).message);
        }
        setIsStreaming(false);
        setIsThinking(false);
        setIsExtracting(false);
      } finally {
        setLoading(false);
      }
    }

    runStreamingAnalysis();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isVaultUnlocked, userId, ticker, riskProfile, vaultOwnerToken, parseSSEEvents, handleParsedEvent, generateRequestId]);

  return (
    <div className="w-full mx-auto space-y-4 px-4 py-4 sm:px-6 sm:py-6 md:max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <div>
            <h1 className="text-xl font-semibold">🎯 {ticker} Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Multi-agent debate powered by Gemini 3 Flash
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={() => {
              abortControllerRef.current?.abort();
              onClose();
            }}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Agent Cards - Streaming Phase */}
      {isStreaming && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.keys(agentData).map((agent) => (
            <Card
              key={agent}
              className={`rounded-xl p-4 border transition-all ${
                agentData[agent]?.status === "analyzing"
                  ? "border-hushh-blue/50 bg-hushh-blue/5 shadow-lg"
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
      )}

      {/* Debate Rounds Display */}
      {rounds.length > 0 && (
        <div className="space-y-3">
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

      {/* AI Reasoning Accordion */}
      {(isThinking || (thoughts.length > 0 && !isComplete) || (isComplete && thoughts.length > 0)) && (
        <StreamingAccordion
          id="ai-reasoning"
          title={`AI Reasoning${thoughtCount > 0 ? ` (${thoughtCount} thoughts)` : ""}`}
          text={thoughtsText}
          isStreaming={isThinking || isExtracting}
          isComplete={isComplete}
          icon={isComplete ? "brain" : "spinner"}
          iconClassName="w-6 h-6"
          maxHeight="250px"
          className="border-primary/10"
        />
      )}
      
      {/* Loading state */}
      {loading && !isStreaming && !streamingText && !streamedText && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <HushhLoader
              variant="inline"
              label="Initializing analysis..."
            />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader>
            <CardTitle>Analysis Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isComplete && result && (
        <>
          {/* Decision Card */}
          <Card variant="none" effect="glass" showRipple={false} className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary animate-pulse" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest">
                    Final Recommendation
                  </CardTitle>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest",
                  result.decision === "buy" ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" :
                  result.decision === "hold" ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                  "bg-red-500/20 text-red-500 border border-red-500/30"
                )}>
                  {result.decision.toUpperCase()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tighter text-foreground">
                  {result.confidence.toFixed(0)}%
                </span>
                <span className="text-sm text-muted-foreground">confidence</span>
              </div>
              
              <p className="text-sm text-foreground/80 font-medium">
                {result.decision === "buy" 
                  ? "Strong buy recommendation based on multi-agent consensus." 
                  : result.decision === "hold"
                  ? "Hold position with moderate conviction."
                  : "Reduce position or avoid entry."}
              </p>
              
              {result.consensus_reached && (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Consensus reached by all agents</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tab Navigation */}
          <Tabs defaultValue="fundamental" className="w-full">
            <TabsList className="bg-muted p-1 rounded-2xl h-12 w-full grid grid-cols-3">
              <TabsTrigger 
                value="fundamental"
                className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-primary transition-all"
              >
                Fundamental
              </TabsTrigger>
              <TabsTrigger 
                value="sentiment"
                className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-primary transition-all"
              >
                Sentiment
              </TabsTrigger>
              <TabsTrigger 
                value="valuation"
                className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-primary transition-all"
              >
                Valuation
              </TabsTrigger>
            </TabsList>
            
            {/* Fundamental Tab */}
            <TabsContent value="fundamental" className="mt-6 space-y-4">
              <Card variant="none" effect="glass" showRipple={false}>
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Fundamental Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 mb-4">
                    {result.fundamental_summary || "Detailed fundamental analysis would appear here."}
                  </p>
                  <div className="h-48 w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke="var(--border)" strokeOpacity={0.2} />
                        <PolarAngleAxis 
                          dataKey="subject" 
                          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 800, style: { textTransform: "uppercase" } }} 
                        />
                        <Radar
                          name="Current"
                          dataKey="A"
                          stroke="var(--color-current)"
                          fill="var(--color-current)"
                          fillOpacity={0.4}
                        />
                        <Radar
                          name="Optimized"
                          dataKey="B"
                          stroke="var(--color-optimized)"
                          fill="var(--color-optimized)"
                          fillOpacity={0.6}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      </RadarChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Sentiment Tab */}
            <TabsContent value="sentiment" className="mt-6 space-y-4">
              <Card variant="none" effect="glass" showRipple={false}>
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Sentiment Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 mb-4">
                    {result.sentiment_summary || "Detailed sentiment analysis would appear here."}
                  </p>
                  <div className="h-48 w-full flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Sentiment score: {result.sentiment_score || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Valuation Tab */}
            <TabsContent value="valuation" className="mt-6 space-y-4">
              <Card variant="none" effect="glass" showRipple={false}>
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Valuation Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 mb-4">
                    {result.valuation_summary || "Detailed valuation analysis would appear here."}
                  </p>
                  <div className="h-48 w-full flex items-center justify-center">
                    <div className="text-center">
                      <Shield className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Valuation metrics: {result.valuation_metrics ? Object.keys(result.valuation_metrics).length : 0} metrics</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}