// components/kai/charts/asset-allocation-donut.tsx

/**
 * Asset Allocation Donut Chart
 * 
 * Features:
 * - Donut chart showing portfolio allocation
 * - Interactive segments with hover effects
 * - Center label using Recharts Label component (proper z-index)
 * - Responsive design with shadcn ChartContainer
 * - Theme-aware colors from design system
 */

"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface AllocationData {
  name: string;
  value: number;
  color: string;
  percent?: number;
}

interface AssetAllocationDonutProps {
  data: AllocationData[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

// Theme-aware colors using CSS variables
const CHART_COLORS = [
  "var(--chart-2)",  // Emerald/Teal for equities
  "var(--chart-1)",  // Orange for cash
  "var(--chart-4)",  // Yellow for bonds
  "var(--chart-3)",  // Blue for ETF
  "var(--chart-5)",  // Orange variant for mutual funds
];

// Fallback colors for specific asset types
const DEFAULT_COLORS: Record<string, string> = {
  cash: "var(--chart-1)",
  equities: "var(--chart-2)",
  bonds: "var(--chart-4)",
  etf: "var(--chart-3)",
  mutual_funds: "var(--chart-5)",
  other: "var(--muted-foreground)",
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function AssetAllocationDonut({
  data,
  height = 200,
  showLegend = true,
  className,
}: AssetAllocationDonutProps) {
  // Calculate total and percentages
  const { chartData, total } = useMemo(() => {
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    const processedData = data
      .filter(item => item.value > 0)
      .map((item, index) => ({
        ...item,
        percent: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        // Use provided color, fallback to asset type color, then to indexed color
        color: item.color || DEFAULT_COLORS[item.name.toLowerCase()] || CHART_COLORS[index % CHART_COLORS.length],
      }));
    return { chartData: processedData, total: totalValue };
  }, [data]);

  // Chart config for shadcn ChartContainer
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    chartData.forEach((item) => {
      config[item.name] = {
        label: item.name,
        color: item.color,
      };
    });
    return config;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <p className="text-sm text-muted-foreground">No allocation data</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <ChartContainer config={chartConfig} className="mx-auto" style={{ height }}>
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name, item) => {
                  const payload = item.payload as AllocationData & { percent: number };
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-sm">{payload.name}</span>
                      <span className="text-foreground text-base font-bold">{formatCurrency(payload.value)}</span>
                      <span className="text-muted-foreground text-xs">{formatPercent(payload.percent)} of portfolio</span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={2}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="transparent"
              />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-lg font-bold"
                      >
                        {formatCurrency(total)}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 18}
                        className="fill-muted-foreground text-xs"
                      >
                        Total
                      </tspan>
                    </text>
                  );
                }
                return null;
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Legend - simplified, no percentages (tooltip shows details) */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {chartData.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssetAllocationDonut;
