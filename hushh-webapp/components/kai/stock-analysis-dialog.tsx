"use client";

import {
  Search,
  BarChart3,
  Shield,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/morphy-ux/cn";
import { Button, buttonVariants } from "@/lib/morphy-ux/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/lib/morphy-ux/card";

interface StockAnalysisDialogProps {
  ticker: string;
  context?: any;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function StockAnalysisDialog({
  ticker,
  context,
  onConfirm,
  onCancel,
  isOpen,
}: StockAnalysisDialogProps) {
  if (!isOpen) return null;

  const holdings = context?.holdings || [];
  const hasHoldings = holdings.some((h: any) => h.symbol === ticker);
  const portfolioAllocation = context?.portfolio_allocation || {
    equities_pct: 70,
    bonds_pct: 20,
    cash_pct: 10,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog - Using Morphy UX Card */}
      <Card
        variant="none"
        effect="glass"
        className="relative w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden"
      >
        {/* Header */}
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-6 h-6 text-[var(--morphy-primary-start)]" />
            <CardTitle>Analyze {ticker}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Kai will analyze {ticker} using live data and your portfolio context
          </p>
        </CardHeader>

        {/* What Kai Will Do */}
        <CardContent className="space-y-4">
          {/* Fundamental Analysis */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--morphy-primary-start)] to-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-transparent">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-sm">Fundamental Analysis</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Analyzes SEC 10-K/10-Q filings, financial health, and business moat
              </p>
            </div>
          </div>

          {/* Sentiment Analysis */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-[var(--morphy-primary-end)] flex items-center justify-center shrink-0 mt-0.5 border border-transparent">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-sm">Sentiment Analysis</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scans news, earnings calls, and market momentum signals
              </p>
            </div>
          </div>

          {/* Valuation Analysis */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-[var(--morphy-primary-start)] flex items-center justify-center shrink-0 mt-0.5 border border-transparent">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-sm">Valuation Analysis</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calculates P/E ratios, DCF models, and peer comparisons
              </p>
            </div>
          </div>

          {/* Multi-Agent Debate */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-[var(--morphy-primary-end)] flex items-center justify-center shrink-0 mt-0.5 border border-transparent">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-sm">Multi-Agent Debate</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Three agents debate and reach consensus with full reasoning
              </p>
            </div>
          </div>

          {/* Decision Card */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--morphy-primary-start)] to-purple-600 flex items-center justify-center shrink-0 mt-0.5 border border-transparent">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-sm">Decision Card</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete analysis with sources, math, and legal disclaimer
              </p>
            </div>
          </div>
        </CardContent>

        {/* Portfolio Context */}
        {hasHoldings && (
          <div className="px-6 py-4 bg-gradient-to-r from-[var(--morphy-primary-start)]/5 to-transparent border-y border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Your Portfolio Context:
            </p>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Allocation:</span>
                <span className="ml-1 font-medium">
                  {portfolioAllocation.equities_pct}% Equities
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Position:</span>
                <span className="ml-1 font-medium text-[var(--morphy-primary-start)]">
                  {holdings.find((h: any) => h.symbol === ticker)?.quantity ||
                    0}{" "}
                  shares
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Legal Disclaimer */}
        <div className="px-6 py-4 bg-red-500/10 border-t border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              ⚠️ This analysis is for EDUCATIONAL PURPOSES ONLY. It is NOT
              investment advice. Always consult a licensed financial professional
              before making investment decisions.
            </p>
          </div>
        </div>

        {/* Actions */}
        <CardFooter className="px-6 py-4 border-t border-border flex gap-3">
          <Button
            onClick={onCancel}
            variant="muted"
            size="default"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="gradient"
            effect="glass"
            size="default"
            className="flex-1"
          >
            Start Analysis
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default StockAnalysisDialog;