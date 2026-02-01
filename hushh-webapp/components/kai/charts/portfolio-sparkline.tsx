// components/kai/charts/portfolio-sparkline.tsx

/**
 * Portfolio Sparkline - Mini area chart for portfolio performance
 * 
 * Features:
 * - Responsive area chart with gradient fill
 * - Color changes based on positive/negative performance
 * - Smooth animations
 * - Touch-friendly for mobile
 */

"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

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

  const fillColor = isPositive ? "#10b981" : "#ef4444";
  const gradientId = `sparkline-gradient-${isPositive ? "positive" : "negative"}`;

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
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: showAxes ? 45 : 0, bottom: showAxes ? 20 : 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <XAxis 
            dataKey="date" 
            hide={!showAxes}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis 
            hide={!showAxes}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={formatAxisValue}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["dataMin - 1000", "dataMax + 1000"]}
          />
          
          {showTooltip && (
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length || !payload[0]) return null;
                const point = payload[0].payload as SparklineDataPoint;
                return (
                  <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-muted-foreground">{point.date}</p>
                    <p className="text-sm font-semibold">{formatCurrency(point.value)}</p>
                  </div>
                );
              }}
            />
          )}
          
          <Area
            type="monotone"
            dataKey="value"
            stroke={fillColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PortfolioSparkline;
