// components/kai/charts/portfolio-sparkline.tsx

/**
 * Portfolio Sparkline - Mini area chart for portfolio performance
 * 
 * Features:
 * - Responsive area chart with gradient fill
 * - Color changes based on positive/negative performance
 * - Smooth animations
 * - Touch-friendly for mobile
 * - Dark mode support via shadcn ChartContainer
 */

"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface SparklineDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface PortfolioSparklineProps {
  data: SparklineDataPoint[];
  height?: number;
  showTooltip?: boolean;
  showAxes?: boolean;
  className?: string;
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

export function PortfolioSparkline({
  data,
  height = 80,
  showTooltip = true,
  showAxes = false,
  className,
}: PortfolioSparklineProps) {
  // Determine if performance is positive
  const isPositive = useMemo(() => {
    if (data.length < 2) return true;
    const lastValue = data[data.length - 1]?.value ?? 0;
    const firstValue = data[0]?.value ?? 0;
    return lastValue >= firstValue;
  }, [data]);

  // Use CSS variables for theme-aware colors
  const chartColor = isPositive ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
  const gradientId = `sparkline-gradient-${isPositive ? "positive" : "negative"}`;

  // Chart config for shadcn ChartContainer
  const chartConfig = useMemo<ChartConfig>(() => ({
    value: {
      label: "Portfolio Value",
      color: chartColor,
    },
  }), [chartColor]);

  // Generate mock data if none provided
  const chartData = useMemo(() => {
    if (data.length > 0) return data;
    
    // Generate sample data for demo
    const baseValue = 100000;
    const points: SparklineDataPoint[] = [];
    for (let i = 0; i < 30; i++) {
      const variance = (Math.random() - 0.5) * 5000;
      const trend = i * 100; // Slight upward trend
      points.push({
        date: `Day ${i + 1}`,
        value: baseValue + trend + variance,
      });
    }
    return points;
  }, [data]);

  return (
    <ChartContainer 
      config={chartConfig} 
      className={cn("w-full", className)}
      style={{ height }}
    >
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 5, left: showAxes ? 45 : 0, bottom: showAxes ? 20 : 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <XAxis 
          dataKey="date" 
          hide={!showAxes}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <YAxis 
          hide={!showAxes}
          tickFormatter={formatAxisValue}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={["dataMin - 1000", "dataMax + 1000"]}
        />
        
        {showTooltip && (
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatAxisValue(value as number)}
                labelKey="date"
              />
            }
          />
        )}
        
        <Area
          type="monotone"
          dataKey="value"
          stroke={chartColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export default PortfolioSparkline;
