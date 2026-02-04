// components/kai/views/dashboard-view.tsx

/**
 * Dashboard View - Comprehensive portfolio dashboard
 *
 * Features:
 * - Large portfolio value at top with gain/loss
 * - Portfolio history chart (real data from statements)
 * - Asset allocation donut chart
 * - Sector allocation chart
 * - Enhanced income card with detailed breakdown
 * - Cash flow summary
 * - Cash management (checks, debit, transfers)
 * - Projections and MRD tracking
 * - YTD summary with deposits, withdrawals, fees
 * - Recent transaction activity
 * - KPI cards grid (Holdings, Gain/Loss, Risk)
 * - Prime Assets section showing top holdings by value
 * - Legal disclosures (collapsible)
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
  AlertTriangle,
  DollarSign,
  BarChart3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
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
import { SectorAllocationChart } from "../charts/sector-allocation-chart";
import { TransactionActivity, type Transaction } from "../cards/transaction-activity";
import { IncomeDetailCard, type IncomeDetail, type IncomeSummary, type YtdMetrics } from "../cards/income-detail-card";
import { CashFlowCard, type CashFlow } from "../cards/cash-flow-card";
import { CashManagementCard, type CashManagement } from "../cards/cash-management-card";
import { ProjectionsCard, type ProjectionsAndMRD } from "../cards/projections-card";
import { LegalDisclosuresCard } from "../cards/legal-disclosures-card";
import { YtdSummaryCard, type YtdData } from "../cards/ytd-summary-card";
import { KPICard } from "../cards/kpi-card";
import { TopMoversCard } from "../cards/top-movers-card";
import { PortfolioMetricsCard } from "../cards/portfolio-metrics-card";

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
  acquisition_date?: string;
  estimated_annual_income?: number;
  est_yield?: number;
  asset_class?: string;
  sector?: string;
  asset_type?: string;
  is_margin?: boolean;
  is_short?: boolean;
}

export interface AccountSummary {
  beginning_value?: number;
  ending_value: number;
  change_in_value?: number;
  cash_balance?: number;
  equities_value?: number;
  total_change?: number;
  net_deposits_withdrawals?: number;
  investment_gain_loss?: number;
}

export interface PortfolioData {
  // Account metadata (enhanced)
  account_info?: {
    account_number?: string;
    brokerage_name?: string;
    institution_name?: string;
    statement_period?: string;
    statement_period_start?: string;
    statement_period_end?: string;
    account_holder?: string;
    account_type?: string;
  };
  account_summary?: AccountSummary;
  // Holdings (supports both old and new schema)
  holdings?: Holding[];
  detailed_holdings?: Holding[];
  // Transactions (supports both old and new schema)
  transactions?: Transaction[];
  activity_and_transactions?: Transaction[];
  // Asset allocation (supports both object and array format)
  asset_allocation?: {
    cash_percent?: number;
    cash_pct?: number;
    equities_percent?: number;
    equities_pct?: number;
    bonds_percent?: number;
    bonds_pct?: number;
    other_percent?: number;
  } | Array<{ category: string; market_value: number; percentage: number }>;
  // Income
  income_summary?: IncomeSummary;
  income_detail?: IncomeDetail;
  // Gains/Losses
  realized_gain_loss?: {
    short_term?: number;
    short_term_gain?: number;
    short_term_loss?: number;
    long_term?: number;
    long_term_gain?: number;
    long_term_loss?: number;
    total?: number;
    net_realized?: number;
    net_short_term?: number;
    net_long_term?: number;
  };
  // Historical data
  historical_values?: HistoricalDataPoint[];
  // Cash
  cash_flow?: CashFlow;
  cash_management?: CashManagement;
  cash_balance?: number;
  total_value?: number;
  // YTD
  ytd_metrics?: YtdMetrics;
  // YTD Summary (NEW)
  ytd_summary?: YtdData;
  // Fees
  total_fees?: number;
  // Projections (NEW)
  projections_and_mrd?: ProjectionsAndMRD;
  // Legal (NEW)
  legal_and_disclosures?: string[];
}

interface DashboardViewProps {
  portfolioData: PortfolioData;
  onManagePortfolio: () => void;
  onAnalyzeStock?: (symbol: string) => void;
  onAnalyzeLosers?: () => void;
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

function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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
  onAnalyzeLosers,
  onReupload,
  onClearData,
}: DashboardViewProps) {
  // Normalize holdings (support both old and new schema)
  const holdings = useMemo(() => {
    return portfolioData.holdings || portfolioData.detailed_holdings || [];
  }, [portfolioData.holdings, portfolioData.detailed_holdings]);

  // Normalize transactions (support both old and new schema)
  const transactions = useMemo(() => {
    return portfolioData.transactions || portfolioData.activity_and_transactions || [];
  }, [portfolioData.transactions, portfolioData.activity_and_transactions]);

  // Calculate totals with robust fallback logic
  const holdingsTotal = useMemo(() => {
    if (!holdings.length) return 0;
    return holdings.reduce(
      (sum, h) => sum + (h.market_value || 0),
      0
    );
  }, [holdings]);

  const cashBalance = portfolioData.account_summary?.cash_balance || 
    portfolioData.cash_flow?.closing_balance || 
    portfolioData.cash_balance || 0;
  
  const totalValue = 
    portfolioData.total_value ||
    portfolioData.account_summary?.ending_value ||
    (holdingsTotal + cashBalance) ||
    holdingsTotal ||
    0;
  
  const beginningValue = portfolioData.account_summary?.beginning_value || totalValue;
  const changeInValue = portfolioData.account_summary?.change_in_value || 
    portfolioData.account_summary?.total_change ||
    (totalValue - beginningValue);
  const changePercent = beginningValue > 0 ? ((changeInValue / beginningValue) * 100) : 0;

  // Get prime assets (top 5 by market value)
  const primeAssets = useMemo(() => {
    if (!holdings.length) return [];
    return [...holdings]
      .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
      .slice(0, 5);
  }, [holdings]);

  // Calculate total unrealized gain/loss
  const totalUnrealizedGainLoss = useMemo(() => {
    if (!holdings.length) return 0;
    return holdings.reduce(
      (sum, h) => sum + (h.unrealized_gain_loss || 0),
      0
    );
  }, [holdings]);

  // Asset allocation data for donut chart (support both object and array format)
  const allocationData = useMemo(() => {
    const data = [];
    const allocation = portfolioData.asset_allocation;
    
    // Handle array format from new schema
    if (Array.isArray(allocation)) {
      return allocation.map((item) => ({
        name: item.category,
        value: item.market_value,
        color: item.category.toLowerCase().includes("cash") ? "#6366f1" :
               item.category.toLowerCase().includes("equit") ? "#10b981" :
               item.category.toLowerCase().includes("bond") ? "#f59e0b" : "#8b5cf6",
      }));
    }
    
    // Handle object format from old schema
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
  const holdingsCount = holdings.length;

  // Check what data we have
  const hasHistoricalData = portfolioData.historical_values && portfolioData.historical_values.length >= 2;
  const hasTransactions = transactions.length > 0;
  const hasCashFlow = portfolioData.cash_flow && 
    (portfolioData.cash_flow.opening_balance || portfolioData.cash_flow.closing_balance);
  const hasIncomeDetail = portfolioData.income_detail || portfolioData.income_summary;
  const hasMeaningfulIncome = useMemo(() => {
    const summary = portfolioData.income_summary;
    const detail = portfolioData.income_detail;
    const totalIncome = summary?.total ?? ((summary?.dividends ?? 0) + (summary?.interest ?? 0));
    const hasIncome =
      totalIncome > 0 ||
      (summary?.dividends != null && summary.dividends > 0) ||
      (summary?.interest != null && summary.interest > 0);
    const hasDetail =
      !!detail &&
      !!(
        detail.dividends_taxable ||
        detail.dividends_qualified ||
        detail.interest_taxable ||
        detail.short_term_cap_gains ||
        detail.long_term_cap_gains
      );
    return hasIncome || hasDetail;
  }, [portfolioData.income_summary, portfolioData.income_detail]);
  const hasTopMovers = useMemo(() => {
    const withGainLoss = holdings.filter(
      (h) => h.unrealized_gain_loss_pct !== undefined &&
             h.unrealized_gain_loss_pct !== 0 &&
             !isNaN(h.unrealized_gain_loss_pct)
    );
    const hasGainers = withGainLoss.some((h) => (h.unrealized_gain_loss_pct ?? 0) > 0);
    const hasLosers = withGainLoss.some((h) => (h.unrealized_gain_loss_pct ?? 0) < 0);
    return hasGainers || hasLosers;
  }, [holdings]);
  const hasCashManagement = portfolioData.cash_management && (
    (portfolioData.cash_management.checking_activity?.length || 0) +
    (portfolioData.cash_management.debit_card_activity?.length || 0) +
    (portfolioData.cash_management.deposits_and_withdrawals?.length || 0) > 0
  );
  const hasProjections = portfolioData.projections_and_mrd && (
    (portfolioData.projections_and_mrd.estimated_cash_flow?.length || 0) > 0 ||
    portfolioData.projections_and_mrd.mrd_estimate
  );
  const hasLegalDisclosures = portfolioData.legal_and_disclosures && 
    portfolioData.legal_and_disclosures.length > 0;

  // Check for sector data in holdings
  const hasSectorData = useMemo(() => {
    return holdings.some(h => h.sector || h.asset_type);
  }, [holdings]);

  // Check for margin/short positions
  const marginPositions = useMemo(() => {
    return holdings.filter(h => h.is_margin);
  }, [holdings]);

  const shortPositions = useMemo(() => {
    return holdings.filter(h => h.is_short);
  }, [holdings]);

  const hasSpecialPositions = marginPositions.length > 0 || shortPositions.length > 0;

  // Build YTD data from various sources
  const ytdData: YtdData = useMemo(() => {
    return {
      net_deposits_ytd: portfolioData.ytd_summary?.net_deposits_ytd || 
        portfolioData.account_summary?.net_deposits_withdrawals,
      withdrawals_ytd: portfolioData.ytd_summary?.withdrawals_ytd,
      total_income_ytd: portfolioData.ytd_summary?.total_income_ytd || 
        portfolioData.ytd_metrics?.income_ytd,
      total_fees: portfolioData.total_fees || portfolioData.ytd_summary?.total_fees,
      investment_gain_loss: portfolioData.ytd_summary?.investment_gain_loss || 
        portfolioData.account_summary?.investment_gain_loss,
    };
  }, [portfolioData]);

  const hasYtdData = ytdData.net_deposits_ytd !== undefined ||
    ytdData.withdrawals_ytd !== undefined ||
    ytdData.total_income_ytd !== undefined ||
    ytdData.total_fees !== undefined ||
    ytdData.investment_gain_loss !== undefined;

  // Get brokerage name (support both old and new schema)
  const brokerageName = portfolioData.account_info?.brokerage_name || 
    portfolioData.account_info?.institution_name;

  // Per-holding portfolio weights for later use (e.g. charts, badges)
  const weightedHoldings = useMemo(
    () =>
      holdings.map((h) => ({
        ...h,
        weight_pct:
          totalValue > 0 ? ((h.market_value || 0) / totalValue) * 100 : 0,
      })),
    [holdings, totalValue]
  );

  return (
    <div className="w-full space-y-3">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Portfolio Dashboard</h1>
          {brokerageName && (
            <p className="text-sm text-muted-foreground">
              {brokerageName}
              {statementPeriod && ` • ${statementPeriod}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onAnalyzeLosers && (
            <Button
              variant="muted"
              onClick={onAnalyzeLosers}
              className="h-9 cursor-pointer"
            >
              <Activity className="w-4 h-4 mr-2" />
              Optimize Portfolio
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
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
      </div>

      {/* Unified Portfolio Hero */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardContent className="p-4">
          {/* Centered Total Value */}
          <div className="text-center mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Portfolio Value</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {formatCurrency(totalValue)}
            </h1>
            <div
              className={cn(
                "flex items-center justify-center gap-1.5 mt-1 text-sm font-medium",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {formatCurrency(Math.abs(changeInValue))} ({formatPercent(changePercent)})
              </span>
            </div>
          </div>

          {/* Period & Beginning/Ending Values */}
          <div className="border-t border-border pt-3">
            {statementPeriod && (
              <p className="text-xs text-muted-foreground text-center mb-2">
                {statementPeriod}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Beginning</p>
                <p className="text-sm font-semibold">{formatCurrency(beginningValue)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ending</p>
                <p className="text-sm font-semibold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </div>

          {/* Inline Sparkline if historical data exists */}
          {hasHistoricalData && portfolioData.historical_values && (
            <div className="mt-3 pt-3 border-t border-border">
              <PortfolioHistoryChart
                data={portfolioData.historical_values}
                beginningValue={beginningValue}
                endingValue={totalValue}
                height={120}
                inline
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards Grid - Responsive: stack on mobile, 3 cols on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          title="Holdings"
          value={holdingsCount > 0 ? holdingsCount.toString() : "—"}
          description="Number of positions in your portfolio"
          icon={<Wallet className="w-5 h-5" />}
          size="sm"
        />
        <KPICard
          title="Gain/Loss"
          value={totalUnrealizedGainLoss !== 0 ? formatCurrency(totalUnrealizedGainLoss) : "—"}
          description="Unrealized gain or loss on current holdings"
          change={totalUnrealizedGainLoss !== 0 ? (totalUnrealizedGainLoss / (totalValue - totalUnrealizedGainLoss) * 100) : undefined}
          variant={totalUnrealizedGainLoss >= 0 ? "success" : "danger"}
          size="sm"
        />
        <KPICard
          title="Risk"
          value={holdingsCount > 0 ? riskBucket : "—"}
          description="Portfolio risk level based on allocation"
          icon={<Shield className="w-5 h-5" />}
          variant={riskBucket === "Aggressive" ? "warning" : riskBucket === "Conservative" ? "info" : "default"}
          size="sm"
        />
      </div>

      {/* Asset Allocation & Income Row - Always 2 columns; placeholder when no income */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {/* Asset Allocation */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <AssetAllocationDonut 
              data={allocationData} 
              height={hasMeaningfulIncome ? 140 : 160} 
              showLegend={true}
            />
          </CardContent>
        </Card>

        {/* Income card or placeholder */}
        {hasMeaningfulIncome ? (
          <IncomeDetailCard
            incomeSummary={portfolioData.income_summary}
            incomeDetail={portfolioData.income_detail}
            ytdMetrics={portfolioData.ytd_metrics}
          />
        ) : (
          <Card variant="none" effect="glass" showRipple={false}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-muted-foreground" />
                Income
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex items-center justify-center min-h-[120px]">
              <p className="text-sm text-muted-foreground text-center">
                This information is not available.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Movers & Portfolio Metrics Row - Always 2 columns when we have holdings; placeholder when no movers */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {hasTopMovers ? (
            <TopMoversCard holdings={holdings} maxItems={3} />
          ) : (
            <Card variant="none" effect="glass" showRipple={false}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  Top Movers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex items-center justify-center min-h-[120px]">
                <p className="text-sm text-muted-foreground text-center">
                  This information is not available.
                </p>
              </CardContent>
            </Card>
          )}
          <PortfolioMetricsCard holdings={weightedHoldings} totalValue={totalValue} />
        </div>
      )}

      {/* No Holdings Data Message */}
      {holdings.length === 0 && totalValue > 0 && (
        <Card variant="muted" effect="glass" showRipple={false}>
          <CardContent className="p-4 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">No Holdings Data</p>
            <p className="text-xs text-muted-foreground mb-3">
              Individual holdings weren&apos;t extracted.
            </p>
            {onReupload && (
              <button
                onClick={onReupload}
                className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <Upload className="w-4 h-4" />
                Re-upload statement
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cash Flow & Realized G/L Row - Always 2 columns when hasCashFlow; placeholder when no realized G/L */}
      {hasCashFlow && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          <CashFlowCard cashFlow={portfolioData.cash_flow} />
          {portfolioData.realized_gain_loss ? (
            <Card variant="none" effect="glass" showRipple={false}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  Realized G/L
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
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
          ) : (
            <Card variant="none" effect="glass" showRipple={false}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  Realized G/L
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex items-center justify-center min-h-[120px]">
                <p className="text-sm text-muted-foreground text-center">
                  This information is not available.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sector Allocation Chart */}
      {hasSectorData && (
        <SectorAllocationChart holdings={holdings} />
      )}

      {/* YTD Summary Card */}
      {hasYtdData && (
        <YtdSummaryCard data={ytdData} />
      )}

      {/* Margin/Short Position Warning */}
      {hasSpecialPositions && (
        <Card variant="muted" effect="glass" className="border-amber-500/30">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Special Positions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {marginPositions.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Margin Positions</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  {marginPositions.length}
                </Badge>
              </div>
            )}
            {shortPositions.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Short Positions</span>
                <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                  {shortPositions.length}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transaction Activity */}
      {hasTransactions && (
        <TransactionActivity 
          transactions={transactions} 
          maxItems={5}
        />
      )}

      {/* Cash Management Section */}
      {hasCashManagement && (
        <CashManagementCard cashManagement={portfolioData.cash_management} />
      )}

      {/* Projections & MRD Section */}
      {hasProjections && (
        <ProjectionsCard projections={portfolioData.projections_and_mrd} />
      )}

      {/* Prime Assets Section */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-semibold">Prime Assets</h2>
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
                const hasGainLoss = holding.unrealized_gain_loss !== undefined || holding.unrealized_gain_loss_pct !== undefined;
                const gainLoss = holding.unrealized_gain_loss ?? 0;
                const gainLossPct = holding.unrealized_gain_loss_pct ?? 0;
                const isHoldingPositive = gainLoss >= 0;

                return (
                  <button
                    key={`${holding.symbol}-${index}`}
                    onClick={() => onAnalyzeStock?.(holding.symbol)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{holding.symbol}</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {holding.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatNumber(holding.quantity, 4)} shares @ {formatCurrency(holding.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(holding.market_value)}
                        </p>
                        {hasGainLoss && (
                          <p
                            className={cn(
                              "text-xs",
                              isHoldingPositive ? "text-emerald-500" : "text-red-500"
                            )}
                          >
                            {formatCurrency(holding.unrealized_gain_loss ?? 0)}
                            {holding.unrealized_gain_loss_pct !== undefined && (
                              <> ({formatPercent(gainLossPct)})</>
                            )}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No holdings found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {holdings.length > 5 && (
          <button
            onClick={onManagePortfolio}
            className="w-full mt-2 py-2 text-sm text-primary hover:underline"
          >
            View all {holdings.length} holdings
          </button>
        )}
      </div>

      {/* Legal Disclosures Section */}
      {hasLegalDisclosures && (
        <LegalDisclosuresCard disclosures={portfolioData.legal_and_disclosures} />
      )}

      {/* Connect Plaid - Coming Soon */}
      <Card variant="muted" effect="glass" showRipple={false}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Connect with Plaid</h3>
                <p className="text-xs text-muted-foreground">
                  Auto-sync brokerage accounts
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
