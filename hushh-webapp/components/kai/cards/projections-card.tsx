// components/kai/cards/projections-card.tsx

/**
 * Projections Card - Income projections and Required Minimum Distribution
 *
 * Features:
 * - Monthly income projections chart (next 12 months)
 * - Required Minimum Distribution (MRD/RMD) tracking
 * - Progress bar for MRD completion
 * - Responsive and mobile-friendly
 */

"use client";

import { useMemo } from "react";
import { TrendingUp, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// =============================================================================
// TYPES
// =============================================================================

export interface MonthlyProjection {
  month: string;
  projected_income: number;
}

export interface MRDEstimate {
  year: number;
  required_amount: number;
  amount_taken: number;
  remaining: number;
}

export interface ProjectionsAndMRD {
  estimated_cash_flow?: MonthlyProjection[];
  mrd_estimate?: MRDEstimate;
}

interface ProjectionsCardProps {
  projections?: ProjectionsAndMRD;
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: MonthlyProjection }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length || !payload[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
      <p className="text-xs text-muted-foreground">{data.month}</p>
      <p className="text-sm font-semibold">
        {formatCurrency(data.projected_income)}
      </p>
    </div>
  );
}

// =============================================================================
// MRD SECTION
// =============================================================================

interface MRDSectionProps {
  mrd: MRDEstimate;
}

function MRDSection({ mrd }: MRDSectionProps) {
  const percentComplete =
    mrd.required_amount > 0
      ? Math.min(100, (mrd.amount_taken / mrd.required_amount) * 100)
      : 0;

  const isComplete = mrd.remaining <= 0;
  const isNearDeadline = !isComplete && percentComplete < 50;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {mrd.year} Required Minimum Distribution
          </span>
        </div>
        {isComplete ? (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : isNearDeadline ? (
          <Badge
            variant="outline"
            className="bg-orange-500/10 text-orange-600 border-orange-500/30"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Action Needed
          </Badge>
        ) : (
          <Badge variant="outline">In Progress</Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{percentComplete.toFixed(0)}%</span>
        </div>
        <Progress value={percentComplete} className="h-2" />
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div>
          <p className="text-xs text-muted-foreground">Required</p>
          <p className="text-sm font-semibold">
            {formatCurrency(mrd.required_amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Taken</p>
          <p className="text-sm font-semibold text-emerald-500">
            {formatCurrency(mrd.amount_taken)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p
            className={cn(
              "text-sm font-semibold",
              mrd.remaining > 0 ? "text-orange-500" : "text-emerald-500"
            )}
          >
            {formatCurrency(mrd.remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProjectionsCard({
  projections,
  className,
}: ProjectionsCardProps) {
  const hasProjections =
    projections?.estimated_cash_flow &&
    projections.estimated_cash_flow.length > 0;
  const hasMRD = projections?.mrd_estimate;

  // Calculate total projected income
  const totalProjectedIncome = useMemo(() => {
    if (!projections?.estimated_cash_flow) return 0;
    return projections.estimated_cash_flow.reduce(
      (sum, p) => sum + (p.projected_income || 0),
      0
    );
  }, [projections?.estimated_cash_flow]);

  // Calculate average monthly income
  const avgMonthlyIncome = useMemo(() => {
    if (!projections?.estimated_cash_flow?.length) return 0;
    return totalProjectedIncome / projections.estimated_cash_flow.length;
  }, [projections?.estimated_cash_flow, totalProjectedIncome]);

  if (!hasProjections && !hasMRD) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Projections & MRD</CardTitle>
          </div>
          {hasProjections && (
            <Badge variant="secondary" className="text-xs">
              {projections!.estimated_cash_flow!.length} months
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Income Projections Chart */}
        {hasProjections && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Projected Monthly Income
              </span>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Avg: {formatCurrency(avgMonthlyIncome)}/mo
                </p>
              </div>
            </div>

            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projections!.estimated_cash_flow}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => {
                      // Extract just the month abbreviation
                      const parts = value.split(" ");
                      return parts[0]?.substring(0, 3) || value;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrencyCompact}
                    width={45}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="projected_income" radius={[4, 4, 0, 0]}>
                    {projections!.estimated_cash_flow!.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.projected_income >= avgMonthlyIncome
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted-foreground) / 0.3)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Total projected */}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Total Projected Income
              </span>
              <span className="text-sm font-semibold">
                {formatCurrency(totalProjectedIncome)}
              </span>
            </div>
          </div>
        )}

        {/* Divider if both sections present */}
        {hasProjections && hasMRD && (
          <div className="border-t border-border" />
        )}

        {/* MRD Section */}
        {hasMRD && <MRDSection mrd={projections!.mrd_estimate!} />}
      </CardContent>
    </Card>
  );
}
