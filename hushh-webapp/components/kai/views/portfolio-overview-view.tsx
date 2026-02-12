// components/kai/views/portfolio-overview-view.tsx

/**
 * Portfolio Overview View - Dashboard showing portfolio summary and quick actions
 *
 * Features:
 * - Summary cards (total value, gain/loss, risk profile)
 * - Quick actions: Review Losers, Import New, Settings
 * - Recent analysis history
 */

"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/lib/morphy-ux/card";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";

import {
  TrendingUp,
  TrendingDown,
  PieChart,
  AlertTriangle,
  Upload,
  Settings,
  BarChart3,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface PortfolioOverviewViewProps {
  holdingsCount: number;
  portfolioValue?: string;
  totalGainLossPct?: number;
  winnersCount?: number;
  losersCount?: number;
  riskProfile?: string;
  kpis?: Record<string, unknown>;
  onReviewLosers?: () => void;
  onImportNew?: () => void;
  onSettings?: () => void;
  onAnalyzeStock?: (symbol?: string) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioOverviewView({
  holdingsCount,
  portfolioValue,
  totalGainLossPct,
  winnersCount = 0,
  losersCount = 0,
  riskProfile = "balanced",
  kpis: _kpis,
  onReviewLosers,
  onImportNew,
  onSettings,
  onAnalyzeStock,
}: PortfolioOverviewViewProps) {
  const valueBucketLabels: Record<string, string> = {
    under_10k: "< $10K",
    "10k_50k": "$10K - $50K",
    "50k_100k": "$50K - $100K",
    "100k_500k": "$100K - $500K",
    "500k_1m": "$500K - $1M",
    over_1m: "> $1M",
  };

  const riskColors: Record<string, string> = {
    conservative: "text-emerald-500",
    balanced: "text-amber-500",
    aggressive: "text-red-500",
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Overview</h1>
        <p className="text-muted-foreground">
          Your investment portfolio at a glance
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Holdings Count */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <PieChart className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Holdings</span>
            </div>
            <p className="text-3xl font-bold">{holdingsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tracked positions
            </p>
          </CardContent>
        </Card>

        {/* Portfolio Value */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Value Range</span>
            </div>
            <p className="text-2xl font-bold">
              {portfolioValue
                ? valueBucketLabels[portfolioValue] || portfolioValue
                : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated range
            </p>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Performance</span>
            </div>
            <p
              className={cn(
                "text-3xl font-bold",
                totalGainLossPct !== undefined
                  ? totalGainLossPct >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                  : ""
              )}
            >
              {totalGainLossPct !== undefined
                ? `${totalGainLossPct >= 0 ? "+" : ""}${totalGainLossPct.toFixed(1)}%`
                : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total gain/loss
            </p>
          </CardContent>
        </Card>

        {/* Risk Profile */}
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Risk Profile</span>
            </div>
            <p className={cn("text-2xl font-bold capitalize", riskColors[riskProfile])}>
              {riskProfile}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Investment style
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Winners/Losers Card */}
      {(winnersCount > 0 || losersCount > 0) && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{winnersCount}</p>
                  <p className="text-sm text-muted-foreground">Winners</p>
                </div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="flex items-center gap-4">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{losersCount}</p>
                  <p className="text-sm text-muted-foreground">Losers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>
            Common tasks for managing your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Review Losers */}
            {losersCount > 0 && onReviewLosers && (
              <MorphyButton
                variant="none"
                effect="glass"
                className="h-auto p-6 flex flex-col items-start gap-3"
                onClick={onReviewLosers}
                icon={{
                  icon: AlertTriangle,
                  gradient: false,
                }}
              >
                <div className="w-full text-left">
                  <h4 className="font-semibold mb-1">Review Losers</h4>
                  <p className="text-xs text-muted-foreground">
                    {losersCount} position{losersCount > 1 ? "s" : ""} need attention
                  </p>
                </div>
              </MorphyButton>
            )}
            {/* Analyze Stock */}
            {onAnalyzeStock && (
              <MorphyButton
                variant="none"
                effect="glass"
                className="h-auto p-6 flex flex-col items-start gap-3"
                onClick={() => onAnalyzeStock()}
                icon={{
                  icon: BarChart3,
                  gradient: false,
                }}
              >
                <div className="w-full text-left">
                  <h4 className="font-semibold mb-1">Analyze Stock</h4>
                  <p className="text-xs text-muted-foreground">
                    Get Kai's investment analysis
                  </p>
                </div>
              </MorphyButton>
            )}
            {/* Import New */}
            {onImportNew && (
              <MorphyButton
                variant="none"
                effect="glass"
                className="h-auto p-6 flex flex-col items-start gap-3"
                onClick={onImportNew}
                icon={{
                  icon: Upload,
                  gradient: false,
                }}
              >
                <div className="w-full text-left">
                  <h4 className="font-semibold mb-1">Import New</h4>
                  <p className="text-xs text-muted-foreground">
                    Update with latest statement
                  </p>
                </div>
              </MorphyButton>
            )}
            {/* Settings */}
            {onSettings && (
              <MorphyButton
                variant="none"
                effect="glass"
                className="h-auto p-6 flex flex-col items-start gap-3"
                onClick={onSettings}
                icon={{
                  icon: Settings,
                  gradient: false,
                }}
              >
                <div className="w-full text-left">
                  <h4 className="font-semibold mb-1">Settings</h4>
                  <p className="text-xs text-muted-foreground">
                    Risk profile & preferences
                  </p>
                </div>
              </MorphyButton>
            )}

          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card variant="muted" effect="glass" showRipple={false}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">About Your Portfolio</h4>
              <p className="text-sm text-muted-foreground">
                Kai tracks your portfolio using encrypted data in your personal vault.
                All analysis happens with your privacy intact. Holdings data is organized
                into the financial domain of your World Model.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
