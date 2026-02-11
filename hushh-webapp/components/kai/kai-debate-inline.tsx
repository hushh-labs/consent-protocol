"use client";

/**
 * Kai Debate Inline Component
 * 
 * Displays streaming debate analysis inline (not as a popup).
 * Features:
 * - Tab switcher for Round 1 | Round 2 | Final
 * - Streaming token animation (CSS-based, no framer-motion)
 * - Agent cards showing each specialist's position
 * - Full KPI data preservation
 * - Uses reusable KaiStreamingComponent for consistent streaming behavior
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Brain, 
  Target,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ShieldCheck,
  Rocket,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Card as RichCard } from "@/lib/morphy-ux/card";
import KaiFinancialCharts from "./kai-financial-charts";
import { KaiStreamingComponent, StreamingTokens } from "./kai-streaming-component";
import { streamKaiAnalysis } from "@/lib/services/kai-service";

// ============================================================================
// TYPES
// ============================================================================

interface AgentData {
  agent: string;
  agent_name?: string;
  color?: string;
  summary?: string;
  recommendation?: string;
  confidence?: number;
  key_metrics?: Record<string, any>;
  quant_metrics?: Record<string, any>;
  business_moat?: string;
  bull_case?: string;
  bear_case?: string;
  sources?: string[];
  sentiment_score?: number;
  valuation_metrics?: Record<string, any>;

  message?: string; // Status message from backend
}

interface RoundData {
  round: number;
  statements: Record<string, string>;
  context?: string;
}

interface KaiThinking {
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
  agent_votes?: Record<string, string>;
  dissenting_opinions?: string[];
  raw_card?: any;
}

interface KaiDebateInlineProps {
  ticker: string;
  userId: string;
  vaultOwnerToken: string;
  riskProfile: string;
  fullResult?: {
    ticker: string;
    decision: "buy" | "hold" | "reduce";
    headline: string;
    summary: string;
    confidence: number;
    processing_mode: string;
    raw_card?: any;
  } | null;
  userContext?: any;
  onComplete: (result: DecisionResult) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function KaiDebateInline({
  ticker,
  userId,
  vaultOwnerToken,
  riskProfile,
  fullResult,
  userContext,
  onComplete,
  onError,
}: KaiDebateInlineProps) {
  // State
  const [activeTab, setActiveTab] = useState<"round1" | "round2" | "final">("round1");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const [agentData, setAgentData] = useState<Record<string, AgentData>>({});
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<KaiThinking[]>([]);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);

  // Handle SSE events
  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("[KaiDebateInline] SSE Event received:", data);
      
      // kai_thinking event
      if (data.phase && data.message && data.tokens) {
        setThinkingMessages(prev => [...prev, data]);
      }
      
      // agent_start event
      else if (data.agent && data.agent_name && !data.summary) {
        setAgentData(prev => ({
          ...prev,
          [data.agent]: { ...prev[data.agent], ...data, isLoading: true }
        }));
      }
      
      // agent_complete event
      else if (data.agent && data.summary) {
        setAgentData(prev => ({
          ...prev,
          [data.agent]: { ...data, isLoading: false }
        }));
      }
      
      // round_start event
      else if (data.round !== undefined && data.description) {
        if (data.round === 2) {
          setActiveTab("round2");
        }
      }
      
      // debate_round event
      else if (data.round !== undefined && data.statements) {
        setRounds(prev => {
          const existing = prev.find(r => r.round === data.round);
          if (existing) return prev;
          return [...prev, data];
        });
      }
      
      // decision event
      else if (data.decision && data.final_statement) {
        setDecision(data);
        setActiveTab("final");
        setIsAnalyzing(false);
        onComplete(data);
      }
      
      // error event
      else if (data.message && data.ticker) {
        onError?.(data.message);
      }
      
    } catch (e) {
      console.error("[KaiDebateInline] Failed to parse event:", e);
    }
  }, [onComplete, onError]);

  // Parse SSE text into events
  const parseSSEEvents = useCallback((text: string): Array<{ event?: string; data: string }> => {
    const events: Array<{ event?: string; data: string }> = [];
    const lines = text.split('\n');
    let currentEvent: { event?: string; data: string } | null = null;
    
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

  // Handle parsed SSE event
  const handleParsedEvent = useCallback((event: { event?: string; data: string }) => {
    try {
      const data = JSON.parse(event.data);
      // Create a synthetic MessageEvent-like object
      handleEvent({ data: event.data } as MessageEvent);
    } catch (e) {
      console.error("[KaiDebateInline] Failed to parse SSE event data:", e);
    }
  }, [handleEvent]);

  // Start analysis via Kai service streaming API (supports auth headers)
  const startAnalysis = useCallback(async () => {
    if (!ticker || !userId || !vaultOwnerToken) return;
    
    setIsAnalyzing(true);
    setAgentData({});
    setRounds([]);
    setThinkingMessages([]);
    setDecision(null);
    setActiveTab("round1");

    console.log(`[KaiDebateInline] Starting analysis for ${ticker}`);

    try {
      const response = await streamKaiAnalysis({
        userId,
        ticker,
        riskProfile,
        userContext,
        vaultOwnerToken,
      });

      console.log("[KaiDebateInline] Response status:", response.status);
      console.log("[KaiDebateInline] Content-Type:", response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[KaiDebateInline] HTTP error:", response.status, errorText);
        onError?.(`HTTP ${response.status}: ${errorText}`);
        setIsAnalyzing(false);
        return;
      }

      if (!response.body) {
        onError?.("No response body received");
        setIsAnalyzing(false);
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
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        console.log("[KaiDebateInline] Chunk received, buffer length:", buffer.length);
        
        // Process complete events (separated by double newline)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Keep incomplete last part
        
        for (const part of parts) {
          if (part.trim()) {
            console.log("[KaiDebateInline] Processing SSE part:", part.substring(0, 100));
            const events = parseSSEEvents(part + '\n\n');
            console.log("[KaiDebateInline] Parsed events count:", events.length);
            events.forEach(handleParsedEvent);
          }
        }
      }
    } catch (e) {
      console.error("[KaiDebateInline] Fetch error:", e);
      onError?.("Connection error. Please try again.");
      setIsAnalyzing(false);
    }
  }, [ticker, userId, vaultOwnerToken, riskProfile, userContext, parseSSEEvents, handleParsedEvent, onError]);

  // Start on mount (once only)
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, userId, vaultOwnerToken, riskProfile, userContext, startAnalysis]);

  // Tab config - cleaner labels without redundant numbers
  const tabs = [
    { id: "round1" as const, label: "Round 1", shortLabel: "R1" },
    { id: "round2" as const, label: "Round 2", shortLabel: "R2" },
    { id: "final" as const, label: "Decision Card", shortLabel: "Decision" },
  ];

  const round1Data = rounds.find(r => r.round === 1);
  const round2Data = rounds.find(r => r.round === 2);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hushh-blue to-purple-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
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

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab(tab.id)}
            disabled={
              (tab.id === "round2" && rounds.length < 2 && !decision) ||
              (tab.id === "final" && !decision)
            }
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </Button>
        ))}
      </div>

      {/* Use the reusable KaiStreamingComponent */}
      <KaiStreamingComponent
        ticker={ticker}
        userId={userId}
        vaultOwnerToken={vaultOwnerToken}
        riskProfile={riskProfile}
        userContext={userContext}
        onComplete={(result) => {
          // Update agent data with complete results
          setDecision(result);
          if (result.raw_card) {
            setAgentData({
              fundamental: {
                ...agentData.fundamental,
                ...result.raw_card.fundamental_insight,
              },
              sentiment: {
                ...agentData.sentiment,
                ...result.raw_card.sentiment_insight,
              },
              valuation: {
                ...agentData.valuation,
                ...result.raw_card.valuation_insight,
              },
            });
          }
          onComplete(result);
        }}
        onError={(error, context) => {
          console.error("[KaiDebateInline] Error:", error, context);
          onError?.(error);
        }}
        className="w-full"
      />

      {/* Tab Content */}
      {activeTab === "round1" && (
        <RoundContent
          roundNum={1}
          roundData={round1Data}
          thinkingMessages={thinkingMessages}
          agentData={agentData}
          isActive={isAnalyzing && (currentPhase.includes("round1") || currentPhase === "analysis")}
        />
      )}
      
      {activeTab === "round2" && (
        <RoundContent
          roundNum={2}
          roundData={round2Data}
          thinkingMessages={thinkingMessages}
          agentData={agentData}
          isActive={isAnalyzing && currentPhase.includes("round2")}
        />
      )}
      
      {activeTab === "final" && decision && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Kai's Decision Reasoning */}
          {thinkingMessages.filter(t => t.phase === "decision").length > 0 && (
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  Kai's Decision Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {thinkingMessages
                  .filter(t => t.phase === "decision")
                  .map((thinking, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-sm font-medium">{thinking.message}</p>
                      <StreamingTokens tokens={thinking.tokens} isComplete={true} />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Top Level Decision Card (Unified View) */}
          <RichCard
            variant="none"
            effect="glass"
            showRipple={false}
            className="p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between min-h-[280px] border-border/60 shadow-xl bg-gradient-to-br from-background/80 to-muted/20"
          >
            <div className="absolute top-0 right-0 p-12 opacity-[0.04] text-foreground pointer-events-none">
              <Terminal className="h-64 w-64" />
            </div>

            <div className="space-y-6 relative z-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 glass flex items-center justify-center rounded-2xl border border-border/60 shadow-inner bg-background/50">
                    <span className="text-4xl font-black tracking-tighter text-foreground">
                      {fullResult?.ticker || ticker}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground/90 leading-tight">
                      {fullResult?.headline || decision?.final_statement}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {fullResult?.processing_mode || "Hybrid"} Analysis
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`px-8 py-4 rounded-2xl border text-3xl font-black uppercase tracking-tighter shadow-xl backdrop-blur-md ${
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

              <div className="grid md:grid-cols-2 gap-8 pt-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <Brain className="h-3 w-3 text-primary" />
                    Executive Summary
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-foreground/85">
                    {fullResult?.raw_card?.fundamental_insight?.summary || decision?.final_statement}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <Target className="h-3 w-3 text-primary" />
                    Risk Alignment
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-foreground/85 italic border-l-2 border-primary/30 pl-3">
                    "
                    {fullResult?.raw_card?.risk_persona_alignment || decision?.raw_card?.risk_persona_alignment ||
                      "Analysis aligned with your risk profile."}
                    "
                  </p>
                </div>
              </div>
            </div>
          </RichCard>

          {/* Agent Votes */}
          {decision.agent_votes && (
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(decision.agent_votes).map(([agent, vote]) => (
                <Card key={agent} className="text-center py-3">
                  <p className="text-xs text-muted-foreground capitalize">{agent}</p>
                  <p className={`font-bold uppercase ${
                    vote === "buy" ? "text-green-500" :
                    vote === "reduce" ? "text-red-500" : "text-orange-500"
                  }`}>{vote}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Financial Charts Section */}
          {(decision.raw_card?.quant_metrics || fullResult?.raw_card?.quant_metrics) && (
            <div className="mt-6 pt-6 border-t border-border/50">
               <KaiFinancialCharts 
                  quantMetrics={decision.raw_card?.quant_metrics || fullResult?.raw_card?.quant_metrics}
                  keyMetrics={decision.raw_card?.key_metrics || fullResult?.raw_card?.key_metrics}
               />
            </div>
          )}

          {/* FULL KPI REPORT - Embedded when fullResult available */}
          {fullResult?.raw_card && (
            <div className="mt-6 space-y-4 pt-6 border-t border-border/50">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" />
                Full Analysis Report
              </h3>
              
              {/* Executive Summary */}
              {fullResult.raw_card.fundamental_insight?.summary && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">
                      {fullResult.raw_card.fundamental_insight.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Bull vs Bear Cases */}
              <div className="grid md:grid-cols-2 gap-4">
                {fullResult.raw_card.fundamental_insight?.bull_case && (
                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-500 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Bull Case
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {fullResult.raw_card.fundamental_insight.bull_case}
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                {fullResult.raw_card.fundamental_insight?.bear_case && (
                  <Card className="border-red-500/20 bg-red-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Bear Case
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {fullResult.raw_card.fundamental_insight.bear_case}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Business Moat */}
              {fullResult.raw_card.fundamental_insight?.business_moat && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Business Moat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {fullResult.raw_card.fundamental_insight.business_moat}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Growth & Innovation */}
              {fullResult?.raw_card?.fundamental_insight?.growth_efficiency && (
                <Card className="border-border/50 bg-card/50">
                   <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-purple-500" />
                        Growth & Innovation
                      </CardTitle>
                   </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {fullResult.raw_card.fundamental_insight.growth_efficiency}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Capital Allocation Audit */}
              {fullResult?.raw_card?.fundamental_insight?.financial_resilience && (
                <Card className="border-border/50 bg-card/50">
                   <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        Capital Allocation Audit
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {fullResult.raw_card.fundamental_insight.financial_resilience}
                      </p>
                      
                      {/* Interactive Metrics (Earnings Quality, Debt) */}
                      <div className="grid grid-cols-2 gap-4 mt-4 bg-background/30 p-4 rounded-xl w-full min-w-0">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">
                            OCF / Net Income
                          </p>
                          <p
                            className={`text-lg font-black ${
                              (fullResult.raw_card.key_metrics?.fundamental?.earnings_quality ?? 0) > 1
                                ? "text-emerald-500"
                                : "text-orange-500"
                            }`}
                          >
                            {fullResult.raw_card.key_metrics?.fundamental?.earnings_quality != null
                              ? fullResult.raw_card.key_metrics.fundamental.earnings_quality.toFixed(2)
                              : "--"}
                            x
                          </p>
                          <p className="text-[9px] text-muted-foreground/70">
                            Target: {">"} 1.0x
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">
                            Debt to Equity
                          </p>
                          <p
                            className={`text-lg font-black ${
                              (fullResult.raw_card.key_metrics?.fundamental?.debt_to_equity ?? 999) < 1.0
                                ? "text-emerald-500"
                                : "text-foreground"
                            }`}
                          >
                            {fullResult.raw_card.key_metrics?.fundamental?.debt_to_equity != null
                              ? fullResult.raw_card.key_metrics.fundamental.debt_to_equity.toFixed(2)
                              : "--"}
                          </p>
                        </div>
                      </div>
                   </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ROUND TAB CONTENT
// ============================================================================

function RoundContent({ 
  roundNum, 
  roundData, 
  thinkingMessages,
  agentData,
  isActive 
}: { 
  roundNum: number;
  roundData?: RoundData;
  thinkingMessages: KaiThinking[];
  agentData: Record<string, AgentData>;
  isActive: boolean;
}) {
  // For Round 1, show analysis + round1 thinking; for Round 2, show round2 + debate thinking
  const relevantThinking = thinkingMessages.filter(
    t => {
      if (roundNum === 1) {
        return t.phase === "analysis" || t.phase === "round1" || t.phase === "debate";
      }
      return t.phase === `round${roundNum}` || t.phase === "debate";
    }
  );

  return (
    <div className="space-y-4">
      {/* Kai Thinking Section */}
      {relevantThinking.length > 0 && (
        <Card className="border-hushh-blue/20 bg-gradient-to-br from-hushh-blue/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-hushh-blue" />
              Kai is thinking...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relevantThinking.map((thinking, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-sm font-medium">{thinking.message}</p>
                <StreamingTokens tokens={thinking.tokens} isComplete={!isActive} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Agent Statements */}
      {roundData?.statements && (
        <div className="grid gap-3">
          {Object.entries(roundData.statements).map(([agent, statement]) => (
            <Card key={agent} className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div 
                    className="w-2 h-2 rounded-full mt-2"
                    style={{ 
                      backgroundColor: agent === "fundamental" ? "#3b82f6" : 
                                       agent === "sentiment" ? "#8b5cf6" : "#10b981"
                    }}
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                      {agent} Agent
                    </p>
                    <p className="text-sm">{statement}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {["fundamental", "sentiment", "valuation"].map((agent) => (
          <AgentCard 
            key={agent}
            agent={agent}
            data={agentData[agent]}
            isActive={isActive}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AGENT CARD COMPONENT
// ============================================================================

function AgentCard({ 
  agent, 
  data, 
  isActive,
  streamingText 
}: { 
  agent: string; 
  data?: AgentData; 
  isActive: boolean;
  streamingText?: string;
}) {
  const agentConfig: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
    fundamental: { name: "Fundamental", color: "#3b82f6", icon: <Search className="w-4 h-4" /> },
    sentiment: { name: "Sentiment", color: "#8b5cf6", icon: <TrendingUp className="w-4 h-4" /> },
    valuation: { name: "Valuation", color: "#10b981", icon: <Target className="w-4 h-4" /> },
  };

  const config = agentConfig[agent] || { name: agent, color: "#888", icon: <Brain className="w-4 h-4" /> };
  
  const getDecisionIcon = (rec?: string) => {
    if (!rec) return null;
    const r = rec.toLowerCase();
    if (r.includes("buy") || r.includes("bullish")) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (r.includes("reduce") || r.includes("bearish")) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-orange-500" />;
  };

  return (
    <div
      className={`rounded-xl p-4 border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isActive 
          ? "border-hushh-blue/50 bg-hushh-blue/5 shadow-lg" 
          : "border-border/50 bg-card/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <div style={{ color: config.color }}>{config.icon}</div>
        </div>
        <span className="font-semibold text-sm">{config.name}</span>
        {data?.recommendation && (
          <div className="ml-auto flex items-center gap-1">
            {getDecisionIcon(data.recommendation)}
            <span className="text-xs font-medium uppercase">{data.recommendation}</span>
          </div>
        )}
      </div>
      
      {/* Show streaming text if available during analysis */}
      {streamingText ? (
        <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto">
          <p className="whitespace-pre-wrap font-mono leading-relaxed">
            {streamingText}
            <span className="inline-block w-1.5 h-3 bg-hushh-blue ml-0.5 animate-pulse" />
          </p>
        </div>
      ) : data?.summary ? (
        <p className="text-xs text-muted-foreground line-clamp-3">{data.summary}</p>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span className="truncate">{data?.message || "Analyzing..."}</span>
        </div>
      )}
      
      {data?.confidence && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                backgroundColor: config.color,
                width: `${data.confidence * 100}%`
              }}
            />
          </div>
          <span className="text-xs font-mono">{Math.round(data.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}