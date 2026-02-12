// app/kai/dashboard/analysis/page.tsx

/**
 * Kai Analysis Hub — Two-state client-side toggle
 *
 * State 1 (no params):  AnalysisHistoryDashboard
 * State 2 (with params): DebateStreamView (live streaming analysis)
 *
 * No complex routing — analysisParams in Zustand drives the switch.
 */

"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { useKaiSession } from "@/lib/stores/kai-session-store";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { AnalysisHistoryDashboard } from "@/components/kai/views/analysis-history-dashboard";
import { DebateStreamView } from "@/components/kai/debate-stream-view";
import type { AnalysisHistoryEntry } from "@/lib/services/kai-history-service";

export default function KaiAnalysisPage() {
  const { user, userId } = useAuth();
  const { vaultKey, vaultOwnerToken } = useVault();
  const analysisParams = useKaiSession((s) => s.analysisParams);
  const setAnalysisParams = useKaiSession((s) => s.setAnalysisParams);

  // ---- Callbacks for AnalysisHistoryDashboard ----

  /** User picked a ticker from search — start a new analysis */
  const handleSelectTicker = useCallback(
    (ticker: string) => {
      if (!userId) return;
      setAnalysisParams({
        ticker,
        userId,
        riskProfile: "balanced",
      });
    },
    [userId, setAnalysisParams],
  );

  /** User tapped a previous analysis card — re-run analysis for that ticker */
  const handleViewHistory = useCallback(
    (entry: AnalysisHistoryEntry) => {
      if (!userId) return;
      setAnalysisParams({
        ticker: entry.ticker,
        userId,
        riskProfile: "balanced",
      });
    },
    [userId, setAnalysisParams],
  );

  /** Close / back from DebateStreamView → clear params → return to State 1 */
  const handleClose = useCallback(() => {
    setAnalysisParams(null);
  }, [setAnalysisParams]);

  // ---- Loading gate ----

  if (!user || !userId || !vaultKey) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <HushhLoader variant="inline" label="Preparing analysis hub…" />
      </div>
    );
  }

  // ---- State 2: Active analysis ----

  if (analysisParams) {
    return (
      <DebateStreamView
        ticker={analysisParams.ticker}
        userId={analysisParams.userId}
        riskProfile={analysisParams.riskProfile}
        vaultOwnerToken={vaultOwnerToken || ""}
        vaultKey={vaultKey}
        onClose={handleClose}
      />
    );
  }

  // ---- State 1: History dashboard ----

  return (
    <AnalysisHistoryDashboard
      userId={userId}
      vaultKey={vaultKey}
      onSelectTicker={handleSelectTicker}
      onViewHistory={handleViewHistory}
    />
  );
}
