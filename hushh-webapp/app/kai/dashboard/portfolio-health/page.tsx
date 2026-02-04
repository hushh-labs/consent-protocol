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
import { Activity, ArrowLeft } from "lucide-react";

type LoserInput = {
  symbol: string;
  name?: string;
  gain_loss_pct?: number;
  gain_loss?: number;
  market_value?: number;
};

type OptimizePlanAction = {
  symbol?: string;
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
};

// SSE event types
type SSEEvent = 
  | { type: "stage"; stage: string; message: string }
  | { type: "thinking"; thought: string; count: number }
  | { type: "chunk"; text: string; count: number }
  | { type: "complete"; data: AnalysisResult }
  | { type: "error"; message: string; raw?: string };

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
        setStreamingText("");
        setCurrentStage("analyzing");

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
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const events = parseSSEEvents(buffer);
          
          for (const event of events) {
            switch (event.type) {
              case "stage":
                setCurrentStage(event.stage);
                break;
              case "thinking":
                setStreamingText(prev => prev + `\n[Thought ${event.count}] ${event.thought}\n`);
                break;
              case "chunk":
                // Don't show raw JSON chunks in the streaming text
                // The thinking events are more user-friendly
                break;
              case "complete":
                setResult(event.data);
                setIsComplete(true);
                setIsStreaming(false);
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
        }

      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.log("[PortfolioHealth] Analysis aborted");
        } else {
          setError((e as Error).message);
        }
        setIsStreaming(false);
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
            <h1 className="text-xl font-semibold">Optimize Portfolio</h1>
            {hadBelowThreshold && (
              <p className="text-xs text-muted-foreground">
                Analyzing positions below {thresholdLabel}
              </p>
            )}
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

      {/* Streaming AI Reasoning Accordion */}
      {(isStreaming || streamingText) && (
        <StreamingAccordion
          id="ai-reasoning"
          title={`AI Reasoning${currentStage ? ` - ${stageMessages[currentStage] || currentStage}` : ""}`}
          text={streamingText}
          isStreaming={isStreaming}
          isComplete={isComplete}
          icon="brain"
          maxHeight="350px"
        />
      )}

      {/* Loading state (only show if not streaming yet) */}
      {loading && !isStreaming && !streamingText && (
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
          {/* Health summary */}
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Portfolio Health Summary</CardTitle>
                {typeof result.summary.health_score === "number" && (
                  <div className="text-sm font-semibold text-emerald-400">
                    Health Score: {result.summary.health_score.toFixed(0)}/100
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.isArray(result.summary.health_reasons) &&
                result.summary.health_reasons.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {result.summary.health_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              {result.summary.portfolio_diagnostics && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {typeof result.summary.portfolio_diagnostics
                    .total_losers_value === "number" && (
                    <p>
                      Total value in analyzed positions:{" "}
                      {result.summary.portfolio_diagnostics.total_losers_value.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 0 }
                      )}
                    </p>
                  )}
                  {typeof result.summary.portfolio_diagnostics
                    .avoid_weight_estimate_pct === "number" && (
                    <p>
                      Approx. share of these positions in avoid names:{" "}
                      {
                        result.summary.portfolio_diagnostics
                          .avoid_weight_estimate_pct
                      }
                      %
                    </p>
                  )}
                  {typeof result.summary.portfolio_diagnostics
                    .investable_weight_estimate_pct === "number" && (
                    <p>
                      Approx. share in ACE/KING:{" "}
                      {
                        result.summary.portfolio_diagnostics
                          .investable_weight_estimate_pct
                      }
                      %
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Renaissance rubric */}
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader>
              <CardTitle>Renaissance Criteria Context</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {result.criteria_context}
              </pre>
            </CardContent>
          </Card>

          {/* Plan variants if present */}
          {result.summary.plans && (
            <Card variant="none" effect="glass" showRipple={false}>
              <CardHeader>
                <CardTitle>Rebalance Plans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {(["minimal", "standard", "maximal"] as const).map((key) => {
                  const plan = result.summary.plans?.[key];
                  if (!plan?.actions || plan.actions.length === 0) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="font-semibold capitalize">
                        {key} plan
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {plan.actions!.map((a, idx) => (
                          <li key={idx}>
                            {a.symbol && <span className="font-medium">{a.symbol}</span>}
                            {a.action && ` — ${a.action}`}
                            {typeof a.current_weight_pct === "number" &&
                              typeof a.target_weight_pct === "number" && (
                                <> ({a.current_weight_pct.toFixed(1)}% → {a.target_weight_pct.toFixed(1)}%)</>
                              )}
                            {a.rationale && ` — ${a.rationale}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Portfolio-level takeaways */}
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader>
              <CardTitle>Portfolio-level Takeaways</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {(result.portfolio_level_takeaways || []).map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Per-position details */}
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader>
              <CardTitle>Positions Requiring Attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(result.losers || []).map((l, idx) => (
                <Card
                  key={idx}
                  variant="none"
                  effect="glass"
                  showRipple={false}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {l.symbol || "—"}
                        {l.renaissance_tier ? ` • ${l.renaissance_tier}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.action ? `Action: ${l.action}` : ""}
                      </div>
                    </div>
                    {typeof l.current_weight_pct === "number" &&
                      typeof l.target_weight_pct === "number" && (
                        <p className="text-xs text-muted-foreground">
                          Weight: {l.current_weight_pct.toFixed(1)}% →{" "}
                          {l.target_weight_pct.toFixed(1)}%
                        </p>
                      )}
                    {l.rationale && (
                      <p className="text-sm text-muted-foreground">
                        {l.rationale}
                      </p>
                    )}
                    {Array.isArray((l as any).replacement_candidates) &&
                      (l as any).replacement_candidates.length > 0 && (
                        <div className="text-sm">
                          <div className="font-medium mb-1">
                            Replacement candidates
                          </div>
                          <ul className="list-disc pl-5 text-muted-foreground">
                            {(l as any).replacement_candidates.map(
                              (c: any, j: number) => (
                                <li key={j}>
                                  {c.ticker}
                                  {c.tier ? ` (${c.tier})` : ""} —{" "}
                                  {c.why || ""}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
