// app/kai/dashboard/manage/page.tsx

/**
 * Manage Portfolio Page - Full holdings editor
 *
 * Features:
 * - Account info header
 * - Summary section (beginning/ending value, cash, equities)
 * - Scrollable holdings list with edit buttons
 * - Add Holding button
 * - Save Changes button with encryption and world model storage
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import { useVault } from "@/lib/vault/vault-context";
import { useAuth } from "@/lib/firebase";
import { WorldModelService } from "@/lib/services/world-model-service";
import { HushhVault } from "@/lib/capacitor";
import { useCache } from "@/lib/cache/cache-context";
import { EditHoldingModal } from "@/components/kai/modals/edit-holding-modal";

// =============================================================================
// TYPES
// =============================================================================

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis?: number;
  unrealized_gain_loss?: number;
  unrealized_gain_loss_pct?: number;
  acquisition_date?: string;
}

interface AccountInfo {
  account_number?: string;
  brokerage_name?: string;
  statement_period?: string;
}

interface AccountSummary {
  beginning_value?: number;
  ending_value: number;
  change_in_value?: number;
  cash_balance?: number;
  equities_value?: number;
}

interface PortfolioData {
  account_info?: AccountInfo;
  account_summary?: AccountSummary;
  holdings?: Holding[];
  transactions?: unknown[];
  updated_at?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function deriveRiskBucket(holdings: Holding[]): string {
  if (!holdings || holdings.length === 0) return "unknown";
  
  // Simple risk calculation based on concentration
  const totalValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  if (totalValue === 0) return "unknown";
  
  const topHoldingPct = holdings.length > 0 
    ? ((holdings[0]?.market_value || 0) / totalValue) * 100 
    : 0;
  
  if (topHoldingPct > 30) return "aggressive";
  if (topHoldingPct > 15) return "moderate";
  return "conservative";
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ManagePortfolioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked } = useVault();
  const { getPortfolioData, setPortfolioData: setCachePortfolioData } = useCache();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({});
  const [accountSummary, setAccountSummary] = useState<AccountSummary>({ ending_value: 0 });
  const [hasChanges, setHasChanges] = useState(false);
  
  // Edit modal state
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { registerSteps, completeStep, reset } = useStepProgress();

  // Register 2 steps: Auth check, Load holdings
  useEffect(() => {
    registerSteps(2);
    return () => reset();
  }, [registerSteps, reset]);

  // Load portfolio data on mount
  useEffect(() => {
    async function loadPortfolio() {
      // Step 1: Auth check
      completeStep();

      if (!user?.uid || !vaultKey) {
        setIsLoading(false);
        completeStep(); // Complete step 2 even if no data
        return;
      }

      try {
        // Get encrypted data from world model
        const response = await WorldModelService.getMetadata(user.uid);
        const financialDomain = response.domains.find(d => d.key === "financial");
        
        if (financialDomain && financialDomain.attributeCount > 0) {
          // Prefer CacheProvider (shared with dashboard) then sessionStorage
          const parsed = getPortfolioData(user.uid) ?? (() => {
            const cachedData = sessionStorage.getItem("kai_portfolio_data");
            return cachedData ? JSON.parse(cachedData) : null;
          })();
          if (parsed) {
            setPortfolioData(parsed);
            setHoldings(parsed.holdings || []);
            setAccountInfo(parsed.account_info || {});
            setAccountSummary(parsed.account_summary || { ending_value: 0 });
          }
        }
        
        // Step 2: Holdings loaded
        completeStep();
      } catch (error) {
        console.error("[ManagePortfolio] Error loading portfolio:", error);
        toast.error("Failed to load portfolio data");
        completeStep(); // Complete step 2 on error
      } finally {
        setIsLoading(false);
      }
    }

    loadPortfolio();
  }, [user?.uid, vaultKey, completeStep]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!user?.uid || !vaultKey) {
      toast.error("Please unlock your vault first");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Build complete portfolio data object
      const updatedPortfolioData: PortfolioData = {
        account_info: accountInfo,
        account_summary: {
          ...accountSummary,
          ending_value: holdings.reduce((sum, h) => sum + (h.market_value || 0), 0) + (accountSummary.cash_balance || 0),
          equities_value: holdings.reduce((sum, h) => sum + (h.market_value || 0), 0),
        },
        holdings: holdings,
        transactions: portfolioData?.transactions || [],
        updated_at: new Date().toISOString(),
      };

      // 2. Encrypt client-side using HushhVault
      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: JSON.stringify(updatedPortfolioData),
      });

      // 3. Store via WorldModelService (tri-flow compliant)
      const result = await WorldModelService.storeDomainData({
        userId: user.uid,
        domain: "financial",
        encryptedBlob: {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          algorithm: "aes-256-gcm",
        },
        summary: {
          has_portfolio: true,
          holdings_count: holdings.length,
          total_value: updatedPortfolioData.account_summary?.ending_value || 0,
          risk_bucket: deriveRiskBucket(holdings),
          last_updated: new Date().toISOString(),
        },
      });

      if (result.success) {
        setCachePortfolioData(user.uid, updatedPortfolioData);
        sessionStorage.setItem("kai_portfolio_data", JSON.stringify(updatedPortfolioData));

        toast.success("Portfolio saved securely");
        setHasChanges(false);
        router.push("/kai/dashboard");
      } else {
        throw new Error("Failed to save portfolio");
      }
    } catch (error) {
      console.error("[ManagePortfolio] Save error:", error);
      toast.error("Failed to save portfolio");
    } finally {
      setIsSaving(false);
    }
  }, [user?.uid, vaultKey, accountInfo, accountSummary, holdings, portfolioData, router]);

  // Handle edit holding
  const handleEditHolding = useCallback((index: number) => {
    setEditingHolding(holdings[index] || null);
    setEditingIndex(index);
    setIsModalOpen(true);
  }, [holdings]);

  // Handle save holding from modal
  const handleSaveHolding = useCallback((updatedHolding: Holding) => {
    setHoldings(prev => {
      const newHoldings = [...prev];
      if (editingIndex >= 0 && editingIndex < newHoldings.length) {
        newHoldings[editingIndex] = updatedHolding;
      } else {
        // Adding new holding
        newHoldings.push(updatedHolding);
      }
      return newHoldings;
    });
    setHasChanges(true);
    setIsModalOpen(false);
    setEditingHolding(null);
    setEditingIndex(-1);
  }, [editingIndex]);

  // Handle delete holding
  const handleDeleteHolding = useCallback((index: number) => {
    setHoldings(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  // Handle add new holding
  const handleAddHolding = useCallback(() => {
    setEditingHolding({
      symbol: "",
      name: "",
      quantity: 0,
      price: 0,
      market_value: 0,
    });
    setEditingIndex(-1);
    setIsModalOpen(true);
  }, []);

  // Loading state
  if (isLoading) {
    return null;
  }

  // Vault not unlocked
  if (!isVaultUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Please unlock your vault to manage your portfolio.
            </p>
            <Button onClick={() => router.push("/kai")}>
              Go to Kai
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="p-4 space-y-4">
        {/* Account Info */}
        {(accountInfo.account_number || accountInfo.brokerage_name) && (
          <Card variant="muted" effect="glass" showRipple={false}>
            <CardContent className="p-4">
              <p className="font-medium">
                Account: {accountInfo.account_number || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                {accountInfo.brokerage_name || "Unknown Brokerage"}
              </p>
              {accountInfo.statement_period && (
                <p className="text-sm text-muted-foreground">
                  Period: {accountInfo.statement_period}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Section */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              {accountSummary.beginning_value !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">Beginning</p>
                  <p className="font-semibold">
                    {formatCurrency(accountSummary.beginning_value)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Ending</p>
                <p className="font-semibold">
                  {formatCurrency(
                    holdings.reduce((sum, h) => sum + (h.market_value || 0), 0) +
                    (accountSummary.cash_balance || 0)
                  )}
                </p>
              </div>
              {accountSummary.cash_balance !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">Cash</p>
                  <p className="font-semibold">
                    {formatCurrency(accountSummary.cash_balance)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Equities</p>
                <p className="font-semibold">
                  {formatCurrency(
                    holdings.reduce((sum, h) => sum + (h.market_value || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holdings Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Holdings ({holdings.length})
            </h2>
            <Button
              variant="none"
              effect="glass"
              size="sm"
              onClick={handleAddHolding}
              icon={{ icon: Plus, gradient: false }}
            >
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {holdings.length > 0 ? (
              holdings.map((holding, index) => {
                const gainLoss = holding.unrealized_gain_loss || 0;
                const isPositive = gainLoss >= 0;

                return (
                  <Card
                    key={`${holding.symbol}-${index}`}
                    variant="none"
                    effect="glass"
                    showRipple={false}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">
                              {holding.symbol}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">
                              {holding.name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {holding.quantity.toLocaleString()} @ {formatCurrency(holding.price)} = {formatCurrency(holding.market_value)}
                          </p>
                          {holding.cost_basis !== undefined && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Cost: </span>
                              {formatCurrency(holding.cost_basis)}
                              <span className="mx-2">|</span>
                              <span className="text-muted-foreground">G/L: </span>
                              <span className={cn(isPositive ? "text-emerald-500" : "text-red-500")}>
                                {formatCurrency(gainLoss)}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEditHolding(index)}
                            className="p-2 rounded-full hover:bg-muted transition-colors"
                            aria-label="Edit holding"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeleteHolding(index)}
                            className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                            aria-label="Delete holding"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card variant="muted" effect="glass" showRipple={false}>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No holdings yet. Add your first holding or import a portfolio statement.
                  </p>
                  <Button onClick={handleAddHolding} icon={{ icon: Plus, gradient: false }}>
                    Add Holding
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Save Button - Fixed at bottom */}
      {hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            icon={{ icon: isSaving ? Loader2 : Save, gradient: false }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <EditHoldingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHolding(null);
          setEditingIndex(-1);
        }}
        holding={editingHolding}
        onSave={handleSaveHolding}
      />
    </div>
  );
}
