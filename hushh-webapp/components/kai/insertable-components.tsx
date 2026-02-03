// components/kai/insertable-components.tsx

/**
 * Insertable UI Components for Kai Chat
 *
 * These components can be embedded within chat messages to provide
 * rich, interactive experiences.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Upload,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface InsertableComponentProps {
  type: string;
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}

// =============================================================================
// ANALYSIS COMPONENT
// =============================================================================

function AnalysisComponent({ data }: { data: Record<string, unknown> }) {
  const ticker = data.ticker as string;
  const decision = data.decision as string;
  const confidence = data.confidence as number;
  const summary = data.summary as string;
  const renaissanceTier = data.renaissanceTier as string | undefined;

  const decisionColors = {
    BUY: "text-emerald-500 bg-emerald-500/10",
    HOLD: "text-orange-500 bg-orange-500/10",
    REDUCE: "text-red-500 bg-red-500/10",
  };

  const DecisionIcon = decision === "BUY" ? TrendingUp : decision === "REDUCE" ? TrendingDown : Minus;

  return (
    <Card className="crystal-glass border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {ticker}
          </CardTitle>
          {renaissanceTier && (
            <Badge variant="outline" className="text-xs">
              {renaissanceTier} Tier
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Decision */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold",
              decisionColors[decision as keyof typeof decisionColors] || decisionColors.HOLD
            )}
          >
            <DecisionIcon className="h-4 w-4" />
            {decision}
          </div>
          <div className="text-sm text-muted-foreground">
            {Math.round(confidence * 100)}% confidence
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-sm text-muted-foreground">{summary}</p>
        )}

        {/* Confidence Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] transition-all duration-500"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PORTFOLIO IMPORT COMPONENT
// =============================================================================

function PortfolioImportComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const status = (data.status as string) || "pending";
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    // Trigger file upload
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onAction) {
        onAction("upload_portfolio", { file });
      }
      setIsUploading(false);
    };
    input.click();
  };

  const handleSkip = () => {
    if (onAction) {
      onAction("skip_portfolio", {});
    }
  };

  if (status === "complete") {
    return (
      <Card className="crystal-glass">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">Portfolio Imported</p>
            <p className="text-sm text-muted-foreground">
              {data.holdingsCount as number} holdings detected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="crystal-glass">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Upload className="h-6 w-6 text-primary" />
          <div>
            <p className="font-medium">Import Your Portfolio</p>
            <p className="text-sm text-muted-foreground">
              Upload your brokerage statement to get personalized insights
            </p>
          </div>
        </div>
        
        {/* File Upload Button */}
        <Button
          className="w-full crystal-btn-gold"
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Select CSV or PDF
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          Supports Schwab, Fidelity, Robinhood, and more
        </p>
        
        {/* Plaid Coming Soon */}
        <Button
          variant="outline"
          className="w-full opacity-60 cursor-not-allowed"
          disabled
        >
          <Shield className="h-4 w-4 mr-2" />
          Connect with Plaid (Coming Soon)
        </Button>
        
        {/* Skip Button */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// DECISION CARD COMPONENT
// =============================================================================

function DecisionCardComponent({ data }: { data: Record<string, unknown> }) {
  const decision = data as {
    ticker: string;
    decision: string;
    confidence: number;
    reasoning: string;
  };

  return (
    <Card className="crystal-glass border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg">{decision.ticker}</span>
          <Badge
            className={cn(
              decision.decision === "BUY" && "bg-emerald-500",
              decision.decision === "HOLD" && "bg-orange-500",
              decision.decision === "REDUCE" && "bg-red-500"
            )}
          >
            {decision.decision}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// LOSER REPORT COMPONENT (Interactive)
// =============================================================================

function LoserReportComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const losers = (data.losers as Array<{
    symbol: string;
    name: string;
    gain_loss_pct?: number;
    lossPercent?: number;
    gain_loss?: number;
    current_value?: number;
    currentValue?: number;
  }>) || [];
  const interactive = (data.interactive as boolean) ?? true;
  const [sortBy, setSortBy] = useState<"loss" | "value">("loss");

  if (losers.length === 0) {
    return (
      <Card className="crystal-glass">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">No Significant Losers</p>
            <p className="text-sm text-muted-foreground">
              Your portfolio looks healthy!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total loss
  const totalLoss = losers.reduce((sum, l) => sum + (l.gain_loss ?? 0), 0);

  // Sort losers
  const sortedLosers = [...losers].sort((a, b) => {
    if (sortBy === "loss") {
      return (a.gain_loss_pct ?? a.lossPercent ?? 0) - (b.gain_loss_pct ?? b.lossPercent ?? 0);
    }
    return (b.current_value ?? b.currentValue ?? 0) - (a.current_value ?? a.currentValue ?? 0);
  });

  const handleAnalyzeStock = (symbol: string) => {
    if (onAction && interactive) {
      onAction("analyze_loser", { symbol });
    }
  };

  const handleAnalyzeAll = () => {
    if (onAction && interactive) {
      onAction("analyze_all_losers", { symbols: losers.map(l => l.symbol) });
    }
  };

  return (
    <Card className="crystal-glass border-red-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Portfolio Losers ({losers.length})
          </CardTitle>
          {totalLoss < 0 && (
            <span className="text-sm text-red-500 font-medium">
              ${Math.abs(totalLoss).toLocaleString()} total loss
            </span>
          )}
        </div>
        {/* Sort Toggle */}
        <div className="flex gap-2 mt-2">
          <Button
            variant={sortBy === "loss" ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setSortBy("loss")}
          >
            By Loss %
          </Button>
          <Button
            variant={sortBy === "value" ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setSortBy("value")}
          >
            By Value
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedLosers.slice(0, 5).map((loser, idx) => {
          const lossPercent = loser.gain_loss_pct ?? loser.lossPercent ?? 0;
          const currentValue = loser.current_value ?? loser.currentValue ?? 0;
          
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg bg-red-500/5",
                interactive && "cursor-pointer hover:bg-red-500/10 transition-colors"
              )}
              onClick={() => handleAnalyzeStock(loser.symbol)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{loser.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  {loser.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-red-500 font-medium">
                    {lossPercent.toFixed(1)}%
                  </span>
                  {currentValue > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ${currentValue.toLocaleString()}
                    </span>
                  )}
                </div>
                {interactive && (
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
        {losers.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{losers.length - 5} more positions
          </p>
        )}
        {interactive && losers.length > 1 && (
          <Button
            className="w-full mt-3 crystal-btn-gold"
            size="sm"
            onClick={handleAnalyzeAll}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyze All Losers
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// LOSER ANALYSIS PROMPT COMPONENT
// =============================================================================

function LoserAnalysisPromptComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const losers = (data.losers as Array<{
    symbol: string;
    name: string;
    gain_loss_pct?: number;
  }>) || [];
  const topLosers = losers.slice(0, 3);

  const handleAnalyze = (symbol: string) => {
    if (onAction) {
      onAction("analyze_loser", { symbol });
    }
  };

  return (
    <Card className="crystal-glass border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <p className="font-medium">Ready to Analyze</p>
            <p className="text-sm text-muted-foreground">
              Which position would you like me to analyze first?
            </p>
          </div>
        </div>
        
        {/* Quick Select Buttons */}
        <div className="flex flex-wrap gap-2">
          {topLosers.map((loser) => (
            <Button
              key={loser.symbol}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => handleAnalyze(loser.symbol)}
            >
              <span className="font-medium">{loser.symbol}</span>
              <span className="text-red-500 text-xs">
                {(loser.gain_loss_pct ?? 0).toFixed(1)}%
              </span>
            </Button>
          ))}
        </div>
        
        {losers.length > 3 && (
          <p className="text-xs text-muted-foreground">
            Or type any ticker to analyze
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ANALYSIS SUMMARY COMPONENT (Compact)
// =============================================================================

function AnalysisSummaryComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const ticker = data.ticker as string;
  const decision = data.decision as string;
  const confidence = data.confidence as number;
  const summary = data.summary as string;
  const hasFullAnalysis = data.hasFullAnalysis as boolean;
  const renaissanceTier = data.renaissance_tier as string | undefined;
  const isRenaissanceInvestable = data.is_renaissance_investable as boolean;

  const decisionColors = {
    BUY: "bg-emerald-500",
    HOLD: "bg-orange-500",
    REDUCE: "bg-red-500",
  };

  const tierColors = {
    ACE: "bg-gradient-to-r from-purple-400 to-pink-500 text-white",
    KING: "bg-gradient-to-r from-purple-500 to-indigo-500",
    QUEEN: "bg-gradient-to-r from-pink-500 to-rose-500",
    JACK: "bg-gradient-to-r from-blue-500 to-cyan-500",
  };

  const handleViewDetails = () => {
    if (onAction) {
      onAction("view_full_analysis", { ticker });
    }
  };

  return (
    <Card className="crystal-glass border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">{ticker}</span>
            <Badge
              className={cn(
                decisionColors[decision as keyof typeof decisionColors] || "bg-gray-500"
              )}
            >
              {decision}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {Math.round(confidence * 100)}%
            </span>
          </div>
          {/* Renaissance Tier Badge */}
          {renaissanceTier && (
            <Badge
              className={cn(
                "text-xs font-semibold",
                tierColors[renaissanceTier as keyof typeof tierColors] || "bg-gray-500"
              )}
            >
              {renaissanceTier}
            </Badge>
          )}
        </div>
        
        {/* Renaissance Status */}
        {isRenaissanceInvestable === false && (
          <p className="text-xs text-orange-500 mb-2">
            Not in Renaissance investable universe
          </p>
        )}
        
        {summary && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {summary}
          </p>
        )}
        
        {hasFullAnalysis && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleViewDetails}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Full Analysis
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PORTFOLIO SUMMARY COMPONENT
// =============================================================================

function PortfolioSummaryComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const holdingsCount = data.holdings_count as number;
  const valueBucket = data.portfolio_value_bucket as string;
  const losersCount = data.losers_count as number;
  const winnersCount = data.winners_count as number;
  const riskBucket = data.risk_bucket as string;
  const totalGainLossPct = data.total_gain_loss_pct as number;

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
    moderate: "text-orange-500",
    aggressive: "text-red-500",
  };

  const handleAction = (action: string) => {
    if (onAction) {
      onAction(action, {});
    }
  };

  return (
    <Card className="crystal-glass border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-5 w-5 text-primary" />
          Portfolio Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="text-xl font-bold">{holdingsCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Value Range</p>
            <p className="text-lg font-semibold">
              {valueBucketLabels[valueBucket] || valueBucket}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Performance</p>
            <p className={cn(
              "text-lg font-semibold",
              totalGainLossPct >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {totalGainLossPct >= 0 ? "+" : ""}{totalGainLossPct?.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Risk Profile</p>
            <p className={cn("text-lg font-semibold capitalize", riskColors[riskBucket])}>
              {riskBucket}
            </p>
          </div>
        </div>

        {/* Winners/Losers */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-sm">{winnersCount} Winners</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm">{losersCount} Losers</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {losersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleAction("review_losers")}
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Review Losers
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleAction("import_new")}
          >
            <Upload className="h-4 w-4 mr-1" />
            Update
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CONSENT REQUEST COMPONENT
// =============================================================================

function ConsentRequestComponent({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const scope = data.scope as string;
  const status = (data.status as string) || "pending";
  const agentName = data.agentName as string;

  if (status === "approved") {
    return (
      <Card className="crystal-glass">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">Consent Granted</p>
            <p className="text-sm text-muted-foreground">
              {agentName} can now access {scope}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="crystal-glass border-orange-500/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-orange-500" />
          <div>
            <p className="font-medium">Consent Request</p>
            <p className="text-sm text-muted-foreground">
              {agentName} is requesting access to {scope}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => onAction?.("deny_consent", { scope })}
          >
            Deny
          </Button>
          <Button
            className="flex-1 crystal-btn-gold"
            onClick={() => onAction?.("approve_consent", { scope })}
          >
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT ROUTER
// =============================================================================

export function InsertableComponent({
  type,
  data,
  onAction,
}: InsertableComponentProps) {
  switch (type) {
    case "analysis":
      return <AnalysisComponent data={data} />;
    case "portfolio_import":
      return <PortfolioImportComponent data={data} onAction={onAction} />;
    case "decision_card":
      return <DecisionCardComponent data={data} />;
    case "loser_report":
      return <LoserReportComponent data={data} onAction={onAction} />;
    case "loser_analysis_prompt":
      return <LoserAnalysisPromptComponent data={data} onAction={onAction} />;
    case "analysis_summary":
      return <AnalysisSummaryComponent data={data} onAction={onAction} />;
    case "portfolio_summary":
      return <PortfolioSummaryComponent data={data} onAction={onAction} />;
    case "consent_request":
      return <ConsentRequestComponent data={data} onAction={onAction} />;
    default:
      return (
        <Card className="crystal-glass">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Unknown component type: {type}
            </p>
          </CardContent>
        </Card>
      );
  }
}
