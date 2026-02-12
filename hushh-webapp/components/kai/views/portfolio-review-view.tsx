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

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building2,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";


import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorldModelService } from "@/lib/services/world-model-service";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { 
  Card as MorphyCard, 
  CardContent, 
  CardHeader, 
  CardTitle,
} from "@/lib/morphy-ux/card";




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
  /** VAULT_OWNER token for authentication (required on native) */
  vaultOwnerToken?: string;
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

function _formatPercent(value: number | undefined | null): string {
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

const SpinningLoader = (props: any) => (
  <Loader2 {...props} className={cn(props.className, "animate-spin")} />
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioReviewView({
  portfolioData: initialData,
  userId,
  vaultKey,
  vaultOwnerToken,
  onSaveComplete,
  onReimport,
  onBack: _onBack,
  className,
}: PortfolioReviewViewProps) {
  // Editable state
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(
    initialData.account_info || {}
  );
  const [accountSummary, _setAccountSummary] = useState<AccountSummary>(
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
  // Scroll to top on mount to ensure clean view framing after progress view
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

      // 1. Fetch existing blob and merge (prevents cross-domain overwrite)
      const { HushhVault } = await import("@/lib/capacitor");
      const { decryptData } = await import("@/lib/vault/encrypt");

      let fullBlob: Record<string, any> = {};
      try {
        const existingEncrypted = await WorldModelService.getDomainData(userId, "financial", vaultOwnerToken);
        if (existingEncrypted) {
          const decrypted = await decryptData(
            {
              ciphertext: existingEncrypted.ciphertext,
              iv: existingEncrypted.iv,
              tag: existingEncrypted.tag,
              encoding: "base64",
              algorithm: (existingEncrypted.algorithm || "aes-256-gcm") as "aes-256-gcm",
            },
            vaultKey
          );
          fullBlob = JSON.parse(decrypted);
        }
      } catch (e) {
        console.warn("[PortfolioReview] Could not fetch/decrypt existing blob, creating fresh:", e);
      }

      // 2. Merge new financial domain into existing blob (preserves other domains)
      fullBlob.financial = portfolioToSave;

      // 3. Re-encrypt the full merged blob
      const encrypted = await HushhVault.encryptData({
        plaintext: JSON.stringify(fullBlob),
        keyHex: vaultKey,
      });

      // 4. Build summary for indexing (non-sensitive metadata only, no total_value)
      const holdingsSummary = holdings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        current_price: h.price,
      }));

      const summary = {
        holdings_count: holdings.length,
        holdings: holdingsSummary,
        risk_bucket: riskBucket,
        has_income_data: !!(incomeSummary.total_income),
        has_realized_gains: !!(realizedGainLoss.net_realized),
        last_updated: new Date().toISOString(),
      };

      // 5. Store to world model
      const result = await WorldModelService.storeDomainData({
        userId,
        domain: "financial",
        encryptedBlob: {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          algorithm: "aes-256-gcm",
        },
        summary,
        vaultOwnerToken,
      });

      if (!result.success) {
        throw new Error("Backend returned failure on store");
      }

      // 5b. Invalidate caches after successful save
      const cache = CacheService.getInstance();
      cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, "financial"));
      cache.invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
      cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));

      // 6. Verify the save by reading back
      try {
        const readBack = await WorldModelService.getDomainData(userId, "financial", vaultOwnerToken);
        if (!readBack) {
          console.warn("[PortfolioReview] Read-back verification failed: no data returned");
        }
      } catch (verifyErr) {
        console.warn("[PortfolioReview] Read-back verification error:", verifyErr);
      }

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
    <div className={cn("relative w-full", className)}>


      <div className="w-full max-w-lg lg:max-w-6xl mx-auto space-y-8 pb-56 px-4 md:px-6 transition-all duration-500 ease-in-out">



      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-1">
            <h1 className="text-xl font-bold tracking-tight">Review Portfolio</h1>
            <p className="text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] sm:max-w-none">
              Verify before saving to vault
            </p>
          </div>
        </div>
        <MorphyButton 
          variant="muted" 
          size="default" 
          onClick={onReimport} 
          className="shrink-0"
          icon={{ 
            icon: RefreshCw
          }}
        >
          <span className="hidden sm:inline ml-2 font-bold">Re-import</span>
          <span className="sm:hidden font-bold">Retry</span>
        </MorphyButton>


      </div>



      <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
        {/* Left Column / Mobile Top: Summary & Info */}
        <div className="lg:col-span-5 space-y-8">
          {/* Summary Card - Redesigned for bigger numbers */}
          <MorphyCard variant="none" className="overflow-hidden border-none shadow-xl">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20" />
            <CardContent className="relative pt-8 px-6 pb-8 space-y-8">

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Total Portfolio Value
                </p>
                <p className="text-4xl sm:text-5xl font-black tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent px-2 break-all">
                  {formatCurrency(totalValue)}
                </p>

                {totalUnrealizedGainLoss !== 0 && (
                  <div className="flex justify-center mt-3">
                    <Badge
                      className={cn(
                        "font-bold py-1 px-3",
                        totalUnrealizedGainLoss >= 0
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}
                    >
                      {totalUnrealizedGainLoss >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1.5" />
                      )}
                      {formatCurrency(totalUnrealizedGainLoss)} unrealized
                    </Badge>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 pt-6 border-t border-primary/10">
                <div className="min-w-0 text-center sm:text-left sm:pl-4">
                  <p className="text-2xl font-black">{holdings.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assets</p>
                </div>
                <div className="min-w-0 flex flex-col items-center justify-center">
                  <Badge
                    variant={
                      riskBucket === "conservative"
                        ? "secondary"
                        : riskBucket === "moderate"
                          ? "default"
                          : "destructive"
                    }
                    className="font-black text-[10px] uppercase tracking-widest px-2"
                  >
                    {riskBucket}
                  </Badge>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">Risk</p>
                </div>
                <div className="min-w-0 text-center sm:text-right sm:pr-4">
                  <p className="text-2xl font-black break-all">
                    {formatCurrency(initialData.cash_balance || accountSummary.cash_balance || 0)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cash</p>
                </div>
              </div>

            </CardContent>
          </MorphyCard>


      {/* Account & Meta Accordions */}
      <Accordion type="multiple" defaultValue={["account", "income"]} className="w-full space-y-4">

        <AccordionItem value="account" className="border-b-0 bg-card rounded-2xl border px-5">
          <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


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
        <AccordionItem value="allocation" className="border-b-0 bg-card rounded-2xl border px-5">
            <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


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
        <AccordionItem value="income" className="border-b-0 bg-card rounded-2xl border px-5">
            <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


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
        </div>

        {/* Right Column / Mobile Bottom: Holdings */}
        <div className="lg:col-span-7 mt-8 lg:mt-0">
          <MorphyCard variant="none" className="h-full border-none shadow-xl bg-card">
            <CardHeader className="pb-4 px-6 pt-6 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest text-foreground">
                    Holdings ({holdings.length})
                  </CardTitle>
                </div>
                <MorphyButton 
                  variant="muted" 
                  size="sm" 
                  onClick={handleAddHolding}
                  icon={{ icon: Plus }}
                >
                  <span className="ml-2">Add</span>
                </MorphyButton>
              </div>

            </CardHeader>

            <CardContent className="space-y-4 px-6 pt-6">

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
                    <div className="flex justify-end gap-3 pt-2">
                      <MorphyButton
                        variant="muted"
                        size="sm"
                        onClick={() => setEditingHoldingIndex(null)}
                      >
                        Done
                      </MorphyButton>
                    </div>
                  </div>
                ) : (
                  // View mode - ADJUSTED FOR MOBILE
                  <div className="flex items-center justify-between gap-4">

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold text-base">{holding.symbol || "—"}</span>
                        <span className="text-xs text-muted-foreground truncate block">
                          {holding.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] sm:text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {holding.quantity} sh
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          @ {formatCurrency(holding.price)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">
                        {formatCurrency(holding.market_value)}
                      </p>
                      {holding.unrealized_gain_loss !== undefined && (
                        <p
                          className={cn(
                            "text-[10px] font-medium",
                            (holding.unrealized_gain_loss || 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          )}
                        >
                          {holding.unrealized_gain_loss >= 0 ? "+" : ""}
                          {formatCurrency(holding.unrealized_gain_loss)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto border-l border-primary/10 pl-3">
                      <div className="flex flex-col items-center gap-1">
                        <MorphyButton
                          variant="muted"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground hover:text-primary transition-all duration-300 rounded-xl"
                          onClick={() => setEditingHoldingIndex(index)}
                          icon={{ icon: Pencil }}
                        />
                        <Kbd className="text-[8px] px-1 h-3.5">EDIT</Kbd>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <MorphyButton
                          variant="muted"
                          size="icon"
                          className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 rounded-xl"
                          onClick={() => handleDeleteHolding(index)}
                          icon={{ icon: Trash2 }}
                        />
                        <Kbd className="text-[8px] px-1 h-3.5">DEL</Kbd>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </MorphyCard>
    </div>
  </div>

  </div>

  {/* Save Button - Refined Floating Action */}
  {/* Save Button - Refined Floating Action with Safe Area Support */}
  <div className="fixed bottom-0 left-0 right-0 px-10 sm:px-16 pb-[calc(5rem+env(safe-area-inset-bottom))] z-110 pointer-events-none">
    <div className="max-w-xs mx-auto pointer-events-auto">
      <MorphyButton
        variant="morphy"
        effect="fill"
        size="default"
        className="w-full font-black shadow-xl border-none"
        onClick={handleSave}
        disabled={isSaving || holdings.length === 0}
        icon={{ 
          icon: isSaving ? SpinningLoader : Save,
          gradient: false 
        }}
        loading={isSaving}
      >
        {isSaving ? "SAVING..." : "SAVE TO VAULT"}
      </MorphyButton>
    </div>
  </div>
</div>
  );
}
