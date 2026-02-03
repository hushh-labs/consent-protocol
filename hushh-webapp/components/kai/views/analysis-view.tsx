// components/kai/views/analysis-view.tsx

/**
 * Analysis View - Display debate engine results
 *
 * Features:
 * - Decision card with BUY/HOLD/REDUCE recommendation
 * - Confidence score with reliability badge
 * - Agent insights tabs (Fundamental, Sentiment, Valuation)
 * - Key metrics and sources
 * - Back to Dashboard button
 */

"use client";

import { useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// TYPES
// =============================================================================

export interface AnalysisResult {
  symbol: string;
  decision: "BUY" | "HOLD" | "REDUCE";
  confidence: number;
  summary: string;
  fundamentalInsights?: string;
  sentimentInsights?: string;
  valuationInsights?: string;
}

interface AnalysisViewProps {
  result: AnalysisResult;
  onBack: () => void;
  onAnalyzeAnother?: (symbol: string) => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDecisionColor(decision: string): string {
  switch (decision) {
    case "BUY":
      return "text-emerald-500";
    case "REDUCE":
      return "text-red-500";
    default:
      return "text-amber-500";
  }
}

function getDecisionBgColor(decision: string): string {
  switch (decision) {
    case "BUY":
      return "bg-emerald-500/10";
    case "REDUCE":
      return "bg-red-500/10";
    default:
      return "bg-amber-500/10";
  }
}

/** Renders the icon for a decision (no component created during render). */
function renderDecisionIcon(decision: string, className?: string): React.ReactNode {
  if (decision === "BUY") return <TrendingUp className={className} />;
  if (decision === "REDUCE") return <TrendingDown className={className} />;
  return <Minus className={className} />;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High Confidence";
  if (confidence >= 0.6) return "Moderate Confidence";
  return "Low Confidence";
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-emerald-500";
  if (confidence >= 0.6) return "text-amber-500";
  return "text-red-500";
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AnalysisView({
  result,
  onBack,
  onAnalyzeAnother,
}: AnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<"fundamental" | "sentiment" | "valuation">("fundamental");
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && onAnalyzeAnother) {
      onAnalyzeAnother(searchInput.toUpperCase());
      setSearchInput("");
    }
  };

  return (
    <div className="w-full space-y-6 pb-36">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{result.symbol}</h1>
          <p className="text-sm text-muted-foreground">Investment Analysis</p>
        </div>
      </div>

      {/* Decision Card */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  getDecisionBgColor(result.decision)
                )}
              >
                {renderDecisionIcon(
                  result.decision,
                  cn("w-6 h-6", getDecisionColor(result.decision))
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recommendation</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    getDecisionColor(result.decision)
                  )}
                >
                  {result.decision}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Confidence</p>
              <p
                className={cn(
                  "text-xl font-semibold",
                  getConfidenceColor(result.confidence)
                )}
              >
                {(result.confidence * 100).toFixed(0)}%
              </p>
              <Badge
                variant="outline"
                className={cn("mt-1", getConfidenceColor(result.confidence))}
              >
                {getConfidenceLabel(result.confidence)}
              </Badge>
            </div>
          </div>

          <p className="text-muted-foreground">{result.summary}</p>
        </CardContent>
      </Card>

      {/* Agent Insights Tabs */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Agent Insights</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {/* Tab Buttons */}
          <div className="flex gap-2 mb-4">
            {[
              { key: "fundamental", label: "Fundamental" },
              { key: "sentiment", label: "Sentiment" },
              { key: "valuation", label: "Valuation" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={cn(
                  "flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[120px] p-4 rounded-lg bg-muted/50">
            {activeTab === "fundamental" && (
              <p className="text-sm">
                {result.fundamentalInsights || "Fundamental analysis evaluates the company's financial health, including revenue growth, profit margins, debt levels, and competitive position."}
              </p>
            )}
            {activeTab === "sentiment" && (
              <p className="text-sm">
                {result.sentimentInsights || "Sentiment analysis examines market perception, news coverage, social media trends, and analyst opinions about the stock."}
              </p>
            )}
            {activeTab === "valuation" && (
              <p className="text-sm">
                {result.valuationInsights || "Valuation analysis compares the stock's current price to its intrinsic value using metrics like P/E ratio, DCF models, and peer comparisons."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card variant="muted" effect="glass" showRipple={false}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Investment Disclaimer</p>
              <p className="text-xs text-muted-foreground">
                This analysis is for informational purposes only and does not constitute
                financial advice. Past performance is not indicative of future results.
                Always conduct your own research and consult with a qualified financial
                advisor before making investment decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analyze Another Stock */}
      {onAnalyzeAnother && (
        <Card variant="none" effect="glass" showRipple={false}>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Analyze Another Stock</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                  placeholder="Enter ticker (e.g., AAPL)"
                  maxLength={5}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary transition-colors"
                />
              </div>
              <Button type="submit" disabled={!searchInput.trim()}>
                Analyze
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      <div className="text-center">
        <Button variant="none" effect="glass" onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
