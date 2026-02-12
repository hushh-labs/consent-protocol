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
import { Kbd } from "@/components/ui/kbd";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/lib/morphy-ux/button";
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

function _formatPercent(value: number): string {
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

const SpinningLoader = (props: any) => (
  <Loader2 {...props} className={cn(props.className, "animate-spin")} />
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ManagePortfolioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, vaultOwnerToken } = useVault();
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
        const response = await WorldModelService.getMetadata(
          user.uid,
          false,
          vaultOwnerToken || undefined
        );
        const financialDomain = response.domains.find(d => d.key === "financial");
        
        if (financialDomain && financialDomain.attributeCount > 0) {
          // Priority 1: CacheProvider (shared with dashboard)
          let parsed = getPortfolioData(user.uid);
          
          // Priority 2: Decrypt from World Model (fallback)
          if (!parsed) {
            console.log("[ManagePortfolio] No cache, attempting to decrypt from World Model...");
            try {
              const encryptedData = await WorldModelService.getDomainData(
                user.uid,
                "financial",
                vaultOwnerToken || undefined
              );
              
              if (encryptedData) {
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
                
                // Parse decrypted data
                const allData = JSON.parse(decrypted.plaintext);
                parsed = allData.financial || allData;
                
                // Update cache for future use
                if (parsed) {
                  setCachePortfolioData(user.uid, parsed);
                  console.log("[ManagePortfolio] Decrypted and cached portfolio data");
                }
              }
            } catch (decryptError) {
              console.error("[ManagePortfolio] Failed to decrypt from World Model:", decryptError);
              toast.error("Unable to decrypt portfolio data. Please re-import your statement.");
            }
          }
          
          if (parsed) {
            // Normalize holdings to ensure unrealized_gain_loss_pct is computed
            if (parsed.holdings) {
              parsed.holdings = parsed.holdings.map((h: Holding) => {
                if (h.unrealized_gain_loss_pct !== undefined && h.unrealized_gain_loss_pct !== 0) {
                  return h;
                }
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
                    return { ...h, unrealized_gain_loss_pct: (unrealized / basis) * 100 };
                  }
                }
                return h;
              });
            }
            
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
  }, [
    user?.uid,
    vaultKey,
    vaultOwnerToken,
    completeStep,
    getPortfolioData,
    setCachePortfolioData,
  ]);

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
        vaultOwnerToken: vaultOwnerToken || undefined,
      });

      if (result.success) {
        setCachePortfolioData(user.uid, updatedPortfolioData);

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

  return (
    <div className="w-full">
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
              <>
                {holdings
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((holding, index) => {
                    const actualIndex = (currentPage - 1) * itemsPerPage + index;
                    const gainLoss = holding.unrealized_gain_loss || 0;
                    const isPositive = gainLoss >= 0;

                    return (
                      <Card
                        key={`${holding.symbol}-${actualIndex}`}
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
                                  <span className="text-muted-foreground font-medium">Cost: </span>
                                  <span className="font-semibold">{formatCurrency(holding.cost_basis)}</span>
                                  <span className="mx-2 opacity-20">|</span>
                                  <span className="text-muted-foreground font-medium">G/L: </span>
                                  <span className={cn("font-bold", isPositive ? "text-emerald-500" : "text-red-500")}>
                                    {isPositive ? "+" : ""}{formatCurrency(gainLoss)}
                                  </span>
                                </p>
                              )}

                            </div>
                            <div className="flex items-center gap-3 ml-4 border-l border-primary/10 pl-4">
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  variant="none"
                                  effect="glass"
                                  size="icon-sm"
                                  className="h-10 w-10 text-muted-foreground hover:text-primary transition-all duration-300 rounded-xl"
                                  onClick={() => handleEditHolding(actualIndex)}
                                  icon={{ icon: Pencil }}
                                />
                                <Kbd className="text-[8px] px-1 h-3.5">EDIT</Kbd>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  variant="none"
                                  effect="glass"
                                  size="icon-sm"
                                  className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 rounded-xl"
                                  onClick={() => handleDeleteHolding(actualIndex)}
                                  icon={{ icon: Trash2 }}
                                />
                                <Kbd className="text-[8px] px-1 h-3.5">DEL</Kbd>
                              </div>
                            </div>

                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                {holdings.length > itemsPerPage && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: Math.ceil(holdings.length / itemsPerPage) }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              isActive={currentPage === i + 1}
                              onClick={() => setCurrentPage(i + 1)}
                              className="cursor-pointer"
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(holdings.length / itemsPerPage), prev + 1))}
                            className={cn("cursor-pointer", currentPage === Math.ceil(holdings.length / itemsPerPage) && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
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

      {/* Save Button - Floating Action Style */}
      {/* Save Button - Floating Action Style with Safe Area Support */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 px-10 sm:px-16 pb-[calc(5rem+env(safe-area-inset-bottom))] z-110 pointer-events-none">
          <div className="max-w-xs mx-auto pointer-events-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="morphy"
              effect="fill"
              className="w-full h-12 text-sm font-black rounded-xl border-none shadow-xl"
              icon={{ 
                icon: isSaving ? SpinningLoader : Save,
                gradient: false 
              }}
              loading={isSaving}
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </Button>
          </div>
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
