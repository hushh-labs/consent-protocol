"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, RefreshCw, X, WifiOff, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";
import { setKaiVaultOwnerToken } from "@/lib/services/kai-service";
import { KaiHistoryService } from "@/lib/services/kai-history-service";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { DecisionCard } from "./views/decision-card";
import { RoundTabsCard } from "./views/round-tabs-card";
import { toast } from "sonner";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

export interface AgentState {
  stage: "idle" | "active" | "complete" | "error";
  text: string;
  thoughts: string[];
  error?: string;
  // Rich data from agent_complete
  recommendation?: string;
  confidence?: number;
  metrics?: Record<string, any>;
  sources?: string[];
  // Fundamental-specific
  keyMetrics?: Record<string, any>;
  quantMetrics?: Record<string, any>;
  businessMoat?: string;
  financialResilience?: string;
  growthEfficiency?: string;
  bullCase?: string;
  bearCase?: string;
  // Sentiment-specific
  sentimentScore?: number;
  keyCatalysts?: string[];
  // Valuation-specific
  valuationMetrics?: Record<string, any>;
  peerComparison?: Record<string, any>;
  priceTargets?: Record<string, any>;
}

const INITIAL_AGENT_STATE: AgentState = {
  stage: "idle",
  text: "",
  thoughts: [],
};

const INITIAL_ROUND_STATE: Record<string, AgentState> = {
  fundamental: { ...INITIAL_AGENT_STATE },
  sentiment: { ...INITIAL_AGENT_STATE },
  valuation: { ...INITIAL_AGENT_STATE },
};

// ============================================================================
// Error Classification
// ============================================================================

type ErrorType = "rate_limit" | "auth_expired" | "server_error" | "connection_lost" | "unknown";

function classifyError(status: number | null, message: string): ErrorType {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth_expired";
  if (status && status >= 500) return "server_error";
  if (message.includes("fetch") || message.includes("network") || message.includes("abort")) return "connection_lost";
  return "unknown";
}

