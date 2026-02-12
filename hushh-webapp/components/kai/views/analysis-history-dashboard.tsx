"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Search,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StockSearch } from "@/components/kai/views/stock-search";
import {
  KaiHistoryService,
  type AnalysisHistoryEntry,
  type AnalysisHistoryMap,
} from "@/lib/services/kai-history-service";

// ============================================================================
// Props
// ============================================================================

export interface AnalysisHistoryDashboardProps {
  userId: string;
  vaultKey: string;
  onSelectTicker: (ticker: string) => void;
  onViewHistory: (entry: AnalysisHistoryEntry) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/** Format ISO timestamp into a human-readable relative string */
function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  if (Number.isNaN(diffMs) || diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Map decision string to display color classes */
function decisionStyles(decision: string): {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
} {
  const d = decision.toLowerCase();
  if (d === "buy") {
    return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
      icon: <TrendingUp className="w-3 h-3" />,
    };
  }
  if (d === "reduce" || d === "sell") {
    return {
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/30",
      icon: <TrendingDown className="w-3 h-3" />,
    };
  }
  // hold / other
  return {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: <Minus className="w-3 h-3" />,
  };
}

/** Flatten AnalysisHistoryMap → sorted flat list (newest first) */
function flattenHistory(map: AnalysisHistoryMap): AnalysisHistoryEntry[] {
  const entries = Object.values(map).flat();
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ============================================================================
// Skeleton Card
// ============================================================================

function HistoryCardSkeleton() {
  return (
    <Card variant="none" effect="glass" showRipple={false} className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </Card>
  );
}

// ============================================================================
// History Card
// ============================================================================

function HistoryCard({
  entry,
  onClick,
}: {
  entry: AnalysisHistoryEntry;
  onClick: () => void;
}) {
  const styles = decisionStyles(entry.decision);
  const confidencePercent = Math.round(
    entry.confidence >= 1 ? entry.confidence : entry.confidence * 100
  );

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple
      interactive
      className="cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="space-y-3">
        {/* Top row: ticker + decision badge */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-black tracking-tight">{entry.ticker}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className="text-xs font-bold">{confidencePercent}%</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              styles.bg,
              styles.text,
              styles.border
            )}
          >
            {styles.icon}
            {entry.decision.toUpperCase()}
          </Badge>
        </div>

        {/* Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {entry.final_statement || "Analysis complete — tap to view details."}
        </p>

        {/* Bottom row: timestamp + consensus */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(entry.timestamp)}
          </span>
          {entry.consensus_reached && (
            <span className="text-emerald-500 font-medium">Consensus</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onSelectTicker }: { onSelectTicker: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
      <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
        <BarChart3 className="w-8 h-8 text-primary/60" />
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold">No analyses yet</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Search for a stock ticker below and let Agent Kai&apos;s multi-agent
          debate engine give you a data-driven recommendation.
        </p>
      </div>
      <StockSearch onSelect={onSelectTicker} className="w-full max-w-xs" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalysisHistoryDashboard({
  userId,
  vaultKey,
  onSelectTicker,
  onViewHistory,
}: AnalysisHistoryDashboardProps) {
  const [entries, setEntries] = useState<AnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const historyMap = await KaiHistoryService.getAllHistory({
        userId,
        vaultKey,
      });
      setEntries(flattenHistory(historyMap));
    } catch (err) {
      console.error("[AnalysisHistoryDashboard] Failed to load history:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId, vaultKey]);

  useEffect(() => {
    if (userId && vaultKey) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [userId, vaultKey, fetchHistory]);

  // ----- Loading state -----
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Search skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[250px] rounded-md" />
        </div>
        {/* Card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HistoryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ----- Empty state -----
  if (entries.length === 0) {
    return <EmptyState onSelectTicker={onSelectTicker} />;
  }

  // ----- Populated state -----
  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Analysis History
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            {entries.length}
          </Badge>
        </div>
        <StockSearch onSelect={onSelectTicker} />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map((entry, idx) => (
          <HistoryCard
            key={`${entry.ticker}-${entry.timestamp}-${idx}`}
            entry={entry}
            onClick={() => onViewHistory(entry)}
          />
        ))}
      </div>
    </div>
  );
}

export default AnalysisHistoryDashboard;
