/**
 * KaiSessionStore - Zustand store for cross-page Kai session state
 * ================================================================
 *
 * ZERO PERSISTENCE: No sessionStorage, no localStorage, no persist middleware.
 * All data lives only in React memory. On page refresh, user is redirected
 * to the dashboard to re-initiate their flow.
 *
 * This replaces:
 * - sessionStorage "kai_analysis_params" (leaked vaultOwnerToken!)
 * - sessionStorage "kai_losers_analysis_input"
 * - localStorage "lastKaiPath"
 */

import { create } from "zustand";

interface AnalysisParams {
  ticker: string;
  userId: string;
  riskProfile: string;
  userContext?: Record<string, unknown>;
}

interface LosersInput {
  userId: string;
  thresholdPct: number;
  maxPositions: number;
  losers: Array<Record<string, unknown>>;
  holdings?: Array<Record<string, unknown>>;
  forceOptimize?: boolean;
  hadBelowThreshold?: boolean;
}

interface KaiSessionState {
  /** Parameters for the current stock analysis */
  analysisParams: AnalysisParams | null;
  /** Input data for portfolio health / losers analysis */
  losersInput: LosersInput | null;
  /** Last visited Kai sub-path for navbar navigation */
  lastKaiPath: string;

  /** Set analysis parameters (replaces sessionStorage "kai_analysis_params") */
  setAnalysisParams: (params: AnalysisParams | null) => void;
  /** Set losers analysis input (replaces sessionStorage "kai_losers_analysis_input") */
  setLosersInput: (input: LosersInput | null) => void;
  /** Update last visited Kai path (replaces localStorage "lastKaiPath") */
  setLastKaiPath: (path: string) => void;
  /** Clear all session state */
  clear: () => void;
}

export const useKaiSession = create<KaiSessionState>((set) => ({
  analysisParams: null,
  losersInput: null,
  lastKaiPath: "/kai",

  setAnalysisParams: (params) => set({ analysisParams: params }),
  setLosersInput: (input) => set({ losersInput: input }),
  setLastKaiPath: (path) => set({ lastKaiPath: path }),
  clear: () => set({ analysisParams: null, losersInput: null }),
}));

export type { AnalysisParams, LosersInput, KaiSessionState };
