// components/kai/charts/portfolio-history-chart.tsx

/**
 * Portfolio History Chart - Real data visualization
 * 
 * Features:
 * - Displays actual historical portfolio values from brokerage statements
 * - Uses shadcn ChartContainer for proper dark mode support
 * - Graceful fallback to period summary when no historical data
 * - Responsive and mobile-friendly
 */

"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/lib/morphy-ux/card";

// =============================================================================
// TYPES
// =============================================================================

export interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface PortfolioHistoryChartProps {
  data?: HistoricalDataPoint[];
  beginningValue?: number;
  endingValue?: number;
  statementPeriod?: string;
  height?: number;
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

function formatAxisValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// =============================================================================
// PERIOD SUMMARY FALLBACK
// =============================================================================

interface PeriodSummaryProps {
  beginningValue: number;
  endingValue: number;
  statementPeriod?: string;
}

function PeriodSummaryFallback({ 
  beginningValue, 
  endingValue, 
  statementPeriod 
}: PeriodSummaryProps) {
  const changeInValue = endingValue - beginningValue;
  const changePercent = beginningValue > 0 
    ? ((changeInValue / beginningValue) * 100) 
    : 0;
  const isPositive = changeInValue >= 0;

  return (
    <div className="space-y-4">
      {statementPeriod && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{statementPeriod}</span>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Beginning Value</p>
          <p className="text-lg font-semibold">{formatCurrency(beginningValue)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Ending Value</p>
          <p className="text-lg font-semibold">{formatCurrency(endingValue)}</p>
        </div>
      </div>
      
      <div className={cn(
        "flex items-center justify-center gap-2 py-3 rounded-lg",
        isPositive ? "bg-emerald-500/10" : "bg-red-500/10"
      )}>
        {isPositive ? (
          <TrendingUp className={cn("w-5 h-5", isPositive ? "text-emerald-500" : "text-red-500")} />
        ) : (
          <TrendingDown className={cn("w-5 h-5", isPositive ? "text-emerald-500" : "text-red-500")} />
        )}
        <span className={cn(
          "font-medium",
          isPositive ? "text-emerald-500" : "text-red-500"
        )}>
          {formatCurrency(Math.abs(changeInValue))} ({formatPercent(changePercent)})
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioHistoryChart({
  data,
  beginningValue = 0,
  endingValue = 0,
  statementPeriod,
  height = 200,
  className,
}: PortfolioHistoryChartProps) {
  // Determine if we have enough data for a chart
  const hasChartData = data && data.length >= 2;
  
  // Calculate if performance is positive
  const isPositive = useMemo(() => {
    if (hasChartData && data) {
      return data[data.length - 1].value >= data[0].value;
    }
    return endingValue >= beginningValue;
  }, [data, hasChartData, beginningValue, endingValue]);

  // Chart config for shadcn ChartContainer
  const chartConfig = useMemo<ChartConfig>(() => ({
    value: {
      label: "Portfolio Value",
      color: isPositive ? "hsl(var(--chart-2))" : "hsl(var(--destructive))",
    },
  }), [isPositive]);

  const strokeColor = isPositive ? "var(--chart-2)" : "var(--destructive)";
  const fillColor = isPositive ? "#10b981" : "#ef4444";

  // If no historical data, show period summary fallback
  if (!hasChartData) {
    if (beginningValue > 0 || endingValue > 0) {
      return (
        <Card variant="none" effect="glass" showRipple={false} className={className}>
          <CardContent className="p-4">
            <PeriodSummaryFallback
              beginningValue={beginningValue}
              endingValue={endingValue}
              statementPeriod={statementPeriod}
            />
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card variant="none" effect="glass" showRipple={false} className={className}>
      <CardContent className="p-4">
        {statementPeriod && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
            <Calendar className="w-4 h-4" />
            <span>{statementPeriod}</span>
          </div>
        )}
        
        <ChartContainer 
          config={chartConfig} 
          className="w-full"
          style={{ height }}
        >
          <AreaChart
            data={data}
            accessibilityLayer
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tickFormatter={formatAxisValue}
              width={55}
              domain={["dataMin * 0.95", "dataMax * 1.05"]}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
            <defs>
              <linearGradient id="portfolioHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              dataKey="value"
              type="monotone"
              fill="url(#portfolioHistoryGradient)"
              stroke={fillColor}
              strokeWidth={2}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ChartContainer>
        
        <p className="text-xs text-muted-foreground text-center mt-2">
          Portfolio Value Over Time
        </p>
      </CardContent>
    </Card>
  );
}

export default PortfolioHistoryChart;
