"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { StreamingAccordion } from "@/lib/morphy-ux/streaming-accordion";
import { Activity, ArrowLeft, Zap, ArrowRight, TrendingDown, TrendingUp, ShieldCheck, Target, Info, LayoutDashboard, ListChecks, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, Cell
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type LoserInput = {
  symbol: string;
  name?: string;
  gain_loss_pct?: number;
  gain_loss?: number;
  market_value?: number;
};

type OptimizePlanAction = {
  symbol?: string;
  name?: string;
  current_weight_pct?: number;
  target_weight_pct?: number;
  action?: string;
  rationale?: string;
  criteria_refs?: string[];
  renaissance_tier?: string;
  avoid_flag?: boolean;
};

type OptimizeSummary = {
  health_score?: number;
  health_reasons?: string[];
  portfolio_diagnostics?: {
    total_losers_value?: number;
    avoid_weight_estimate_pct?: number;
    investable_weight_estimate_pct?: number;
    concentration_notes?: string[];
  };
  projected_health_score?: number;
  plans?: {
    minimal?: { actions?: OptimizePlanAction[] };
    standard?: { actions?: OptimizePlanAction[] };
    maximal?: { actions?: OptimizePlanAction[] };
  };
  [key: string]: unknown;
};

type AnalysisResult = {
  criteria_context: string;
  summary: OptimizeSummary;
  losers: OptimizePlanAction[];
  portfolio_level_takeaways: string[];
  analytics?: {
    health_radar: {
      current: Record<string, number>;
      optimized: Record<string, number>;
    };
    sector_shift: { sector: string; before_pct: number; after_pct: number }[];
  };
};

// SSE event types
type SSEEvent = 
  | { type: "stage"; stage: string; message: string }
  | { type: "thinking"; thought: string; count: number }
  | { type: "chunk"; text: string; count: number }
  | { type: "complete"; data: AnalysisResult }
  | { type: "error"; message: string; raw?: string };

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

export default function PortfolioHealthPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { vaultOwnerToken } = useVault();
  
  // Loading and result state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
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
  const [streamedText, setStreamedText] = useState(""); // For the extraction phase

  const input = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("kai_losers_analysis_input");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        userId: string;
        thresholdPct?: number;
        maxPositions?: number;
        losers: LoserInput[];
        hadBelowThreshold?: boolean;
        holdings?: Array<
          LoserInput & {
            weight_pct?: number;
            sector?: string;
            asset_type?: string;
          }
        >;
        forceOptimize?: boolean;
      };
    } catch {
      return null;
    }
  }, []);

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

  // Parse SSE events from text
  const parseSSEEvents = useCallback((text: string): SSEEvent[] => {
    const events: SSEEvent[] = [];
    const lines = text.split("\n");
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          events.push(data as SSEEvent);
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
    
    return events;
  }, []);

  // Run streaming analysis
  useEffect(() => {
    async function runStreamingAnalysis() {
      if (authLoading) return;
      
      if (!input) {
        setLoading(false);
        setError("No Optimize Portfolio context found. Please start from the Kai dashboard.");
        return;
      }

      const sessionToken =
        typeof window !== "undefined"
          ? ApiService.getVaultOwnerToken?.()
          : null;
      const effectiveToken = vaultOwnerToken || sessionToken;

      if (!user || !effectiveToken) {
        setLoading(false);
        setError("Missing session context. Please return to Kai dashboard.");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setIsStreaming(true);
        setIsComplete(false);
        setStreamingText(""); // Clear old streaming text
        setThoughts([]); // Clear old thoughts
        setThoughtCount(0);
        setStreamedText(""); // Clear old streamed text
        setCurrentStage("analyzing");
        setIsThinking(false);
        setIsExtracting(false);

        // Create abort controller for cleanup
        abortControllerRef.current = new AbortController();

        const response = await ApiService.analyzePortfolioLosersStream({
          userId: user.uid,
          losers: input.losers,
          thresholdPct: input.thresholdPct,
          maxPositions: input.maxPositions,
          vaultOwnerToken: effectiveToken,
          holdings: input.holdings,
          forceOptimize: input.forceOptimize,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as any)?.detail ||
            (errorData as any)?.error ||
            "Portfolio health analysis failed"
          );
        }

        // Read the SSE stream
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
          
          // Process events from buffer
          const events = parseSSEEvents(buffer);
          
          for (const event of events) {
            switch (event.type) {
              case "stage":
                setCurrentStage(event.stage);
                setIsThinking(event.stage === "thinking");
                setIsExtracting(event.stage === "extracting");
                break;
              case "thinking":
                setThoughts(prev => [...prev, event.thought]);
                setThoughtCount(event.count);
                break;
              case "chunk":
                setStreamedText(prev => prev + event.text);
                break;
              case "complete":
                setResult(event.data);
                setIsComplete(true);
                setIsStreaming(false);
                setIsThinking(false);
                setIsExtracting(false);
                break;
              case "error":
                throw new Error(event.message);
            }
          }
          
          // Clear processed events from buffer
          const lastNewline = buffer.lastIndexOf("\n\n");
          if (lastNewline !== -1) {
            buffer = buffer.slice(lastNewline + 2);
          }
          
          if (done) {
            // Process any remaining buffer before exiting
            if (buffer.trim()) {
              const finalEvents = parseSSEEvents(buffer);
              for (const event of finalEvents) {
                if (event.type === "complete") {
                  setResult(event.data);
                  setIsComplete(true);
                  setIsStreaming(false);
                  setIsThinking(false);
                  setIsExtracting(false);
                } else if (event.type === "error") {
                  throw new Error(event.message);
                }
              }
            }
            break;
          }
        }

      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.log("[PortfolioHealth] Analysis aborted");
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
      // Cleanup: abort any in-flight request
      abortControllerRef.current?.abort();
    };
  }, [authLoading, input, user, vaultOwnerToken, parseSSEEvents]);

  const thresholdLabel =
    input?.thresholdPct !== undefined ? `${input.thresholdPct}%` : "-5%";

  const hadBelowThreshold = input?.hadBelowThreshold ?? false;

  // Stage messages for display
  const stageMessages: Record<string, string> = {
    analyzing: "Analyzing portfolio positions...",
    thinking: "AI reasoning about portfolio health...",
    extracting: "Extracting optimization recommendations...",
  };

  return (
    <div className="w-full mx-auto space-y-4 px-4 py-4 pb-40 sm:px-6 sm:py-6 md:max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <div>
            <h1 className="text-xl font-semibold">Portfolio Optimization</h1>
          </div>
        </div>
        <Button
          variant="muted"
          onClick={() => router.push("/kai/dashboard")}
          className="cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* AI Reasoning Accordion - Shows during thinking phase, persists when complete */}
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
{/* Loading state (only show if not streaming yet) */}
      {loading && !isStreaming && !thoughtsText && !streamedText && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <HushhLoader
              variant="inline"
              label="Initializing portfolio analysis..."
            />
          </CardContent>
        </Card>
      )}

      {/* All-clear card only when we have no optimization result and no error */}
      {!loading && !error && !result && !isStreaming && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader>
            <CardTitle>All Clear at This Threshold</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No positions are currently below {thresholdLabel}. At this loss
              threshold, your portfolio looks healthy.
            </p>
            <p className="text-xs text-muted-foreground">
              You can tighten the threshold in a future update (for example,
              -2% or any negative position) if you want Kai to flag earlier
              drawdowns.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader>
            <CardTitle>Couldn't assess portfolio health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results - shown after streaming completes */}
      {isComplete && hadBelowThreshold && result && (
        <>
          {/* 1. High-Level Portfolio Health Summary */}
          <Card variant="none" effect="glass" showRipple={false} className="border-white/10 overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-primary" />
                Portfolio Intelligence & Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0 border-b border-border/10">
                {/* Visual Analytics Column */}
                <div className="p-8 border-r border-border/10 bg-muted/10 relative">
                  <div className="absolute top-4 left-6 text-[10px] font-black uppercase tracking-widest text-primary/60">
                    Health Dimensions
                  </div>
                  <div className="h-64 w-full mt-4">
                    {radarData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="var(--border)" strokeOpacity={0.3} />
                          <PolarAngleAxis 
                            dataKey="subject" 
                            tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontWeight: 700, style: { textTransform: "uppercase" } }} 
                          />
                          <Radar
                            name="Current"
                            dataKey="A"
                            stroke="var(--color-current)"
                            fill="var(--color-current)"
                            fillOpacity={0.3}
                          />
                          <Radar
                            name="Optimized"
                            dataKey="B"
                            stroke="var(--color-optimized)"
                            fill="var(--color-optimized)"
                            fillOpacity={0.5}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        </RadarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                        Visualizing alpha metrics...
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 border border-red-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Current</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50 border border-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Optimized</span>
                    </div>
                  </div>
                </div>

                {/* Score & Reasons Column */}
                <div className="p-8 space-y-8">
                  {typeof result.summary.health_score === "number" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Portfolio Alpha Alignment Index</span>
                          <span className="text-4xl font-black text-emerald-500">{result.summary.health_score.toFixed(0)}%</span>
                        </div>
                        {result.summary.projected_health_score && (
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest mb-1">Projected</span>
                            <span className="text-xl font-black text-primary">→ {result.summary.projected_health_score.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <Progress value={result.summary.health_score} className="h-3 bg-muted rounded-full" indicatorClassName="bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary" />
                      Strategic Insights
                    </h4>
                    {Array.isArray(result.summary.health_reasons) && result.summary.health_reasons.length > 0 ? (
                      <ul className="space-y-3">
                        {result.summary.health_reasons.slice(0, 3).map((r, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-foreground/80 leading-snug items-start">
                            <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                            <span className="font-medium">{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No specific observations noted.</p>
                    )}
                  </div>
                </div>
              </div>

              {result.summary.portfolio_diagnostics && (
                <div className="p-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
                  {[
                    { label: "Exposure Value", value: result.summary.portfolio_diagnostics.total_losers_value ? `$${result.summary.portfolio_diagnostics.total_losers_value.toLocaleString()}` : "N/A", icon: Target },
                    { label: "Avoid Risk", value: result.summary.portfolio_diagnostics.avoid_weight_estimate_pct ? `${result.summary.portfolio_diagnostics.avoid_weight_estimate_pct}%` : "0%", icon: ShieldCheck },
                    { label: "Alpha Conviction", value: result.summary.portfolio_diagnostics.investable_weight_estimate_pct ? `${result.summary.portfolio_diagnostics.investable_weight_estimate_pct}%` : "0%", icon: Zap }
                  ].map((stat, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-5 rounded-3xl bg-muted/30 border border-border/40 shadow-sm">
                      <div className="p-3 rounded-2xl bg-primary/10">
                        <stat.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{stat.label}</span>
                        <span className="text-sm font-black text-foreground">{stat.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 1.5. Sector Transformation Analytics */}
          {sectorData.length > 0 && (
            <Card variant="none" effect="glass" showRipple={false} className="border-white/5">
              <CardHeader className="pb-0">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  Sector Concentration Shift
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64 w-full">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={sectorData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                      <XAxis 
                        dataKey="sector" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "currentColor", opacity: 0.5, fontSize: 10, fontWeight: "bold" }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "currentColor", opacity: 0.5, fontSize: 10 }}
                        unit="%"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend 
                        verticalAlign="top" 
                        align="right" 
                        wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", paddingBottom: "20px" }} 
                      />
                      <Bar name="Current" dataKey="before_pct" fill="var(--color-current)" opacity={0.3} radius={[4, 4, 0, 0]} />
                      <Bar name="Optimized" dataKey="after_pct" fill="var(--color-optimized)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Executive Rationale & Takeaways (Highest Prominence for Investors) */}
          {(result.portfolio_level_takeaways?.length || 0) > 0 && (
            <div className="bg-muted/10 border border-primary/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-sm">
               <div className="absolute top-0 right-0 p-4 opacity-5">
                 <ShieldCheck className="w-32 h-32 text-foreground" />
               </div>
               <div className="relative z-10">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Executive Strategic Summary
                </h3>
                <ul className="grid gap-4 md:grid-cols-2">
                  {result.portfolio_level_takeaways.map((t, idx) => (
                    <li key={idx} className="flex gap-4 text-sm text-foreground/90 leading-relaxed font-semibold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 3. Simulated Outcome (Projected Improvement) */}
          <Card variant="none" effect="glass" showRipple={false} className="border-primary/20 bg-muted/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary animate-pulse" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Simulated Alignment Outcome</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/80 font-medium">
                By executing these {result.losers.length} adjustments, your portfolio's alpha alignment score is projected to move from <span className="text-red-400 font-black">{typeof result.summary.health_score === 'number' ? result.summary.health_score.toFixed(0) : "0"}</span> to <span className="text-emerald-400 font-black text-lg">{typeof result.summary.projected_health_score === 'number' ? `${result.summary.projected_health_score.toFixed(0)}+` : "92+"}</span>.
              </p>
              <div className="p-5 rounded-3xl bg-background/80 border border-border/10 space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>Current Fragility</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>Optimized Resilience</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-black text-red-500">
                     HIGH SPECULATIVE RISK
                   </div>
                   <div className="h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-500">
                     CONVICTION ALPHA DIVERSITY
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Optimization Strategy (The "How") */}
          {result.losers.some(l => l.action && l.action.toLowerCase() !== 'hold') && (
            <Card variant="none" effect="glass" showRipple={false} className="border-white/10 overflow-hidden">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <CardTitle>Optimization Trade Strategy</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                {[
                  {
                    title: "Capital Harvest (Reduce/Exit)",
                    icon: TrendingDown,
                    iconColor: "text-red-400",
                    items: result.losers.filter(l => ["exit", "trim", "rotate"].includes(l.action?.toLowerCase() || "") || (l.current_weight_pct || 0) > (l.target_weight_pct || 0)),
                    banner: "bg-red-500/5 border-red-500/10 text-red-500",
                    actionType: "REDUCE"
                  },
                  {
                    title: "Conviction Reinvestment (Add/Entry)",
                    icon: TrendingUp,
                    iconColor: "text-emerald-400",
                    items: result.losers.filter(l => ["add", "rotate"].includes(l.action?.toLowerCase() || "") || (l.target_weight_pct || 0) > (l.current_weight_pct || 0)),
                    banner: "bg-emerald-500/5 border-emerald-500/10 text-emerald-500",
                    actionType: "ADD"
                  }
                ].map((group, groupIdx) => {
                  if (group.items.length === 0) return null;
                  
                  return (
                    <div key={groupIdx} className="space-y-4">
                      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest", group.banner)}>
                        <group.icon className={cn("w-3.5 h-3.5", group.iconColor)} />
                        {group.title}
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-white/5">
                            <TableHead className="w-[100px] text-[10px] uppercase font-black text-muted-foreground">Asset</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-muted-foreground">Tier</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-muted-foreground text-right">Target Δ</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-muted-foreground text-right">Rationale</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((l, lIdx) => {
                            const delta = Math.abs((l.current_weight_pct || 0) - (l.target_weight_pct || 0));
                            
                            return (
                              <TableRow key={lIdx} className="group border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="py-4">
                                  <div className="flex flex-col">
                                    <span className="font-black text-xs text-foreground uppercase">{l.symbol}</span>
                                    <span className="text-[9px] text-muted-foreground truncate max-w-[100px] font-medium">{l.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {l.renaissance_tier && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-[9px] font-black tracking-widest px-1.5 py-0 rounded",
                                        l.renaissance_tier === "ACE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        l.renaissance_tier === "KING" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                        "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                      )}
                                    >
                                      {l.renaissance_tier}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={cn(
                                    "text-xs font-black",
                                    group.actionType === "REDUCE" ? "text-red-500" : "text-emerald-500"
                                  )}>
                                    {group.actionType === "REDUCE" ? "–" : "+"}{delta > 0 ? `${delta.toFixed(1)}%` : "N/A"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right max-w-[120px]">
                                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                                    {l.rationale || "Rebalancing for alpha alignment."}
                                  </p>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 5. Detailed Rebalance Plans (Scenario Logic) */}
          {result.summary.plans && (
            <Card variant="none" effect="glass" showRipple={false} className="border-white/5 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-primary" />
                  Proposed Rebalance Path Scenarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="standard" className="w-full">
                  <TabsList className="bg-muted p-1 rounded-2xl h-12 w-full grid grid-cols-3">
                    {(["minimal", "standard", "maximal"] as const).map((key) => (
                      <TabsTrigger 
                        key={key}
                        value={key} 
                        className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-primary transition-all"
                      >
                        {key}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {(["minimal", "standard", "maximal"] as const).map((key) => {
                    const plan = result.summary.plans?.[key];
                    if (!plan?.actions || plan.actions.length === 0) return null;
                    
                    return (
                      <TabsContent key={key} value={key} className="mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="grid gap-3">
                          {plan.actions.map((a, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-3xl bg-muted/20 border border-border/20 hover:border-primary/40 transition-all group gap-4 ring-1 ring-transparent hover:ring-primary/10">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs",
                                  a.action?.toLowerCase() === "exit" ? "bg-red-500/20 text-red-500" :
                                  a.action?.toLowerCase() === "trim" ? "bg-amber-500/20 text-amber-500" :
                                  "bg-emerald-500/20 text-emerald-500"
                                )}>
                                  {a.symbol?.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-foreground uppercase tracking-tight">{a.symbol}</span>
                                    <Badge variant="outline" className="text-[8px] h-4 font-black px-1.5 opacity-60">{a.action}</Badge>
                                  </div>
                                  <span className="text-[10px] font-medium text-muted-foreground line-clamp-1">{a.name || "Portfolio Holding"}</span>
                                </div>
                              </div>

                              <div className="flex flex-1 md:px-8">
                                <p className="text-[10px] text-muted-foreground leading-snug italic line-clamp-2 md:line-clamp-1">
                                  {a.rationale || "Strategic rebalancing for optimized alpha alignment."}
                                </p>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6 bg-white/5 md:bg-transparent p-3 md:p-0 rounded-2xl">
                                {typeof a.current_weight_pct === "number" && (
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Transition</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-muted-foreground/60">{a.current_weight_pct.toFixed(1)}%</span>
                                      <ArrowRight className="w-3 h-3 text-primary group-hover:translate-x-1 transition-transform" />
                                      <span className="text-sm font-black text-foreground">{(a.target_weight_pct ?? a.current_weight_pct).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                )}
                                <Button size="sm" variant="muted" className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Info className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* 6. Contextual Rubric & Extraction Status (Lower Prominence) */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="none" effect="glass" showRipple={false} className="border-white/5 opacity-80 hover:opacity-100 transition-opacity">
              <CardHeader className="py-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest">Renaissance Alignment Context</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground/80 leading-relaxed font-medium">
                  {result.criteria_context}
                </pre>
              </CardContent>
            </Card>

            {(isExtracting || (streamedText && !isComplete) || (isComplete && streamedText)) && (
              <Card variant="none" effect="glass" showRipple={false} className="border-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <StreamingAccordion
                    id="data-extraction"
                    title={`Alpha Analysis Engine Runtime`}
                    text={streamedText}
                    isStreaming={isExtracting}
                    isComplete={isComplete}
                    icon={isComplete ? "check" : "database"}
                    iconClassName="w-5 h-5 text-primary"
                    maxHeight="200px"
                    className="border-none bg-transparent rounded-none"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
