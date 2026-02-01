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
import { HushhLoader } from "@/components/ui/hushh-loader";
import { KaiFlow, FlowState } from "@/components/kai/kai-flow";
import { KaiSearchBar } from "@/components/kai/kai-search-bar";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useCallback, useRef } from "react";

export default function KaiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked, vaultOwnerToken } = useVault();
  const [holdings, setHoldings] = useState<string[]>([]);
  const [flowState, setFlowState] = useState<FlowState>("checking");
  
  // Ref to call KaiFlow's analyze function
  const analyzeStockRef = useRef<((symbol: string) => void) | null>(null);

  // Loading state while auth/vault initializes
  if (!user) {
    return (
      <HushhLoader
        variant="fullscreen"
        label="Loading..."
        className="backdrop-blur-sm"
      />
    );
  }

  // Vault must be unlocked to use Kai
  if (!isVaultUnlocked || !vaultKey || !vaultOwnerToken) {
    return (
      <div className="min-h-[calc(100dvh-120px)] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Unlock Your Vault</h2>
          <p className="text-muted-foreground">
            Your vault must be unlocked to access Kai. Your financial data is
            encrypted with your personal key.
          </p>
        </div>
      </div>
    );
  }

  // Handle search bar commands
  const handleCommand = (command: string, params?: Record<string, unknown>) => {
    console.log("[Kai] Command:", command, params);

    if (command === "analyze" && params?.symbol) {
      // Trigger analysis via KaiFlow
      if (analyzeStockRef.current) {
        analyzeStockRef.current(params.symbol as string);
      } else {
        toast.info(`Analyzing ${params.symbol}...`);
      }
    } else if (command === "open_settings") {
      router.push("/dashboard/kai/preferences");
    }
  };

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
    <div className="min-h-[calc(100dvh-120px)] relative pb-32">
      {/* Main Content - KaiFlow handles all states */}
      <div className="w-full h-full p-6">
        <KaiFlow
          userId={user.uid}
          vaultOwnerToken={vaultOwnerToken}
          onStateChange={handleStateChange}
          onHoldingsLoaded={handleHoldingsUpdate}
        />
      </div>

      {/* Search Bar - Only show on dashboard state */}
      {flowState === "dashboard" && (
        <KaiSearchBar
          onCommand={handleCommand}
          holdings={holdings}
          disabled={false}
        />
      )}
    </div>
  );
}
