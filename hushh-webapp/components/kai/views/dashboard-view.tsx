// components/kai/views/dashboard-view.tsx

/**
 * Dashboard View - Comprehensive portfolio dashboard
 *
 * Features:
 * - Large portfolio value at top with gain/loss
 * - Portfolio history chart (real data from statements)
 * - Asset allocation donut chart
 * - Enhanced income card with detailed breakdown
 * - Cash flow summary
 * - Recent transaction activity
 * - KPI cards grid (Holdings, Gain/Loss, Risk)
 * - Prime Assets section showing top holdings by value
 * - Connect Plaid Coming Soon card
 */

"use client";

import { useMemo } from "react";
import { 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Link2, 
  Wallet, 
  PieChart as PieChartIcon,
  Shield,
  ChevronRight,
  Upload,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortfolioHistoryChart, type HistoricalDataPoint } from "../charts/portfolio-history-chart";
import { AssetAllocationDonut } from "../charts/asset-allocation-donut";
import { TransactionActivity, type Transaction } from "../cards/transaction-activity";
import { IncomeDetailCard, type IncomeDetail, type IncomeSummary, type YtdMetrics } from "../cards/income-detail-card";
import { CashFlowCard, type CashFlow } from "../cards/cash-flow-card";
import { KPICard } from "../cards/kpi-card";

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
}

export interface AccountSummary {
  beginning_value?: number;
  ending_value: number;
  change_in_value?: number;
  cash_balance?: number;
  equities_value?: number;
}

export interface PortfolioData {
  account_info?: {
    account_number?: string;
    brokerage_name?: string;
    statement_period?: string;
    statement_period_start?: string;
    statement_period_end?: string;
    account_holder?: string;
  };
  account_summary?: AccountSummary;
  holdings?: Holding[];
  transactions?: Transaction[];
  asset_allocation?: {
    cash_percent?: number;
    cash_pct?: number;
    equities_percent?: number;
    equities_pct?: number;
    bonds_percent?: number;
    bonds_pct?: number;
    other_percent?: number;
  };
  income_summary?: IncomeSummary;
  income_detail?: IncomeDetail;
  realized_gain_loss?: {
    short_term?: number;
    long_term?: number;
    total?: number;
  };
  historical_values?: HistoricalDataPoint[];
  cash_flow?: CashFlow;
  ytd_metrics?: YtdMetrics;
}

