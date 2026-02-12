"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Search,
  Heart,
  Calculator,
  AlertCircle,
} from "lucide-react";
import { AgentAnalysisCard } from "../agent-analysis-card";
import { cn } from "@/lib/morphy-ux";
import { Badge } from "@/components/ui/badge";
import type { AgentState } from "../debate-stream-view";

// ============================================================================
// Types
// ============================================================================

interface RoundTabsCardProps {
  roundNumber: number;
  title: string;
  description?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeAgent?: string; // "fundamental" | "sentiment" | "valuation"
  agentStates: Record<string, AgentState>;
  onTabChange?: (value: string) => void;
  className?: string;
}

// Agent ordering - always sequential
const AGENT_ORDER = ["fundamental", "sentiment", "valuation"] as const;

const AGENT_CONFIG = {
  fundamental: {
    label: "Fundamental",
    icon: <Search className="w-4 h-4" />,
    color: "text-blue-500",
    bgActive: "bg-blue-500",
    bgDot: "bg-blue-500",
  },
  sentiment: {
    label: "Sentiment",
    icon: <Heart className="w-4 h-4" />,
    color: "text-purple-500",
    bgActive: "bg-purple-500",
    bgDot: "bg-purple-500",
  },
  valuation: {
    label: "Valuation",
    icon: <Calculator className="w-4 h-4" />,
    color: "text-emerald-500",
    bgActive: "bg-emerald-500",
    bgDot: "bg-emerald-500",
  },
} as const;

// ============================================================================
// Component
// ============================================================================

export function RoundTabsCard({
  roundNumber,
  title,
  description,
  isCollapsed,
  onToggleCollapse,
  activeAgent,
  agentStates,
  onTabChange,
  className,
}: RoundTabsCardProps) {
  const [currentTab, setCurrentTab] = useState<string>("fundamental");

  // Auto-switch tab when active agent changes (only for the current round's active agent)
  useEffect(() => {
    if (activeAgent && AGENT_ORDER.includes(activeAgent as any)) {
      setCurrentTab(activeAgent);
    }
  }, [activeAgent]);

  // Also auto-switch when an agent becomes active
  useEffect(() => {
    for (const agent of AGENT_ORDER) {
      if (agentStates[agent]?.stage === "active") {
        setCurrentTab(agent);
        break;
      }
    }
  }, [
    agentStates.fundamental?.stage,
    agentStates.sentiment?.stage,
    agentStates.valuation?.stage,
  ]);

  const handleTabChange = (val: string) => {
    setCurrentTab(val);
    onTabChange?.(val);
  };

  const isRoundComplete = useMemo(() => {
    return AGENT_ORDER.every((agent) => agentStates[agent]?.stage === "complete");
  }, [agentStates]);

  const hasAnyError = useMemo(() => {
    return AGENT_ORDER.some((agent) => agentStates[agent]?.stage === "error");
  }, [agentStates]);

  const completedCount = useMemo(() => {
    return AGENT_ORDER.filter((agent) => agentStates[agent]?.stage === "complete").length;
  }, [agentStates]);

  const hasAnyActivity = useMemo(() => {
    return AGENT_ORDER.some(
      (agent) => agentStates[agent]?.stage === "active" || agentStates[agent]?.stage === "complete"
    );
  }, [agentStates]);

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple={false}
      className={cn(
        "w-full transition-all duration-200 border-l-4",
        isRoundComplete
          ? "border-l-emerald-500"
          : hasAnyError
          ? "border-l-amber-500"
          : hasAnyActivity
          ? "border-l-blue-500"
          : "border-l-border",
        className
      )}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors duration-200",
                isRoundComplete
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : hasAnyActivity
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-muted/30 text-muted-foreground"
              )}
            >
              {isRoundComplete ? <CheckCircle2 className="w-4 h-4" /> : roundNumber}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRoundComplete ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
              </Badge>
            ) : hasAnyActivity ? (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Clock className="w-3 h-3 mr-1 animate-pulse" /> {completedCount}/3
              </Badge>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="h-8 w-8 p-0">
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-3 pt-1">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 h-auto">
              {AGENT_ORDER.map((agent) => {
                const config = AGENT_CONFIG[agent];
                const state = agentStates[agent];
                const isAgentComplete = state?.stage === "complete";
                const isAgentActive = state?.stage === "active";
                const isAgentError = state?.stage === "error";

                return (
                  <TabsTrigger
                    key={agent}
                    value={agent}
                    className={cn(
                      "text-xs sm:text-sm flex items-center gap-1.5 py-2 relative transition-all duration-200",
                      isAgentComplete && "data-[state=active]:text-emerald-600"
                    )}
                  >
                    {/* Completion/Active indicator */}
                    {isAgentComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : isAgentError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ) : isAgentActive ? (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.bgDot)} />
                        <span className={cn("relative inline-flex rounded-full h-2 w-2", config.bgDot)} />
                      </span>
                    ) : null}
                    <span className="truncate">{config.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {AGENT_ORDER.map((agent) => {
              const config = AGENT_CONFIG[agent];
              return (
                <TabsContent key={agent} value={agent} className="mt-0 focus-visible:ring-0">
                  <AgentAnalysisCard
                    agentName={`${config.label} Agent`}
                    icon={config.icon}
                    color={config.color}
                    state={agentStates[agent] || { stage: "idle", text: "", thoughts: [] }}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
