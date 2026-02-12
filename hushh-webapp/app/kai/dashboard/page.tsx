"use client";

/**
 * Kai Main Page - Portfolio-First Onboarding
 *
 * Flow:
 * 1. Check if user has financial data in World Model
 * 2. If not, show portfolio import view
 * 3. After import, go directly to dashboard
 * 4. Dashboard shows KPIs, prime assets, and search bar for analysis
 *
 * No chat interface - pure UI component flow.
 */

import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import { KaiFlow, FlowState } from "@/components/kai/kai-flow";
import { KaiSearchBar } from "@/components/kai/kai-search-bar";
import { useState, useRef, useEffect } from "react";

export default function KaiPage() {
  const { user, loading: authLoading } = useAuth();
  const { vaultOwnerToken } = useVault();
  const [_holdings, setHoldings] = useState<string[]>([]);
  const [flowState, setFlowState] = useState<FlowState>("checking");
  const [initialized, setInitialized] = useState(false);
  
  // Ref to call KaiFlow's analyze function
  const _analyzeStockRef = useRef<((symbol: string) => void) | null>(null);

  const { registerSteps, completeStep, reset } = useStepProgress();

  // Consolidated init effect - handles auth check and flow state tracking
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Register steps only once
    if (!initialized) {
      registerSteps(2);
      setInitialized(true);
    }

    // Step 1: Auth check
    if (user) {
      completeStep();
    }

    return () => reset();
  }, [authLoading, user?.uid]);

  // Step 2: KaiFlow init (when flow state changes from "checking")
  // This is separate because flowState changes independently of auth
  useEffect(() => {
    if (initialized && flowState !== "checking") {
      completeStep();
    }
  }, [flowState, initialized]);



  // Show nothing while auth is loading
  if (authLoading || !user) {
    return null;
  }

  // NOTE: Vault check is handled by VaultLockGuard in the kai layout.
  // We trust the layout guard and don't duplicate the check here.
  // If we reach this point, the vault is guaranteed to be unlocked.

 
  // Update holdings when KaiFlow loads portfolio data
  const handleHoldingsUpdate = (newHoldings: string[]) => {
    setHoldings(newHoldings);
  };
 
  // Track flow state changes
  const handleStateChange = (state: FlowState) => {
    console.log("[Kai] Flow state:", state);
    setFlowState(state);
  };
 
  return (
    <div className="relative w-full">
      {/* Main Content - KaiFlow handles all states - Added pb-40 for search bar clearance */}
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6">
 
        <KaiFlow
          userId={user.uid}
          // Prefer in-memory token, but allow empty string as fallback.
          // KaiFlow and downstream services will handle 401s gracefully.
          vaultOwnerToken={vaultOwnerToken ?? ""}
          onStateChange={handleStateChange}
          onHoldingsLoaded={handleHoldingsUpdate}
        />
      </div>
 
      {/* Search Bar - Only show on dashboard state */}
      {flowState === "dashboard" && (
        <KaiSearchBar
          onCommand={(cmd, params) => {
            if (cmd === "analyze" && params?.symbol) {
              // Handle analyze command
              console.log("Analyze:", params.symbol);
            }
          }}
          holdings={[]} // Pass actual holdings if available
          disabled={false}
        />
      )}
    </div>
  );
}
