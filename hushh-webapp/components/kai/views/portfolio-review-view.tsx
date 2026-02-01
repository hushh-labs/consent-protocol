/**
 * PortfolioReviewView Component
 *
 * Review screen for verifying and editing parsed portfolio data before saving.
 * Displayed after PDF parsing completes, before data is saved to world model.
 *
 * Features:
 * - Account info display (editable)
 * - Summary section with key metrics
 * - Holdings list with inline editing
 * - Asset allocation breakdown
 * - Income summary (if available)
 * - Save to Vault button (encrypts and stores to world model)
 * - Re-import button to try again
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorldModelService } from "@/lib/services/world-model-service";

// =============================================================================
// TYPES
// =============================================================================

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis?: number;
  unrealized_gain_loss?: number;
  unrealized_gain_loss_pct?: number;
  asset_type?: string;
}

export interface AccountInfo {
  holder_name?: string;
  account_number?: string;
  account_type?: string;
  brokerage?: string;
  statement_period_start?: string;
  statement_period_end?: string;
}

export interface AccountSummary {
  beginning_value?: number;
  ending_value?: number;
  cash_balance?: number;
  equities_value?: number;
  change_in_value?: number;
}

export interface AssetAllocation {
  cash_pct?: number;
  cash_value?: number;
  equities_pct?: number;
  equities_value?: number;
  bonds_pct?: number;
  bonds_value?: number;
}

export interface IncomeSummary {
  dividends_taxable?: number;
  interest_income?: number;
  total_income?: number;
}

export interface RealizedGainLoss {
  short_term_gain?: number;
  long_term_gain?: number;
  net_realized?: number;
}

export interface PortfolioData {
  account_info?: AccountInfo;
  account_summary?: AccountSummary;
  asset_allocation?: AssetAllocation;
  holdings?: Holding[];
  income_summary?: IncomeSummary;
  realized_gain_loss?: RealizedGainLoss;
  cash_balance?: number;
  total_value?: number;
}

export interface PortfolioReviewViewProps {
  /** Parsed portfolio data from Gemini */
  portfolioData: PortfolioData;
  /** User ID for saving */
  userId: string;
  /** Vault key for encryption */
  vaultKey: string;
  /** Callback when save completes successfully */
  onSaveComplete: (data: PortfolioData) => void;
  /** Callback to re-import */
  onReimport: () => void;
  /** Callback to go back */
  onBack?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0.00%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function deriveRiskBucket(holdings: Holding[]): string {
  if (!holdings || holdings.length === 0) return "unknown";

  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.market_value || 0),
    0
  );
  if (totalValue === 0) return "unknown";

  // Sort by value descending
  const sorted = [...holdings].sort(
    (a, b) => (b.market_value || 0) - (a.market_value || 0)
  );
  const topHoldingPct =
    sorted.length > 0 ? ((sorted[0]?.market_value || 0) / totalValue) * 100 : 0;

  if (topHoldingPct > 30) return "aggressive";
  if (topHoldingPct > 15) return "moderate";
  return "conservative";
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioReviewView({
  portfolioData: initialData,
  userId,
  vaultKey,
  onSaveComplete,
  onReimport,
  onBack,
  className,
}: PortfolioReviewViewProps) {
  // Editable state
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(
    initialData.account_info || {}
  );
  const [accountSummary, setAccountSummary] = useState<AccountSummary>(
    initialData.account_summary || {}
  );
  const [holdings, setHoldings] = useState<Holding[]>(
    initialData.holdings || []
  );
  const [assetAllocation] = useState<AssetAllocation>(
    initialData.asset_allocation || {}
  );
  const [incomeSummary] = useState<IncomeSummary>(
    initialData.income_summary || {}
  );
  const [realizedGainLoss] = useState<RealizedGainLoss>(
    initialData.realized_gain_loss || {}
  );

  const [isSaving, setIsSaving] = useState(false);
  const [editingHoldingIndex, setEditingHoldingIndex] = useState<number | null>(
    null
  );

  // Computed values
  const totalValue = useMemo(() => {
    const holdingsTotal = holdings.reduce(
      (sum, h) => sum + (h.market_value || 0),
      0
    );
    return (
      accountSummary.ending_value ||
      holdingsTotal + (initialData.cash_balance || 0) ||
      holdingsTotal
    );
  }, [holdings, accountSummary.ending_value, initialData.cash_balance]);

  const totalUnrealizedGainLoss = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + (h.unrealized_gain_loss || 0),
      0
    );
  }, [holdings]);

  const riskBucket = useMemo(() => deriveRiskBucket(holdings), [holdings]);

  // Handlers
  const handleDeleteHolding = useCallback((index: number) => {
    setHoldings((prev) => prev.filter((_, i) => i !== index));
    toast.success("Holding removed");
  }, []);

  const handleUpdateHolding = useCallback(
    (index: number, field: keyof Holding, value: string | number) => {
      setHoldings((prev) =>
        prev.map((h, i) => {
          if (i !== index) return h;
          const updated = { ...h, [field]: value };
          // Recalculate market value if quantity or price changed
          if (field === "quantity" || field === "price") {
            updated.market_value =
              (updated.quantity || 0) * (updated.price || 0);
          }
          return updated;
        })
      );
    },
    []
  );

  const handleAddHolding = useCallback(() => {
    const newHolding: Holding = {
      symbol: "",
      name: "New Holding",
      quantity: 0,
      price: 0,
      market_value: 0,
    };
    setHoldings((prev) => [...prev, newHolding]);
    setEditingHoldingIndex(holdings.length);
    toast.info("New holding added - please fill in the details");
  }, [holdings.length]);

  const handleSave = async () => {
    if (!userId || !vaultKey) {
      toast.error("Please unlock your vault first");
      return;
    }

    setIsSaving(true);

    try {
      // Build the complete portfolio data
      const portfolioToSave: PortfolioData = {
        account_info: accountInfo,
        account_summary: {
          ...accountSummary,
          ending_value: totalValue,
        },
        asset_allocation: assetAllocation,
        holdings,
        income_summary: incomeSummary,
        realized_gain_loss: realizedGainLoss,
        cash_balance: initialData.cash_balance || accountSummary.cash_balance,
        total_value: totalValue,
      };

      // 1. Encrypt the portfolio data
      const { HushhVault } = await import("@/lib/capacitor");
      const encrypted = await HushhVault.encryptData({
        plaintext: JSON.stringify({ financial: portfolioToSave }),
        keyHex: vaultKey,
      });

      // 2. Build summary for indexing (non-sensitive metadata)
      const summary = {
        holdings_count: holdings.length,
        total_value: totalValue,
        risk_bucket: riskBucket,
        has_income_data: !!(incomeSummary.total_income),
        has_realized_gains: !!(realizedGainLoss.net_realized),
        last_updated: new Date().toISOString(),
      };

      // 3. Store to world model
      await WorldModelService.storeDomainData({
        userId,
        domain: "financial",
        encryptedBlob: {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          algorithm: "aes-256-gcm",
        },
        summary,
      });

      // 4. Cache in session storage for immediate use
      sessionStorage.setItem(
        "kai_portfolio_data",
        JSON.stringify(portfolioToSave)
      );

      toast.success("Portfolio saved to vault!");
      onSaveComplete(portfolioToSave);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save portfolio");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("w-full space-y-6 pb-32", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">Review Portfolio</h1>
            <p className="text-sm text-muted-foreground">
              Verify and edit before saving to your vault
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReimport}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-import
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            <p className="text-4xl font-bold tracking-tight">
              {formatCurrency(totalValue)}
            </p>
            {totalUnrealizedGainLoss !== 0 && (
              <p
                className={cn(
                  "text-sm font-medium mt-1",
                  totalUnrealizedGainLoss >= 0
                    ? "text-emerald-600"
                    : "text-red-500"
                )}
              >
                {totalUnrealizedGainLoss >= 0 ? (
                  <TrendingUp className="inline h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="inline h-4 w-4 mr-1" />
                )}
                {formatCurrency(totalUnrealizedGainLoss)} unrealized
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold">{holdings.length}</p>
              <p className="text-xs text-muted-foreground">Holdings</p>
            </div>
            <div>
              <Badge
                variant={
                  riskBucket === "conservative"
                    ? "secondary"
                    : riskBucket === "moderate"
                      ? "default"
                      : "destructive"
                }
              >
                {riskBucket}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Risk</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {formatCurrency(initialData.cash_balance || accountSummary.cash_balance || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Cash</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Accordion type="single" collapsible defaultValue="account">
        <AccordionItem value="account">
          <AccordionTrigger className="text-base font-medium">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Account Information
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <Label className="text-xs">Account Holder</Label>
                <Input
                  value={accountInfo.holder_name || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      holder_name: e.target.value,
                    }))
                  }
                  placeholder="Name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  value={accountInfo.account_number || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      account_number: e.target.value,
                    }))
                  }
                  placeholder="XXX-XXXX"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Brokerage</Label>
                <Input
                  value={accountInfo.brokerage || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      brokerage: e.target.value,
                    }))
                  }
                  placeholder="Brokerage name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Account Type</Label>
                <Input
                  value={accountInfo.account_type || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      account_type: e.target.value,
                    }))
                  }
                  placeholder="Individual, IRA, etc."
                  className="mt-1"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Asset Allocation */}
        {(assetAllocation.cash_pct || assetAllocation.equities_pct) && (
          <AccordionItem value="allocation">
            <AccordionTrigger className="text-base font-medium">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Asset Allocation
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {assetAllocation.cash_pct !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cash</span>
                    <div className="text-right">
                      <span className="font-medium">
                        {assetAllocation.cash_pct?.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {formatCurrency(assetAllocation.cash_value)}
                      </span>
                    </div>
                  </div>
                )}
                {assetAllocation.equities_pct !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Equities</span>
                    <div className="text-right">
                      <span className="font-medium">
                        {assetAllocation.equities_pct?.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {formatCurrency(assetAllocation.equities_value)}
                      </span>
                    </div>
                  </div>
                )}
                {assetAllocation.bonds_pct !== undefined &&
                  assetAllocation.bonds_pct > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bonds</span>
                      <div className="text-right">
                        <span className="font-medium">
                          {assetAllocation.bonds_pct?.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {formatCurrency(assetAllocation.bonds_value)}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Income Summary */}
        {incomeSummary.total_income !== undefined && (
          <AccordionItem value="income">
            <AccordionTrigger className="text-base font-medium">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Income Summary
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {incomeSummary.dividends_taxable !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm">Dividends</span>
                    <span className="font-medium">
                      {formatCurrency(incomeSummary.dividends_taxable)}
                    </span>
                  </div>
                )}
                {incomeSummary.interest_income !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm">Interest</span>
                    <span className="font-medium">
                      {formatCurrency(incomeSummary.interest_income)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Total Income</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(incomeSummary.total_income)}
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Holdings List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Holdings ({holdings.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddHolding}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {holdings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No holdings found</p>
              <p className="text-sm">Click "Add" to add holdings manually</p>
            </div>
          ) : (
            holdings.map((holding, index) => (
              <div
                key={`${holding.symbol}-${index}`}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  editingHoldingIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {editingHoldingIndex === index ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Symbol</Label>
                        <Input
                          value={holding.symbol}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "symbol",
                              e.target.value.toUpperCase()
                            )
                          }
                          placeholder="AAPL"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={holding.name}
                          onChange={(e) =>
                            handleUpdateHolding(index, "name", e.target.value)
                          }
                          placeholder="Apple Inc."
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={holding.quantity}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          value={holding.price}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Market Value</Label>
                        <Input
                          value={formatCurrency(holding.market_value)}
                          disabled
                          className="mt-1 bg-muted"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingHoldingIndex(null)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{holding.symbol || "—"}</span>
                        <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {holding.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        <span className="text-muted-foreground">
                          {holding.quantity} shares
                        </span>
                        <span className="text-muted-foreground">
                          @ {formatCurrency(holding.price)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(holding.market_value)}
                      </p>
                      {holding.unrealized_gain_loss !== undefined && (
                        <p
                          className={cn(
                            "text-sm",
                            (holding.unrealized_gain_loss || 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          )}
                        >
                          {formatCurrency(holding.unrealized_gain_loss)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingHoldingIndex(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteHolding(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Save Button - Fixed at bottom */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t">
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSave}
          disabled={isSaving || holdings.length === 0}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Encrypting & Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save to Vault
            </>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Data will be encrypted with your vault key before saving
        </p>
      </div>
    </div>
  );
}