function getErrorDisplay(errorType: ErrorType, retryIn?: number): { icon: React.ReactNode; title: string; message: string } {
  switch (errorType) {
    case "rate_limit":
      return {
        icon: <Clock className="w-8 h-8 text-amber-500" />,
        title: "Rate Limit Reached",
        message: retryIn ? `Too many requests. Retrying in ${retryIn}s...` : "Too many requests. Please try again in a moment.",
      };
    case "auth_expired":
      return {
        icon: <ShieldAlert className="w-8 h-8 text-red-500" />,
        title: "Session Expired",
        message: "Your session has expired. Please re-authenticate to continue.",
      };
    case "server_error":
      return {
        icon: <AlertCircle className="w-8 h-8 text-red-500" />,
        title: "Server Error",
        message: retryIn ? `Server encountered an error. Retrying in ${retryIn}s...` : "Server error. Please try again.",
      };
    case "connection_lost":
      return {
        icon: <WifiOff className="w-8 h-8 text-orange-500" />,
        title: "Connection Lost",
        message: "Lost connection to the analysis server.",
      };
    default:
      return {
        icon: <AlertCircle className="w-8 h-8 text-red-500" />,
        title: "Analysis Interrupted",
        message: "An unexpected error occurred.",
      };
  }
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff

// ============================================================================
// Component
// ============================================================================

interface DebateStreamViewProps {
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  vaultKey?: string;
  onClose: () => void;
}

export function DebateStreamView({ ticker, userId, riskProfile: riskProfileProp, vaultOwnerToken, vaultKey, onClose }: DebateStreamViewProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("unknown");
  const [kaiThinking, setKaiThinking] = useState<string>("Initializing...");
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Rounds
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const [round1States, setRound1States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );
  const [round2States, setRound2States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );

  // UI Control
  const [activeAgent, setActiveAgent] = useState("fundamental");
  const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({ 1: false, 2: true });

  const [decision, setDecision] = useState<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to update specific agent state in current round
  const updateAgentState = useCallback((round: 1 | 2, agent: string, update: Partial<AgentState>) => {
    const setter = round === 1 ? setRound1States : setRound2States;
    setter((prev) => {
      const currentState = prev[agent];
      if (!currentState) return prev;
      return {
        ...prev,
        [agent]: { ...currentState, ...update },
      };
    });
  }, []);

  // Handle close - ensuring ABORT
  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    onClose();
  }, [onClose]);

  // Reset state for retry
  const resetState = useCallback(() => {
    setLoading(true);
    setError(null);
    setErrorType("unknown");
    setKaiThinking("Initializing...");
    setActiveRound(1);
    setRound1States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setRound2States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setActiveAgent("fundamental");
    setCollapsedRounds({ 1: false, 2: true });
    setDecision(null);
    setRetryCountdown(null);
  }, []);

  // Start stream with retry logic
  const startStream = useCallback(
    async (isRetry = false) => {
      if (!isRetry && hasStartedRef.current) return;
      hasStartedRef.current = true;

      // Ensure token is set for service layer
      if (vaultOwnerToken) {
        setKaiVaultOwnerToken(vaultOwnerToken);
      }

      try {
        if (!isRetry) {
          setLoading(true);
          setError(null);
        }
        abortControllerRef.current = new AbortController();

        // Context is no longer stored in sessionStorage (orphaned read removed)
        const context = null;

        const riskProfile = riskProfileProp || "balanced";

        // Start SSE connection
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
              context: context,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const status = response.status;
          const errType = classifyError(status, "");

          // Auto-retry for retryable errors
          if ((errType === "rate_limit" || errType === "server_error") && retryCountRef.current < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCountRef.current] || 8000;
            retryCountRef.current++;
            const seconds = Math.ceil(delay / 1000);
            setRetryCountdown(seconds);
            setErrorType(errType);
            setKaiThinking(`${errType === "rate_limit" ? "Rate limited" : "Server error"}. Retrying in ${seconds}s...`);

            // Countdown timer
            let countdown = seconds;
            const countdownInterval = setInterval(() => {
              countdown--;
              setRetryCountdown(countdown);
              if (countdown <= 0) {
                clearInterval(countdownInterval);
              }
            }, 1000);

            retryTimerRef.current = setTimeout(() => {
              clearInterval(countdownInterval);
              setRetryCountdown(null);
              startStream(true);
            }, delay);
            return;
          }

          throw new Error(`API error: ${status}`);
        }

        // Reset retry count on successful connection
        retryCountRef.current = 0;
        setLoading(false);
        setRetryCountdown(null);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No stream content");

        const decoder = new TextDecoder();
        let buffer = "";
        let currentEventType = "message";
        let currentPhase = "analysis";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (line.startsWith("event:")) {
              currentEventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              try {
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;

                const data = JSON.parse(jsonStr);

                switch (currentEventType) {
                  case "kai_thinking":
                    setKaiThinking(data.message || data.data?.message);

                    // Detect Phase Change for Round Switching
                    if (data.phase === "debate" && currentPhase !== "debate") {
                      currentPhase = "debate";
                      setActiveRound(2);
                      setCollapsedRounds({ 1: true, 2: false });
                      toast.info("Entering Round 2: Debate & Rebuttal");
                    }
                    break;

                  case "agent_start":
                    setActiveAgent(data.agent);
                    {
                      const targetRound: 1 | 2 = currentPhase === "debate" || data.phase === "round2" ? 2 : 1;
                      updateAgentState(targetRound, data.agent, { stage: "active" });
                    }
                    break;

                  case "agent_token":
                    {
                      const r = currentPhase === "debate" ? 2 : 1;
                      const ag = data.agent;
                      const txt = data.text || "";
                      const setter = r === 1 ? setRound1States : setRound2States;
                      setter((prev) => ({
                        ...prev,
                        [ag]: {
                          ...prev[ag],
                          text: (prev[ag]?.text || "") + txt,
                        },
                      }));
                    }
                    break;

                  case "agent_complete":
                    {
                      const r: 1 | 2 = currentPhase === "debate" ? 2 : 1;
                      updateAgentState(r, data.agent, {
                        stage: "complete",
                        text: data.summary || "",
                        thoughts: [],
                        // Common fields
                        recommendation: data.recommendation,
                        confidence: data.confidence,
                        sources: data.sources,
                        // Fundamental-specific
                        keyMetrics: data.key_metrics,
                        quantMetrics: data.quant_metrics,
                        businessMoat: data.business_moat,
                        financialResilience: data.financial_resilience,
                        growthEfficiency: data.growth_efficiency,
                        bullCase: data.bull_case,
                        bearCase: data.bear_case,
                        // Sentiment-specific
                        sentimentScore: data.sentiment_score,
                        keyCatalysts: data.key_catalysts,
                        // Valuation-specific
                        valuationMetrics: data.valuation_metrics,
                        peerComparison: data.peer_comparison,
                        priceTargets: data.price_targets,
                      });
                    }
                    break;

                  case "debate_round":
                    // Round metadata -- handled structurally by phase switching
                    break;

                  case "agent_error":
                    {
                      const r: 1 | 2 = currentPhase === "debate" ? 2 : 1;
                      const errMsg = data.error || "Agent analysis failed";
                      updateAgentState(r, data.agent, {
                        stage: "error",
                        error: errMsg,
                      });
                      toast.error(`${data.agent} encountered an error`, {
                        description: errMsg.length > 100 ? errMsg.slice(0, 100) + "..." : errMsg,
                      });
                    }
                    break;

                  case "decision":
                    setDecision(data);
                    setKaiThinking("Analysis Complete.");
                    // Auto-collapse Round 2 when decision arrives
                    setCollapsedRounds({ 1: true, 2: true });
                    // Save to analysis history (fire-and-forget)
                    if (vaultKey && userId) {
                      KaiHistoryService.saveAnalysis({
                        userId,
                        vaultKey,
                        vaultOwnerToken,
                        entry: {
                          ticker: ticker.toUpperCase(),
                          timestamp: new Date().toISOString(),
                          decision: data.decision || "hold",
                          confidence: data.confidence || 0,
                          consensus_reached: data.consensus_reached ?? false,
                          agent_votes: data.agent_votes || {},
                          final_statement: data.final_statement || "",
                          raw_card: data.raw_card || {},
                        },
                      }).then(() => {
                        // Invalidate caches after decision is persisted
                        const cache = CacheService.getInstance();
                        cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, ticker.toUpperCase()));
                        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, "kai_analysis_history"));
                      }).catch((e) => console.warn("[DebateStreamView] History save failed:", e));
                    }
                    break;

                  case "error":
                    {
                      const errMsg = data.message || "Analysis failed";
                      const errType = classifyError(null, errMsg);

                      // Attempt retry for server-side errors
                      if ((errType === "rate_limit" || errType === "server_error") && retryCountRef.current < MAX_RETRIES) {
                        const delay = RETRY_DELAYS[retryCountRef.current] || 8000;
                        retryCountRef.current++;
                        const seconds = Math.ceil(delay / 1000);
                        setRetryCountdown(seconds);
                        setErrorType(errType);
                        setKaiThinking(`Error encountered. Retrying in ${seconds}s...`);

                        retryTimerRef.current = setTimeout(() => {
                          setRetryCountdown(null);
                          resetState();
                          hasStartedRef.current = false;
                          startStream(true);
                        }, delay);
                        return;
                      }

                      setError(errMsg);
                      setErrorType(errType);
                    }
                    break;
                }
              } catch (e) {
                // Gracefully skip malformed JSON events
                console.warn("[DebateStreamView] JSON Parse Error on line:", line, e);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream aborted by user");
          return;
        }

        console.error("Stream error:", err);
        const errMsg = err.message || "Connection failed";
        const errType = classifyError(null, errMsg);

        // Auto-retry for connection errors (once)
        if (errType === "connection_lost" && retryCountRef.current < 1) {
          retryCountRef.current++;
          setKaiThinking("Connection lost. Reconnecting...");
          retryTimerRef.current = setTimeout(() => {
            hasStartedRef.current = false;
            startStream(true);
          }, 2000);
          return;
        }

        setError(errMsg);
        setErrorType(errType);
      } finally {
        setLoading(false);
      }
    },
    [ticker, userId, vaultOwnerToken, riskProfileProp, updateAgentState, resetState]
  );

  // Effect to start stream on mount
  useEffect(() => {
    startStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [startStream]);

  // -------------- RENDER ----------------

  // Error state with classified display
  if (error) {
    const display = getErrorDisplay(errorType, retryCountdown ?? undefined);
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <Card variant="none" effect="glass" showRipple={false} className="max-w-md w-full">
          <CardContent className="p-8 flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-muted/30">{display.icon}</div>
            <h3 className="text-lg font-semibold text-center">{display.title}</h3>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            {retryCountdown !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Retrying in {retryCountdown}s...</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {errorType !== "auth_expired" && (
                <Button
                  onClick={() => {
                    retryCountRef.current = 0;
                    resetState();
                    hasStartedRef.current = false;
                    startStream();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </Button>
              )}
              {errorType === "auth_expired" && (
                <Button onClick={onClose}>
                  <ShieldAlert className="w-4 h-4 mr-2" /> Re-authenticate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Header - Masked gradient + hero ticker */}
      <div className="flex-none sticky top-0 z-10 overflow-hidden">
        {/* Masked gradient background */}
        <div
          className="absolute inset-0 morphy-app-bg opacity-80"
          style={{ maskImage: "linear-gradient(to bottom, black 60%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)" }}
        />
        <div className="absolute inset-0 backdrop-blur-md bg-background/40" />

        {/* Content */}
        <div className="relative px-4 pt-3 pb-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
            <span className="hover:text-foreground transition-colors cursor-pointer">Kai</span>
            <span>/</span>
            <span className="hover:text-foreground transition-colors cursor-pointer">Dashboard</span>
            <span>/</span>
            <span className="text-foreground font-medium">Analysis</span>
          </div>

          {/* Hero row: Ticker + status + close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter text-foreground">{ticker}</h1>
              {/* Status badge */}
              {decision ? (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                </Badge>
              ) : loading ? (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-medium">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {kaiThinking}
                </Badge>
              ) : retryCountdown !== null ? (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Retry in {retryCountdown}s
                </Badge>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0 rounded-full h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State for Initial Connect */}
      {loading && !decision && activeRound === 1 && round1States.fundamental?.stage === "idle" && (
        <div className="p-8 flex justify-center">
          <HushhLoader variant="inline" label="Connecting to agents..." />
        </div>
      )}

      {/* Content - Scrollable */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 pb-10 max-w-3xl mx-auto">
          {/* Round 1 */}
          <RoundTabsCard
            roundNumber={1}
            title="Initial Deep Analysis"
            description="Agents analyze raw data independently."
            isCollapsed={collapsedRounds[1] || false}
            onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 1: !prev[1] }))}
            activeAgent={activeRound === 1 ? activeAgent : undefined}
            agentStates={round1States}
            onTabChange={setActiveAgent}
          />

          {/* Round 2 - Only show if started */}
          {(activeRound >= 2 || decision) && (
            <RoundTabsCard
              roundNumber={2}
              title="Strategic Debate"
              description="Agents challenge and refine positions."
              isCollapsed={collapsedRounds[2] || false}
              onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 2: !prev[2] }))}
              activeAgent={activeRound === 2 ? activeAgent : undefined}
              agentStates={round2States}
              onTabChange={setActiveAgent}
            />
          )}

          {/* Final Decision */}
          {decision && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <DecisionCard result={decision} />
            </div>
          )}

          {/* Spacer for bottom */}
          <div className="h-10" />
        </div>
      </ScrollArea>
    </div>
  );
}
