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
    HOLD: "text-amber-500 bg-amber-500/10",
    REDUCE: "text-red-500 bg-red-500/10",
  };

  const DecisionIcon = decision === "BUY" ? TrendingUp : decision === "REDUCE" ? TrendingDown : Minus;

  return (
    <Card className="crystal-glass border-[var(--crystal-gold-400)]/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[var(--crystal-gold-500)]" />
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
            className="h-full bg-gradient-to-r from-[var(--crystal-gold-400)] to-[var(--crystal-gold-600)] transition-all duration-500"
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

  if (status === "complete") {
    return (
      <Card className="crystal-glass-gold">
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
          <Upload className="h-6 w-6 text-[var(--crystal-gold-500)]" />
          <div>
            <p className="font-medium">Import Your Portfolio</p>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or PDF brokerage statement
            </p>
          </div>
        </div>
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
              Select File
            </>
          )}
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
    <Card className="crystal-glass border-[var(--crystal-gold-400)]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg">{decision.ticker}</span>
          <Badge
            className={cn(
              decision.decision === "BUY" && "bg-emerald-500",
              decision.decision === "HOLD" && "bg-amber-500",
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
// LOSER REPORT COMPONENT
// =============================================================================

function LoserReportComponent({ data }: { data: Record<string, unknown> }) {
  const losers = (data.losers as Array<{
    ticker: string;
    name: string;
    lossPercent: number;
    currentValue: number;
  }>) || [];

  if (losers.length === 0) {
    return (
      <Card className="crystal-glass-gold">
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

  return (
    <Card className="crystal-glass border-red-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Portfolio Losers ({losers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {losers.slice(0, 5).map((loser, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded-lg bg-red-500/5"
          >
            <div>
              <span className="font-medium">{loser.ticker}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {loser.name}
              </span>
            </div>
            <span className="text-red-500 font-medium">
              {loser.lossPercent.toFixed(1)}%
            </span>
          </div>
        ))}
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
      <Card className="crystal-glass-gold">
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
    <Card className="crystal-glass border-amber-500/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-amber-500" />
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
      return <LoserReportComponent data={data} />;
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