interface DashboardViewProps {
  portfolioData: PortfolioData;
  onManagePortfolio: () => void;
  onAnalyzeStock?: (symbol: string) => void;
  onReupload?: () => void;
  onClearData?: () => void;
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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DashboardView({
  portfolioData,
  onManagePortfolio,
  onAnalyzeStock,
  onReupload,
  onClearData,
}: DashboardViewProps) {
  // Calculate totals with robust fallback logic
  const holdingsTotal = useMemo(() => {
    if (!portfolioData.holdings) return 0;
    return portfolioData.holdings.reduce(
      (sum, h) => sum + (h.market_value || 0),
      0
    );
  }, [portfolioData.holdings]);

  const cashBalance = portfolioData.account_summary?.cash_balance || 
    portfolioData.cash_flow?.closing_balance || 0;
  
  const totalValue = 
    portfolioData.account_summary?.ending_value ||
    (holdingsTotal + cashBalance) ||
    holdingsTotal ||
    0;
  
  const beginningValue = portfolioData.account_summary?.beginning_value || totalValue;
  const changeInValue = portfolioData.account_summary?.change_in_value || (totalValue - beginningValue);
  const changePercent = beginningValue > 0 ? ((changeInValue / beginningValue) * 100) : 0;

  // Get prime assets (top 5 by market value)
  const primeAssets = useMemo(() => {
    if (!portfolioData.holdings) return [];
    return [...portfolioData.holdings]
      .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
      .slice(0, 5);
  }, [portfolioData.holdings]);

  // Calculate total unrealized gain/loss
  const totalUnrealizedGainLoss = useMemo(() => {
    if (!portfolioData.holdings) return 0;
    return portfolioData.holdings.reduce(
      (sum, h) => sum + (h.unrealized_gain_loss || 0),
      0
    );
  }, [portfolioData.holdings]);

  // Asset allocation data for donut chart
  const allocationData = useMemo(() => {
    const data = [];
    const allocation = portfolioData.asset_allocation;
    const cashPct = allocation?.cash_percent || allocation?.cash_pct;
    const equitiesPct = allocation?.equities_percent || allocation?.equities_pct;
    const bondsPct = allocation?.bonds_percent || allocation?.bonds_pct;
    
    if (cashPct || cashBalance > 0) {
      data.push({
        name: "Cash",
        value: cashBalance || (totalValue * (cashPct || 0) / 100),
        color: "#6366f1",
      });
    }
    if (equitiesPct || holdingsTotal > 0) {
      data.push({
        name: "Equities",
        value: holdingsTotal || (totalValue * (equitiesPct || 0) / 100),
        color: "#10b981",
      });
    }
    if (bondsPct) {
      data.push({
        name: "Bonds",
        value: totalValue * bondsPct / 100,
        color: "#f59e0b",
      });
    }
    
    // Fallback: create from holdings + cash
    if (data.length === 0 && totalValue > 0) {
      if (cashBalance > 0) {
        data.push({ name: "Cash", value: cashBalance, color: "#6366f1" });
      }
      if (holdingsTotal > 0) {
        data.push({ name: "Equities", value: holdingsTotal, color: "#10b981" });
      }
    }
    
    return data;
  }, [portfolioData.asset_allocation, cashBalance, holdingsTotal, totalValue]);

  // Statement period string
  const statementPeriod = portfolioData.account_info?.statement_period ||
    (portfolioData.account_info?.statement_period_start && portfolioData.account_info?.statement_period_end
      ? `${portfolioData.account_info.statement_period_start} - ${portfolioData.account_info.statement_period_end}`
      : undefined);

  // Risk bucket (derive from allocation)
  const riskBucket = useMemo(() => {
    const equityPercent = holdingsTotal / (totalValue || 1) * 100;
    if (equityPercent > 80) return "Aggressive";
    if (equityPercent > 50) return "Moderate";
    return "Conservative";
  }, [holdingsTotal, totalValue]);

  const isPositive = changeInValue >= 0;
  const holdingsCount = portfolioData.holdings?.length || 0;

  // Check what data we have
  const hasHistoricalData = portfolioData.historical_values && portfolioData.historical_values.length >= 2;
  const hasTransactions = portfolioData.transactions && portfolioData.transactions.length > 0;
  const hasCashFlow = portfolioData.cash_flow && 
    (portfolioData.cash_flow.opening_balance || portfolioData.cash_flow.closing_balance);
  const hasIncomeDetail = portfolioData.income_detail || portfolioData.income_summary;

  return (
    <div className="w-full space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Portfolio Dashboard</h1>
          {portfolioData.account_info?.brokerage_name && (
            <p className="text-sm text-muted-foreground">
              {portfolioData.account_info.brokerage_name}
              {statementPeriod && ` • ${statementPeriod}`}
            </p>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Portfolio options"
            >
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onReupload && (
              <DropdownMenuItem onClick={onReupload} className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Upload New Statement
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onManagePortfolio} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Manage Portfolio
            </DropdownMenuItem>
            {onClearData && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onClearData} 
                  className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Data
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Big Portfolio Value */}
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-2">Total Portfolio Value</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {formatCurrency(totalValue)}
        </h1>
        <div
          className={cn(
            "flex items-center justify-center gap-2 mt-3 text-lg font-medium",
            isPositive ? "text-emerald-500" : "text-red-500"
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
          <span>
            {formatCurrency(Math.abs(changeInValue))} ({formatPercent(changePercent)})
          </span>
        </div>
      </div>

      {/* Portfolio History Chart - Uses real data or shows period summary */}
      <PortfolioHistoryChart
        data={portfolioData.historical_values}
        beginningValue={beginningValue}
        endingValue={totalValue}
        statementPeriod={statementPeriod}
        height={180}
      />

      {/* Asset Allocation & Income Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Asset Allocation */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AssetAllocationDonut 
              data={allocationData} 
              height={140} 
              showLegend={false}
            />
          </CardContent>
        </Card>

        {/* Enhanced Income Card */}
        {hasIncomeDetail ? (
          <IncomeDetailCard
            incomeSummary={portfolioData.income_summary}
            incomeDetail={portfolioData.income_detail}
            ytdMetrics={portfolioData.ytd_metrics}
          />
        ) : (
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Income
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No income data</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cash Flow & Gain/Loss Row */}
      {hasCashFlow && (
        <div className="grid grid-cols-2 gap-4">
          <CashFlowCard cashFlow={portfolioData.cash_flow} />
          
          {/* Realized Gain/Loss Card */}
          {portfolioData.realized_gain_loss && (
            <Card variant="none" effect="glass" showRipple={false}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Realized Gain/Loss
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolioData.realized_gain_loss.short_term !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Short-term</span>
                    <span className={cn(
                      portfolioData.realized_gain_loss.short_term >= 0 
                        ? "text-emerald-500" 
                        : "text-red-500"
                    )}>
                      {formatCurrency(portfolioData.realized_gain_loss.short_term)}
                    </span>
                  </div>
                )}
                {portfolioData.realized_gain_loss.long_term !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Long-term</span>
                    <span className={cn(
                      portfolioData.realized_gain_loss.long_term >= 0 
                        ? "text-emerald-500" 
                        : "text-red-500"
                    )}>
                      {formatCurrency(portfolioData.realized_gain_loss.long_term)}
                    </span>
                  </div>
                )}
                {portfolioData.realized_gain_loss.total !== undefined && (
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-medium">Total</span>
                    <span className={cn(
                      "font-medium",
                      portfolioData.realized_gain_loss.total >= 0 
                        ? "text-emerald-500" 
                        : "text-red-500"
                    )}>
                      {formatCurrency(portfolioData.realized_gain_loss.total)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          title="Holdings"
          value={holdingsCount.toString()}
          icon={<Wallet className="w-4 h-4" />}
          size="sm"
        />
        <KPICard
          title="Gain/Loss"
          value={formatCurrency(totalUnrealizedGainLoss)}
          change={totalUnrealizedGainLoss !== 0 ? (totalUnrealizedGainLoss / (totalValue - totalUnrealizedGainLoss) * 100) : 0}
          variant={totalUnrealizedGainLoss >= 0 ? "success" : "danger"}
          size="sm"
        />
        <KPICard
          title="Risk"
          value={riskBucket}
          icon={<Shield className="w-4 h-4" />}
          variant={riskBucket === "Aggressive" ? "warning" : riskBucket === "Conservative" ? "info" : "default"}
          size="sm"
        />
      </div>

      {/* Recent Transaction Activity */}
      {hasTransactions && (
        <TransactionActivity 
          transactions={portfolioData.transactions} 
          maxItems={5}
        />
      )}

      {/* Prime Assets Section */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-semibold">Prime Assets</h2>
          <button
            onClick={onManagePortfolio}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Manage Portfolio"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-0 divide-y divide-border">
            {primeAssets.length > 0 ? (
              primeAssets.map((holding, index) => {
                const gainLoss = holding.unrealized_gain_loss || 0;
                const gainLossPct = holding.unrealized_gain_loss_pct || 0;
                const isHoldingPositive = gainLoss >= 0;

                return (
                  <button
                    key={`${holding.symbol}-${index}`}
                    onClick={() => onAnalyzeStock?.(holding.symbol)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{holding.symbol}</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {holding.name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {holding.quantity.toLocaleString()} shares @ {formatCurrency(holding.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(holding.market_value)}
                        </p>
                        <p
                          className={cn(
                            "text-sm",
                            isHoldingPositive ? "text-emerald-500" : "text-red-500"
                          )}
                        >
                          {formatCurrency(gainLoss)} ({formatPercent(gainLossPct)})
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No holdings found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {portfolioData.holdings && portfolioData.holdings.length > 5 && (
          <button
            onClick={onManagePortfolio}
            className="w-full mt-3 py-2 text-sm text-primary hover:underline"
          >
            View all {portfolioData.holdings.length} holdings
          </button>
        )}
      </div>

      {/* Connect Plaid - Coming Soon */}
      <Card variant="muted" effect="glass" showRipple={false}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Connect with Plaid</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically sync your brokerage accounts
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
