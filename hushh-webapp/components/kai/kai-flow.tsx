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
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { useCache } from "@/lib/cache/cache-context";
import { PortfolioImportView } from "./views/portfolio-import-view";
import { ImportProgressView, ImportStage } from "./views/import-progress-view";
import { PortfolioReviewView, PortfolioData as ReviewPortfolioData } from "./views/portfolio-review-view";
import { DashboardView, PortfolioData } from "./views/dashboard-view";
import { AnalysisView } from "./views/analysis-view";
import { useVault } from "@/lib/vault/vault-context";
import { toast } from "sonner";
import { ApiService } from "@/lib/services/api-service";

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
  thoughts: string[];  // Array of thought summaries from Gemini thinking mode
  thoughtCount: number;
  errorMessage?: string;
}

// =============================================================================
// NORMALIZATION HELPERS
// =============================================================================

/**
 * Normalize backend portfolio data to match frontend ReviewPortfolioData interface.
 * Handles field name differences between backend (Python) and frontend (TypeScript).
 * Also handles Gemini's raw response format (account_metadata, detailed_holdings, etc.)
 */
function normalizePortfolioData(backendData: Record<string, unknown>): ReviewPortfolioData {
  console.log("[KaiFlow] Raw backend data:", JSON.stringify(backendData, null, 2).slice(0, 2000));
  
  // Get holdings from multiple possible sources
  const rawHoldings = (
    backendData.holdings || 
    backendData.detailed_holdings || 
    []
  ) as Array<Record<string, unknown>>;
  
  // Normalize holdings - handle various field name formats
  const normalizedHoldings = rawHoldings.map((h) => {
    const marketValue = h.market_value !== undefined ? Number(h.market_value) : 0;
    const costBasis = h.cost_basis !== undefined ? Number(h.cost_basis) : undefined;
    const unrealized = h.unrealized_gain_loss !== undefined
      ? Number(h.unrealized_gain_loss)
      : undefined;
    let unrealizedPct =
      h.unrealized_gain_loss_pct !== undefined
        ? Number(h.unrealized_gain_loss_pct)
        : undefined;

    // If percentage is missing but we have P/L and a reasonable denominator,
    // derive a fallback % so UI can always show something meaningful.
    if (unrealizedPct === undefined && unrealized !== undefined) {
      // Prefer cost basis as denominator when available.
      let basis: number | undefined;
      if (costBasis !== undefined && Math.abs(costBasis) > 1e-6) {
        basis = costBasis;
      } else if (marketValue !== 0) {
        basis = marketValue - unrealized;
      }

      if (basis !== undefined && Math.abs(basis) > 1e-6) {
        unrealizedPct = (unrealized / basis) * 100;
      }
    }

    return {
      symbol: String(h.symbol || h.symbol_cusip || ""),
      name: String(h.name || h.description || "Unknown"),
      quantity: Number(h.quantity || 0),
      price: Number(h.price || h.price_per_unit || 0),
      market_value: marketValue,
      cost_basis: costBasis,
      unrealized_gain_loss: unrealized,
      unrealized_gain_loss_pct: unrealizedPct,
      asset_type: h.asset_type ? String(h.asset_type) : (h.asset_class ? String(h.asset_class) : undefined),
    };
  });

  console.log("[KaiFlow] Normalized holdings:", normalizedHoldings.length, normalizedHoldings.slice(0, 2));

  // Get account info from multiple possible sources
  const accountInfo = (
    backendData.account_info || 
    backendData.account_metadata
  ) as Record<string, unknown> | undefined;
  
  const normalizedAccountInfo = accountInfo ? {
    holder_name: accountInfo.holder_name || accountInfo.account_holder 
      ? String(accountInfo.holder_name || accountInfo.account_holder) 
      : undefined,
    account_number: accountInfo.account_number ? String(accountInfo.account_number) : undefined,
    account_type: accountInfo.account_type ? String(accountInfo.account_type) : undefined,
    brokerage: accountInfo.brokerage_name || accountInfo.brokerage || accountInfo.institution_name 
      ? String(accountInfo.brokerage_name || accountInfo.brokerage || accountInfo.institution_name) 
      : undefined,
    statement_period_start: accountInfo.statement_period_start ? String(accountInfo.statement_period_start) : undefined,
    statement_period_end: accountInfo.statement_period_end ? String(accountInfo.statement_period_end) : undefined,
  } : undefined;

  // Get account summary from multiple possible sources
  const accountSummary = (
    backendData.account_summary || 
    backendData.portfolio_summary
  ) as Record<string, unknown> | undefined;
  
  const normalizedAccountSummary = accountSummary ? {
    beginning_value: accountSummary.beginning_value !== undefined ? Number(accountSummary.beginning_value) : undefined,
    ending_value: accountSummary.ending_value !== undefined ? Number(accountSummary.ending_value) : undefined,
    cash_balance: accountSummary.cash_balance !== undefined ? Number(accountSummary.cash_balance) : 
      (backendData.cash_balance !== undefined ? Number(backendData.cash_balance) : undefined),
    equities_value: accountSummary.equities_value !== undefined ? Number(accountSummary.equities_value) : undefined,
    change_in_value: accountSummary.change_in_value !== undefined ? Number(accountSummary.change_in_value) : 
      (accountSummary.total_change !== undefined ? Number(accountSummary.total_change) : undefined),
  } : undefined;

  // Normalize asset_allocation
  const assetAllocation = backendData.asset_allocation as Record<string, unknown> | undefined;
  const normalizedAssetAllocation = assetAllocation ? {
    cash_pct: assetAllocation.cash_pct !== undefined ? Number(assetAllocation.cash_pct) : undefined,
    cash_value: assetAllocation.cash_value !== undefined ? Number(assetAllocation.cash_value) : undefined,
    equities_pct: assetAllocation.equities_pct !== undefined ? Number(assetAllocation.equities_pct) : undefined,
    equities_value: assetAllocation.equities_value !== undefined ? Number(assetAllocation.equities_value) : undefined,
    bonds_pct: assetAllocation.bonds_pct !== undefined ? Number(assetAllocation.bonds_pct) : undefined,
    bonds_value: assetAllocation.bonds_value !== undefined ? Number(assetAllocation.bonds_value) : undefined,
  } : undefined;

  // Normalize income_summary
  const incomeSummary = backendData.income_summary as Record<string, unknown> | undefined;
  const normalizedIncomeSummary = incomeSummary ? {
    dividends_taxable: incomeSummary.dividends_taxable !== undefined ? Number(incomeSummary.dividends_taxable) : 
      (incomeSummary.taxable_dividends !== undefined ? Number(incomeSummary.taxable_dividends) : undefined),
    interest_income: incomeSummary.interest_income !== undefined ? Number(incomeSummary.interest_income) : 
      (incomeSummary.taxable_interest !== undefined ? Number(incomeSummary.taxable_interest) : undefined),
    total_income: incomeSummary.total_income !== undefined ? Number(incomeSummary.total_income) : undefined,
  } : undefined;

  // Normalize realized_gain_loss
  const realizedGainLoss = backendData.realized_gain_loss as Record<string, unknown> | undefined;
  const normalizedRealizedGainLoss = realizedGainLoss ? {
    short_term_gain: realizedGainLoss.short_term_gain !== undefined ? Number(realizedGainLoss.short_term_gain) : undefined,
    long_term_gain: realizedGainLoss.long_term_gain !== undefined ? Number(realizedGainLoss.long_term_gain) : undefined,
    net_realized: realizedGainLoss.net_realized !== undefined ? Number(realizedGainLoss.net_realized) : undefined,
  } : undefined;

  // Calculate total_value if not provided
  let totalValue = backendData.total_value !== undefined ? Number(backendData.total_value) : undefined;
  if (totalValue === undefined || totalValue === 0) {
    // Try to derive from account_summary.ending_value
    if (normalizedAccountSummary?.ending_value) {
      totalValue = normalizedAccountSummary.ending_value;
    } else {
      // Calculate from holdings
      totalValue = normalizedHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    }
  }

  // Get cash_balance from multiple sources
  const cashBalance = backendData.cash_balance !== undefined ? Number(backendData.cash_balance) : 
    (normalizedAccountSummary?.cash_balance !== undefined ? normalizedAccountSummary.cash_balance : undefined);

  const result: ReviewPortfolioData = {
    account_info: normalizedAccountInfo,
    account_summary: normalizedAccountSummary,
    asset_allocation: normalizedAssetAllocation,
    holdings: normalizedHoldings,
    income_summary: normalizedIncomeSummary,
    realized_gain_loss: normalizedRealizedGainLoss,
    cash_balance: cashBalance,
    total_value: totalValue,
  };

  console.log("[KaiFlow] Final normalized data:", {
    holdingsCount: result.holdings?.length || 0,
    hasAccountInfo: !!result.account_info,
    hasAccountSummary: !!result.account_summary,
    totalValue: result.total_value,
    cashBalance: result.cash_balance,
  });

  return result;
}

