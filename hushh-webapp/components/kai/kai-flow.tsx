// components/kai/kai-flow.tsx

/**
 * Kai Flow - State-driven UI component flow for investment analysis
 *
 * Flow:
 * 1. Check World Model for financial data
 * 2. If no data -> Show portfolio import
 * 3. After import -> Show loser report (if losers exist)
 * 4. Then -> Portfolio overview with analysis options
 *
 * No chat interface - pure UI component flow.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { WorldModelService } from "@/lib/services/world-model-service";
import { PortfolioImportView } from "./views/portfolio-import-view";
import { LoserReportView } from "./views/loser-report-view";
import { PortfolioOverviewView } from "./views/portfolio-overview-view";
import { RiskProfileView, RiskProfile } from "./views/risk-profile-view";
import { useVault } from "@/lib/vault/vault-context";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

export type FlowState =
  | "checking"
  | "import_required"
  | "importing"
  | "import_complete"
  | "risk_profile"
  | "overview";

interface KaiFlowProps {
  userId: string;
  vaultOwnerToken: string;
  onStateChange?: (state: FlowState) => void;
  onHoldingsLoaded?: (holdings: string[]) => void;
}

interface Loser {
  symbol: string;
  name: string;
  gain_loss_pct: number;
  gain_loss: number;
  current_value: number;
}

interface Winner {
  symbol: string;
  name: string;
  gain_loss_pct: number;
  gain_loss: number;
  current_value: number;
}

interface FlowData {
  hasFinancialData: boolean;
  holdingsCount?: number;
  holdings?: string[];
  losers?: Loser[];
  winners?: Winner[];
  portfolioValue?: string;
  totalGainLossPct?: number;
  riskProfile?: RiskProfile;
  kpis?: Record<string, unknown>;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiFlow({
  userId,
  vaultOwnerToken,
  onStateChange,
  onHoldingsLoaded,
}: KaiFlowProps) {
  const { vaultKey } = useVault();
  const [state, setState] = useState<FlowState>("checking");
  const [flowData, setFlowData] = useState<FlowData>({
    hasFinancialData: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Check World Model for financial data on mount
  useEffect(() => {
    async function checkFinancialData() {
      try {
        setState("checking");

        // Fetch user's World Model metadata
        const metadata = await WorldModelService.getMetadata(userId);

        // Check if financial domain exists and has data
        const financialDomain = metadata.domains.find(
          (d) => d.key === "financial"
        );

        const hasFinancialData =
          financialDomain && financialDomain.attributeCount > 0;

        if (hasFinancialData) {
          // User has financial data - show overview
          setFlowData({
            hasFinancialData: true,
            holdingsCount: financialDomain.attributeCount,
          });
          setState("overview");
        } else {
          // No financial data - prompt for import
          setFlowData({ hasFinancialData: false });
          setState("import_required");
        }
      } catch (err) {
        console.error("[KaiFlow] Error checking financial data:", err);
        // Default to import_required on error (new user)
        setFlowData({ hasFinancialData: false });
        setState("import_required");
      }
    }

    checkFinancialData();
  }, [userId]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  // Notify parent of holdings loaded
  useEffect(() => {
    if (onHoldingsLoaded && flowData.holdings) {
      onHoldingsLoaded(flowData.holdings);
    }
  }, [flowData.holdings, onHoldingsLoaded]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!vaultKey) {
        setError("Vault key not available. Please unlock your vault.");
        return;
      }

      try {
        setState("importing");
        setError(null);

        // 1. Upload to backend for parsing (backend does NOT store)
        const ApiService = (await import("@/lib/services/api-service"))
          .ApiService;
        const response = await ApiService.importPortfolio({
          userId,
          file,
          vaultOwnerToken,
        });

        // Parse JSON response
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to parse portfolio");
        }

        // Check if we have portfolio data
        if (!result.portfolio_data) {
          throw new Error("No portfolio data returned from parser");
        }

        console.log("[KaiFlow] Portfolio parsed:", {
          holdings: result.holdings_count,
          losers: result.losers?.length || 0,
          source: result.source,
        });

        // 2. Encrypt portfolio data with user's vault key on client side
        const { HushhVault } = await import("@/lib/capacitor");

        const portfolioDataStr = JSON.stringify(result.portfolio_data);
        const encrypted = await HushhVault.encryptData({
          keyHex: vaultKey,
          plaintext: portfolioDataStr,
        });

        // 3. Store encrypted blob + metadata via WorldModelService
        await WorldModelService.storeDomainData({
          userId,
          domain: "financial",
          encryptedBlob: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            tag: encrypted.tag,
            algorithm: "aes-256-gcm",
          },
          summary: {
            has_portfolio: true,
            holdings_count: result.holdings_count,
            portfolio_value_bucket:
              result.portfolio_data?.kpis?.portfolio_value_bucket || "unknown",
            total_gain_loss_pct:
              result.portfolio_data?.kpis?.total_unrealized_gain_loss_pct || 0,
            risk_bucket: result.portfolio_data?.kpis?.risk_bucket || "moderate",
            imported_at: new Date().toISOString(),
            source: result.source,
          },
        });

        // 4. Extract holdings symbols for search bar
        const holdingSymbols =
          result.portfolio_data?.holdings?.map(
            (h: { symbol: string }) => h.symbol
          ) || [];

        // 5. Update flow data with results
        setFlowData({
          hasFinancialData: true,
          holdingsCount: result.holdings_count,
          holdings: holdingSymbols,
          losers: result.losers || [],
          winners: result.winners || [],
          portfolioValue:
            result.portfolio_data?.kpis?.portfolio_value_bucket || "unknown",
          totalGainLossPct:
            result.portfolio_data?.kpis?.total_unrealized_gain_loss_pct || 0,
          kpis: result.portfolio_data?.kpis,
        });

        toast.success(
          `Portfolio imported! Found ${result.holdings_count} holdings.`
        );

        // 6. Show loser report if there are losers, otherwise go to overview
        if (result.losers && result.losers.length > 0) {
          setState("import_complete");
        } else {
          setState("overview");
        }
      } catch (err) {
        console.error("[KaiFlow] Import error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to import portfolio. Please try again."
        );
        setState("import_required");
      }
    },
    [userId, vaultOwnerToken, vaultKey]
  );

  // Handle skip import
  const handleSkipImport = useCallback(() => {
    setState("overview");
    setFlowData({ hasFinancialData: false });
  }, []);

  // Handle view portfolio overview
  const handleViewOverview = useCallback(() => {
    setState("overview");
  }, []);

  // Handle re-import
  const handleReimport = useCallback(() => {
    setState("import_required");
  }, []);

  // Handle analyze stock
  const handleAnalyzeStock = useCallback((symbol?: string) => {
    if (!symbol) {
      toast.info("Enter a stock symbol to analyze");
      return;
    }
    console.log("[KaiFlow] Analyze stock:", symbol);
    toast.info(`Analyzing ${symbol}...`);
    // TODO: Implement stock analysis view
  }, []);

  // Handle analyze all losers
  const handleAnalyzeAll = useCallback(() => {
    console.log("[KaiFlow] Analyze all losers");
    toast.info("Analyzing all underperforming positions...");
    // TODO: Implement batch analysis
  }, []);

  // Handle risk profile selection
  const handleRiskProfileSelect = useCallback(
    async (profile: RiskProfile) => {
      try {
        // Update flow data
        setFlowData((prev) => ({ ...prev, riskProfile: profile }));

        // Store risk profile in World Model summary
        await WorldModelService.storeDomainData({
          userId,
          domain: "financial",
          encryptedBlob: {
            ciphertext: "", // Risk profile is stored in summary, not encrypted blob
            iv: "",
            tag: "",
            algorithm: "aes-256-gcm",
          },
          summary: {
            risk_profile: profile,
            updated_at: new Date().toISOString(),
          },
        });

        toast.success(`Risk profile set to ${profile}`);
        setState("overview");
      } catch (err) {
        console.error("[KaiFlow] Error saving risk profile:", err);
        toast.error("Failed to save risk profile");
        setState("overview");
      }
    },
    [userId]
  );

  // Handle skip risk profile
  const handleSkipRiskProfile = useCallback(() => {
    setState("overview");
  }, []);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (state === "checking") {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <HushhLoader variant="inline" label="Checking your portfolio..." />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* State-based rendering */}
      {state === "import_required" && (
        <PortfolioImportView
          onFileSelect={handleFileUpload}
          onSkip={handleSkipImport}
          isUploading={false}
        />
      )}

      {state === "importing" && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <HushhLoader variant="inline" label="Parsing your portfolio..." />
          <p className="text-sm text-muted-foreground">
            Extracting holdings, calculating KPIs, identifying losers...
          </p>
        </div>
      )}

      {state === "import_complete" &&
        flowData.losers &&
        flowData.losers.length > 0 && (
          <LoserReportView
            losers={flowData.losers}
            totalLoss={flowData.losers.reduce((sum, l) => sum + l.gain_loss, 0)}
            onAnalyzeStock={handleAnalyzeStock}
            onAnalyzeAll={handleAnalyzeAll}
            onContinue={handleViewOverview}
          />
        )}

      {state === "import_complete" &&
        (!flowData.losers || flowData.losers.length === 0) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Portfolio Looks Healthy!</h2>
            <p className="text-muted-foreground mb-6">
              No significant losers found. Found {flowData.holdingsCount}{" "}
              holdings.
            </p>
            <button
              onClick={handleViewOverview}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              View Portfolio Overview
            </button>
          </div>
        )}

      {state === "risk_profile" && (
        <RiskProfileView
          onSelect={handleRiskProfileSelect}
          onSkip={handleSkipRiskProfile}
          currentProfile={flowData.riskProfile}
        />
      )}

      {state === "overview" && (
        <PortfolioOverviewView
          holdingsCount={flowData.holdingsCount || 0}
          portfolioValue={flowData.portfolioValue}
          totalGainLossPct={flowData.totalGainLossPct}
          losersCount={flowData.losers?.length || 0}
          winnersCount={flowData.winners?.length || 0}
          kpis={flowData.kpis}
          onReviewLosers={() => {
            if (flowData.losers && flowData.losers.length > 0) {
              setState("import_complete");
            } else {
              toast.info("No losers to review");
            }
          }}
          onImportNew={handleReimport}
          onSettings={() => {
            // Navigate to settings via window location
            window.location.href = "/dashboard/kai/preferences";
          }}
          onAnalyzeStock={handleAnalyzeStock}
        />
      )}
    </div>
  );
}
