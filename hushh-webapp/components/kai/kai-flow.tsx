// components/kai/kai-flow.tsx

/**
 * Kai Flow - State-driven UI component flow for investment analysis
 *
 * Flow:
 * 1. Check World Model for financial data
 * 2. If no data -> Show portfolio import
 * 3. After import -> Show streaming progress -> Review screen -> Dashboard
 * 4. Dashboard shows KPIs, prime assets, and search bar for analysis
 *
 * No chat interface - pure UI component flow.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { WorldModelService } from "@/lib/services/world-model-service";
import { PortfolioImportView } from "./views/portfolio-import-view";
import { ImportProgressView, ImportStage } from "./views/import-progress-view";
import { PortfolioReviewView, PortfolioData as ReviewPortfolioData } from "./views/portfolio-review-view";
import { DashboardView, PortfolioData } from "./views/dashboard-view";
import { AnalysisView } from "./views/analysis-view";
import { useVault } from "@/lib/vault/vault-context";
import { toast } from "sonner";
import { getDirectBackendUrl } from "@/lib/services/api-service";

// =============================================================================
// TYPES
// =============================================================================

export type FlowState =
  | "checking"
  | "import_required"
  | "importing"       // Streaming progress view
  | "reviewing"       // Review parsed data before saving
  | "dashboard"       // Main view with KPIs and prime assets
  | "analysis";       // Stock analysis results

interface KaiFlowProps {
  userId: string;
  vaultOwnerToken: string;
  onStateChange?: (state: FlowState) => void;
  onHoldingsLoaded?: (holdings: string[]) => void;
}

interface AnalysisResult {
  symbol: string;
  decision: "BUY" | "HOLD" | "REDUCE";
  confidence: number;
  summary: string;
  fundamentalInsights?: string;
  sentimentInsights?: string;
  valuationInsights?: string;
}

interface FlowData {
  hasFinancialData: boolean;
  holdingsCount?: number;
  holdings?: string[];
  portfolioData?: PortfolioData;
  analysisResult?: AnalysisResult;
  parsedPortfolio?: ReviewPortfolioData; // Parsed but not yet saved
}

// Streaming state
interface StreamingState {
  stage: ImportStage;
  streamedText: string;
  totalChars: number;
  chunkCount: number;
  errorMessage?: string;
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
  const router = useRouter();
  const { vaultKey } = useVault();
  const [state, setState] = useState<FlowState>("checking");
  const [flowData, setFlowData] = useState<FlowData>({
    hasFinancialData: false,
  });
  const [error, setError] = useState<string | null>(null);
  
  // Streaming state for real-time progress
  const [streaming, setStreaming] = useState<StreamingState>({
    stage: "idle",
    streamedText: "",
    totalChars: 0,
    chunkCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

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
          // Try to get cached portfolio data from session storage
          const cachedData = sessionStorage.getItem("kai_portfolio_data");
          let portfolioData: PortfolioData | undefined;
          
          if (cachedData) {
            portfolioData = JSON.parse(cachedData);
          } else if (vaultKey) {
            // No cache - try to decrypt from World Model
            console.log("[KaiFlow] No cache, attempting to decrypt from World Model...");
            try {
              const encryptedData = await WorldModelService.getDomainData(userId, "financial");
              
              if (encryptedData) {
                const { HushhVault } = await import("@/lib/capacitor");
                const decrypted = await HushhVault.decryptData({
                  payload: {
                    ciphertext: encryptedData.ciphertext,
                    iv: encryptedData.iv,
                    tag: encryptedData.tag,
                    encoding: "base64",
                    algorithm: encryptedData.algorithm as "aes-256-gcm" || "aes-256-gcm",
                  },
                  keyHex: vaultKey,
                });
                
                // Parse decrypted data - it may contain multiple domains
                const allData = JSON.parse(decrypted.plaintext);
                
                // Extract financial domain data
                // The structure could be { financial: {...} } or direct portfolio data
                portfolioData = allData.financial || allData;
                
                // Re-cache for quick access
                sessionStorage.setItem("kai_portfolio_data", JSON.stringify(portfolioData));
                console.log("[KaiFlow] Successfully decrypted and cached portfolio data");
              }
            } catch (decryptError) {
              console.error("[KaiFlow] Failed to decrypt from World Model:", decryptError);
              // Continue without portfolio data - user can re-import
            }
          }

          // User has financial data - show dashboard
          setFlowData({
            hasFinancialData: true,
            holdingsCount: financialDomain.attributeCount,
            portfolioData,
            holdings: portfolioData?.holdings?.map(h => h.symbol) || [],
          });
          setState("dashboard");
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
  }, [userId, vaultKey]);

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

  // Handle file upload with SSE streaming
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!vaultKey) {
        setError("Vault key not available. Please unlock your vault.");
        return;
      }

      try {
        setState("importing");
        setError(null);
        
        // Reset streaming state
        setStreaming({
          stage: "uploading",
          streamedText: "",
          totalChars: 0,
          chunkCount: 0,
        });

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        // Build form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", userId);

        // Use SSE streaming endpoint with tri-flow compliant URL
        const baseUrl = getDirectBackendUrl();
        const response = await fetch(`${baseUrl}/api/kai/portfolio/import/stream`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vaultOwnerToken}`,
          },
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream available");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullStreamedText = "";
        let parsedPortfolio: ReviewPortfolioData | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                // Handle different stages
                if (data.stage === "uploading") {
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "uploading",
                  }));
                } else if (data.stage === "analyzing") {
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "analyzing",
                  }));
                } else if (data.stage === "streaming") {
                  // Accumulate streamed text
                  if (data.text) {
                    fullStreamedText += data.text;
                  }
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "streaming",
                    streamedText: fullStreamedText,
                    totalChars: data.total_chars || prev.totalChars,
                    chunkCount: data.chunk_count || prev.chunkCount,
                  }));
                } else if (data.stage === "parsing") {
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "parsing",
                  }));
                } else if (data.stage === "complete" && data.portfolio_data) {
                  // Store parsed portfolio for review
                  parsedPortfolio = data.portfolio_data;
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "complete",
                  }));
                } else if (data.stage === "error") {
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "error",
                    errorMessage: data.message,
                  }));
                  throw new Error(data.message);
                }
              } catch (parseError) {
                // Ignore JSON parse errors for incomplete chunks
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }

        // Check if we got portfolio data
        if (!parsedPortfolio) {
          throw new Error("No portfolio data received from parser");
        }

        console.log("[KaiFlow] Portfolio parsed via streaming:", {
          holdings: parsedPortfolio.holdings?.length || 0,
        });

        // Store parsed portfolio and transition to review state
        setFlowData((prev) => ({
          ...prev,
          parsedPortfolio,
        }));

        // Go to review screen instead of directly to dashboard
        setState("reviewing");
        toast.success("Portfolio parsed! Please review before saving.");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[KaiFlow] Import cancelled by user");
          setState("import_required");
          return;
        }

        console.error("[KaiFlow] Import error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to import portfolio. Please try again."
        );
        setStreaming((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        }));
        setState("import_required");
      }
    },
    [userId, vaultOwnerToken, vaultKey]
  );

  // Handle cancel import
  const handleCancelImport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState("import_required");
    setStreaming({
      stage: "idle",
      streamedText: "",
      totalChars: 0,
      chunkCount: 0,
    });
  }, []);

  // Handle save complete from review screen
  const handleSaveComplete = useCallback((savedData: ReviewPortfolioData) => {
    // Convert to dashboard format and update flow data
    // Map the review types to dashboard types
    const portfolioData: PortfolioData = {
      account_info: savedData.account_info ? {
        account_number: savedData.account_info.account_number,
        brokerage_name: savedData.account_info.brokerage,
        account_holder: savedData.account_info.holder_name,
      } : undefined,
      account_summary: savedData.account_summary ? {
        beginning_value: savedData.account_summary.beginning_value,
        ending_value: savedData.account_summary.ending_value || 0,
        change_in_value: savedData.account_summary.change_in_value,
        cash_balance: savedData.account_summary.cash_balance,
        equities_value: savedData.account_summary.equities_value,
      } : undefined,
      holdings: savedData.holdings,
      transactions: [],
      asset_allocation: savedData.asset_allocation ? {
        cash_percent: savedData.asset_allocation.cash_pct,
        equities_percent: savedData.asset_allocation.equities_pct,
        bonds_percent: savedData.asset_allocation.bonds_pct,
      } : undefined,
      income_summary: savedData.income_summary ? {
        dividends: savedData.income_summary.dividends_taxable,
        interest: savedData.income_summary.interest_income,
        total: savedData.income_summary.total_income,
      } : undefined,
      realized_gain_loss: savedData.realized_gain_loss ? {
        short_term: savedData.realized_gain_loss.short_term_gain,
        long_term: savedData.realized_gain_loss.long_term_gain,
        total: savedData.realized_gain_loss.net_realized,
      } : undefined,
    };

    const holdingSymbols = savedData.holdings?.map((h) => h.symbol) || [];

    setFlowData({
      hasFinancialData: true,
      holdingsCount: savedData.holdings?.length || 0,
      holdings: holdingSymbols,
      portfolioData,
      parsedPortfolio: undefined, // Clear parsed data
    });

    setState("dashboard");
  }, []);

  // Handle skip import
  const handleSkipImport = useCallback(() => {
    setState("dashboard");
    setFlowData({ hasFinancialData: false });
  }, []);

  // Handle re-import
  const handleReimport = useCallback(() => {
    setState("import_required");
  }, []);

  // Handle manage portfolio navigation
  const handleManagePortfolio = useCallback(() => {
    router.push("/dashboard/kai/manage");
  }, [router]);

  // Handle analyze stock
  const handleAnalyzeStock = useCallback(async (symbol: string) => {
    if (!symbol) {
      toast.info("Enter a stock symbol to analyze");
      return;
    }
    
    console.log("[KaiFlow] Analyze stock:", symbol);
    toast.info(`Analyzing ${symbol}...`);
    
    // Set analyzing state
    setFlowData(prev => ({
      ...prev,
      analysisResult: undefined,
    }));
    setState("analysis");
    
    try {
      // Call debate engine API
      const ApiService = (await import("@/lib/services/api-service")).ApiService;
      const response = await ApiService.analyzeStock({
        ticker: symbol,
        userId,
        vaultOwnerToken,
        context: {
          holdings: flowData.holdings || [],
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Map backend response fields to frontend expected format
        // Backend returns: decision (lowercase), headline, confidence, raw_card
        // Frontend expects: decision (uppercase), summary, confidence, insights at top level
        setFlowData(prev => ({
          ...prev,
          analysisResult: {
            symbol,
            // Convert decision to uppercase (backend returns lowercase)
            decision: ((result.decision || "hold").toUpperCase() as "BUY" | "HOLD" | "REDUCE"),
            confidence: result.confidence || 0.5,
            // Backend uses "headline" instead of "summary"
            summary: result.headline || result.summary || "Analysis complete.",
            // Extract insights from raw_card if available, otherwise use top-level
            fundamentalInsights: result.raw_card?.fundamental_insights || result.fundamental_insights,
            sentimentInsights: result.raw_card?.sentiment_insights || result.sentiment_insights,
            valuationInsights: result.raw_card?.valuation_insights || result.valuation_insights,
          },
        }));
      } else {
        throw new Error("Failed to analyze stock");
      }
    } catch (err) {
      console.error("[KaiFlow] Analysis error:", err);
      // Show placeholder result for now
      setFlowData(prev => ({
        ...prev,
        analysisResult: {
          symbol,
          decision: "HOLD",
          confidence: 0.65,
          summary: `Analysis for ${symbol} is being processed. The debate engine is evaluating fundamental, sentiment, and valuation factors.`,
          fundamentalInsights: "Fundamental analysis pending...",
          sentimentInsights: "Sentiment analysis pending...",
          valuationInsights: "Valuation analysis pending...",
        },
      }));
    }
  }, [userId, vaultOwnerToken, flowData.holdings]);

  // Handle back to dashboard from analysis
  const handleBackToDashboard = useCallback(() => {
    setState("dashboard");
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
        <ImportProgressView
          stage={streaming.stage}
          streamedText={streaming.streamedText}
          isStreaming={streaming.stage === "streaming"}
          totalChars={streaming.totalChars}
          chunkCount={streaming.chunkCount}
          errorMessage={streaming.errorMessage}
          onCancel={handleCancelImport}
        />
      )}

      {state === "reviewing" && flowData.parsedPortfolio && vaultKey && (
        <PortfolioReviewView
          portfolioData={flowData.parsedPortfolio}
          userId={userId}
          vaultKey={vaultKey}
          onSaveComplete={handleSaveComplete}
          onReimport={handleReimport}
          onBack={() => setState("import_required")}
        />
      )}

      {state === "dashboard" && flowData.portfolioData && (
        <DashboardView
          portfolioData={flowData.portfolioData}
          onManagePortfolio={handleManagePortfolio}
          onAnalyzeStock={handleAnalyzeStock}
        />
      )}

      {state === "dashboard" && !flowData.portfolioData && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Welcome to Kai</h2>
          <p className="text-muted-foreground mb-6">
            Import your portfolio to get started with personalized investment insights.
          </p>
          <button
            onClick={handleReimport}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Import Portfolio
          </button>
        </div>
      )}

      {state === "analysis" && flowData.analysisResult && (
        <AnalysisView
          result={flowData.analysisResult}
          onBack={handleBackToDashboard}
          onAnalyzeAnother={(symbol: string) => handleAnalyzeStock(symbol)}
        />
      )}

      {state === "analysis" && !flowData.analysisResult && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <HushhLoader variant="inline" label="Analyzing..." />
          <p className="text-sm text-muted-foreground">
            Running debate engine analysis...
          </p>
        </div>
      )}
    </div>
  );
}