/**
 * Normalize holdings array to ensure unrealized_gain_loss_pct is computed.
 * This helper can be used in multiple places (checkFinancialData, handleSaveComplete).
 */
function normalizeHoldingsWithPct<T extends { 
  unrealized_gain_loss_pct?: number; 
  unrealized_gain_loss?: number; 
  cost_basis?: number; 
  market_value?: number;
}>(holdings: T[] | undefined): T[] | undefined {
  if (!holdings) return holdings;
  
  return holdings.map((h) => {
    // If percentage is already present and valid, keep it
    if (h.unrealized_gain_loss_pct !== undefined && h.unrealized_gain_loss_pct !== 0) {
      return h;
    }

    // Derive percentage from unrealized_gain_loss if available
    const unrealized = h.unrealized_gain_loss;
    if (unrealized !== undefined) {
      let basis: number | undefined;
      const costBasis = h.cost_basis;
      const marketValue = h.market_value || 0;

      if (costBasis !== undefined && Math.abs(costBasis) > 1e-6) {
        basis = costBasis;
      } else if (marketValue !== 0) {
        basis = marketValue - unrealized;
      }

      if (basis !== undefined && Math.abs(basis) > 1e-6) {
        return {
          ...h,
          unrealized_gain_loss_pct: (unrealized / basis) * 100,
        };
      }
    }

    return h;
  });
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
  const { getPortfolioData, setPortfolioData, invalidateDomain } = useCache();
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
    thoughts: [],
    thoughtCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAnalyzeLosers = useCallback(() => {
    if (!flowData.portfolioData) {
      toast.error("No portfolio data available.");
      return;
    }

    const rawHoldings = (flowData.portfolioData.holdings ||
      flowData.portfolioData.detailed_holdings ||
      []) as unknown as Array<{
      symbol?: string;
      name?: string;
      unrealized_gain_loss_pct?: number;
      unrealized_gain_loss?: number;
      market_value?: number;
      sector?: string;
      asset_type?: string;
    }>;

    const totalValue = rawHoldings.reduce(
      (sum, h) => sum + (h.market_value !== undefined ? Number(h.market_value) : 0),
      0
    );

    const holdingsForOptimize = rawHoldings
      .map((h) => {
        const mv = h.market_value !== undefined ? Number(h.market_value) : undefined;
        const gainLoss =
          h.unrealized_gain_loss !== undefined
            ? Number(h.unrealized_gain_loss)
            : undefined;
        const gainLossPct =
          h.unrealized_gain_loss_pct !== undefined
            ? Number(h.unrealized_gain_loss_pct)
            : undefined;

        const symbol = String(h.symbol || "").toUpperCase().trim();

        return {
          symbol,
          name: h.name ? String(h.name) : undefined,
          gain_loss_pct: gainLossPct,
          gain_loss: gainLoss,
          market_value: mv,
          weight_pct:
            totalValue > 0 && mv !== undefined ? (mv / totalValue) * 100 : undefined,
          sector: h.sector ? String(h.sector) : undefined,
          asset_type: h.asset_type ? String(h.asset_type) : undefined,
        };
      })
      .filter((h) => h.symbol);

    const losers = holdingsForOptimize
      .filter(
        (l) => l.gain_loss_pct === undefined || (l.gain_loss_pct as number) <= -5
      )
      .slice(0, 25);

    const forceOptimize = losers.length === 0;

    if (forceOptimize) {
      toast.info(
        "No positions are below -5%. Optimizing the portfolio using your full holdings."
      );
    } else {
      toast.info("Optimizing around your current losers and allocations.");
    }

    sessionStorage.setItem(
      "kai_losers_analysis_input",
      JSON.stringify({
        userId,
        thresholdPct: -5,
        maxPositions: 10,
        losers,
        holdings: holdingsForOptimize,
        forceOptimize,
        hadBelowThreshold: losers.length > 0,
      })
    );

    router.push("/kai/dashboard/portfolio-health");
  }, [flowData.portfolioData, router, userId]);

  // Check World Model for financial data on mount
  useEffect(() => {
    async function checkFinancialData() {
      try {
        setState("checking");

        // Fetch user's World Model metadata
        const metadata = await WorldModelService.getMetadata(
          userId,
          false,
          vaultOwnerToken
        );

        // Check if financial domain exists and has data
        const financialDomain = metadata.domains.find(
          (d) => d.key === "financial"
        );

        const hasFinancialData =
          financialDomain && financialDomain.attributeCount > 0;

        if (hasFinancialData) {
          // Prefer CacheProvider (in-memory + sessionStorage) for reuse with Manage page
          let portfolioData: PortfolioData | undefined = getPortfolioData(userId) ?? undefined;

          // Also check sessionStorage as fallback
          if (!portfolioData) {
            try {
              const sessionData = sessionStorage.getItem("kai_portfolio_data");
              if (sessionData) {
                portfolioData = JSON.parse(sessionData) as PortfolioData;
                console.log("[KaiFlow] Loaded portfolio data from sessionStorage");
              }
            } catch (err) {
              console.warn("[KaiFlow] Failed to parse sessionStorage data:", err);
            }
          }

          if (!portfolioData && vaultKey) {
            // No cache - try to decrypt from World Model
            console.log("[KaiFlow] No cache, attempting to decrypt from World Model...");
            try {
              const encryptedData = await WorldModelService.getDomainData(
                userId,
                "financial",
                vaultOwnerToken
              );
              
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
                console.log("[KaiFlow] Successfully decrypted portfolio data from World Model");
              }
            } catch (decryptError) {
              // Handle encryption key mismatch or corrupted data
              console.error("[KaiFlow] Failed to decrypt from World Model:", decryptError);
              
              // Check if this is a decryption error (key mismatch)
              const errorMessage = decryptError instanceof Error ? decryptError.message : "";
              if (errorMessage.includes("decrypt") || errorMessage.includes("tag") || errorMessage.includes("authentication")) {
                console.warn("[KaiFlow] Possible encryption key mismatch - clearing cache and prompting re-import");
                invalidateDomain(userId, "financial");
                toast.error("Unable to decrypt portfolio data. Please re-import your statement.");
                setFlowData({ hasFinancialData: false });
                setState("import_required");
                return;
              }
              
              // For other errors, continue without portfolio data - user can re-import
            }
          }
          if (!portfolioData && !vaultKey) {
            // Financial metadata exists, but we cannot decrypt without a vault key.
          }

          // Ensure holdings have unrealized_gain_loss_pct computed
          // This handles data loaded from cache/World Model that may not have been normalized
          if (portfolioData?.holdings) {
            portfolioData.holdings = normalizeHoldingsWithPct(portfolioData.holdings);
            console.log("[KaiFlow] Normalized holdings with unrealized_gain_loss_pct");
          }

          // Update cache with normalized data
          if (portfolioData) {
            setPortfolioData(userId, portfolioData);
            try {
              sessionStorage.setItem("kai_portfolio_data", JSON.stringify(portfolioData));
            } catch (err) {
              console.warn("[KaiFlow] Failed to update sessionStorage:", err);
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
  }, [
    userId,
    vaultKey,
    vaultOwnerToken,
    getPortfolioData,
    setPortfolioData,
    invalidateDomain,
  ]);

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
        // Treat missing key as vault-locked state and rely on VaultLockGuard / VaultFlow
        toast.error("Please unlock your vault before importing a statement.");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        toast.error("File too large. Maximum size is 10MB.");
        return;
      }

      // Validate file type
      const validTypes = ["application/pdf", "text/csv", "application/vnd.ms-excel"];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".pdf")) {
        setError("Invalid file type. Please upload a PDF or CSV file.");
        toast.error("Invalid file type. Please upload a PDF or CSV file.");
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
          thoughts: [],
          thoughtCount: 0,
        });

        // Create abort controller for cancellation with timeout
        abortControllerRef.current = new AbortController();
        
        // Set a timeout for the entire operation (5 minutes for large PDFs)
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setError("Import timed out. Please try again with a smaller file.");
            toast.error("Import timed out. Please try again.");
          }
        }, 5 * 60 * 1000);

        // Build form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", userId);

        let response: Response;
        try {
          response = await ApiService.importPortfolioStream({
            formData,
            vaultOwnerToken,
            signal: abortControllerRef.current.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw fetchError;
          }
          throw new Error("Network error. Please check your connection and try again.");
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          if (response.status === 401) {
            throw new Error("Session expired. Please refresh the page and try again.");
          } else if (response.status === 413) {
            throw new Error("File too large for server. Please try a smaller file.");
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again in a few moments.");
          }
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
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
        let lastActivityTime = Date.now();
        const STREAM_TIMEOUT = 120000; // 2 minutes without activity

        while (true) {
          // Check for stream timeout (no activity)
          if (Date.now() - lastActivityTime > STREAM_TIMEOUT) {
            reader.cancel();
            throw new Error("Stream timeout - no data received. Please try again.");
          }

          const { done, value } = await reader.read();
          if (done) break;

          lastActivityTime = Date.now();
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
                } else if (data.stage === "thinking") {
                  // Handle thinking stage with thought summaries
                  setStreaming((prev) => {
                    const newThoughts = data.thought 
                      ? [...prev.thoughts, data.thought]
                      : prev.thoughts;
                    return {
                      ...prev,
                      stage: "thinking",
                      thoughts: newThoughts,
                      thoughtCount: data.thought_count || newThoughts.length,
                    };
                  });
                } else if (data.stage === "extracting" || data.stage === "streaming") {
                  // Handle extraction stage (JSON streaming)
                  if (data.text && !data.is_thought) {
                    fullStreamedText += data.text;
                  }
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "extracting",
                    streamedText: fullStreamedText,
                    totalChars: data.total_chars || prev.totalChars,
                    chunkCount: data.chunk_count || prev.chunkCount,
                    thoughtCount: data.thought_count || prev.thoughtCount,
                  }));
                } else if (data.stage === "parsing") {
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "parsing",
                  }));
                } else if (data.stage === "complete" && data.portfolio_data) {
                  // Store parsed portfolio for review - normalize backend data to frontend format
                  parsedPortfolio = normalizePortfolioData(data.portfolio_data);
                  console.log("[KaiFlow] Normalized portfolio data:", {
                    holdings: parsedPortfolio.holdings?.length || 0,
                    hasAccountInfo: !!parsedPortfolio.account_info,
                    hasAccountSummary: !!parsedPortfolio.account_summary,
                    totalValue: parsedPortfolio.total_value,
                  });
                  setStreaming((prev) => ({
                    ...prev,
                    stage: "complete",
                    thoughtCount: data.thought_count || prev.thoughtCount,
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
      thoughts: [],
      thoughtCount: 0,
    });
  }, []);

  // Handle retry import after error
  const handleRetryImport = useCallback(() => {
    setError(null);
    setStreaming({
      stage: "idle",
      streamedText: "",
      totalChars: 0,
      chunkCount: 0,
      thoughts: [],
      thoughtCount: 0,
    });
    setState("import_required");
  }, []);

  // Handle save complete from review screen
  const handleSaveComplete = useCallback((savedData: ReviewPortfolioData) => {
    // Convert to dashboard format and update flow data
    // Map the review types to dashboard types
    // Normalize holdings to ensure unrealized_gain_loss_pct is computed
    const normalizedHoldings = normalizeHoldingsWithPct(savedData.holdings);
    
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
      holdings: normalizedHoldings,
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

    const holdingSymbols = normalizedHoldings?.map((h) => h.symbol) || [];

    // Update cache context so other pages (Manage, etc.) can access the data
    setPortfolioData(userId, portfolioData);

    // Also store in sessionStorage for persistence across same-session navigation
    try {
      sessionStorage.setItem("kai_portfolio_data", JSON.stringify(portfolioData));
      console.log("[KaiFlow] Portfolio data saved to cache and sessionStorage");
    } catch (err) {
      console.warn("[KaiFlow] Failed to save to sessionStorage:", err);
    }

    setFlowData({
      hasFinancialData: true,
      holdingsCount: savedData.holdings?.length || 0,
      holdings: holdingSymbols,
      portfolioData,
      parsedPortfolio: undefined, // Clear parsed data
    });

    setState("dashboard");
  }, [userId, setPortfolioData]);

  // Handle skip import - preserve existing data if available
  const handleSkipImport = useCallback(() => {
    setState("dashboard");
    // Only reset flowData if there's no existing portfolio data
    // This preserves data when user clicks "Upload New Statement" then skips
    if (!flowData.portfolioData) {
      setFlowData({ hasFinancialData: false });
    }
  }, [flowData.portfolioData]);

  // Handle re-import (upload new statement)
  const handleReimport = useCallback(() => {
    setState("import_required");
  }, []);

  // Handle clear all data with confirmation
  const handleClearData = useCallback(async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to clear all portfolio data? This action cannot be undone."
    );
    
    if (!confirmed) {
      return;
    }
    
    try {
      // Clear session storage
      sessionStorage.removeItem("kai_portfolio_data");
      
      // Clear World Model financial domain
      await WorldModelService.clearDomain(userId, "financial", vaultOwnerToken);
      
      // Invalidate cache to ensure fresh data on next load
      CacheService.getInstance().invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
      CacheService.getInstance().invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
      
      // Reset flow state
      setFlowData({ hasFinancialData: false });
      setState("import_required");
      
      toast.success("Portfolio data cleared successfully");
    } catch (err) {
      console.error("[KaiFlow] Error clearing data:", err);
      toast.error("Failed to clear data. Please try again.");
    }
  }, [userId]);

  // Handle manage portfolio navigation
  const handleManagePortfolio = useCallback(() => {
    router.push("/kai/dashboard/manage");
  }, [router]);

  // Handle analyze stock
  const handleAnalyzeStock = useCallback(async (symbol: string) => {
    if (!symbol) {
      toast.info("Enter a stock symbol to analyze");
      return;
    }
    
    console.log("[KaiFlow] Analyze stock (coming soon):", symbol);
    toast.info(`Stock analysis for ${symbol} is coming soon!`, {
      description: "We are currently refining our debate engine for more precise insights.",
    });
  }, []);

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
    <div className="w-full flex flex-col">
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
          isStreaming={streaming.stage === "uploading" || streaming.stage === "analyzing" || streaming.stage === "thinking"}
          totalChars={streaming.totalChars}
          chunkCount={streaming.chunkCount}
          thoughts={streaming.thoughts}
          thoughtCount={streaming.thoughtCount}
          errorMessage={streaming.errorMessage}
          onCancel={handleCancelImport}
        />
      )}

      {state === "reviewing" && flowData.parsedPortfolio && vaultKey && (
        <PortfolioReviewView
          portfolioData={flowData.parsedPortfolio}
          userId={userId}
          vaultKey={vaultKey}
          vaultOwnerToken={vaultOwnerToken}
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
          onAnalyzeLosers={handleAnalyzeLosers}
          onReupload={handleReimport}
          onClearData={handleClearData}
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
