// components/kai/charts/asset-allocation-donut.tsx

/**
 * Asset Allocation Donut Chart
 * 
 * Features:
 * - Donut chart showing portfolio allocation
 * - Interactive segments with hover effects
 * - Center label showing total or selected segment
 * - Responsive design
 */

"use client";

import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

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

// Default colors for asset types
const DEFAULT_COLORS: Record<string, string> = {
  cash: "#6366f1",      // Indigo
  equities: "#10b981",  // Emerald
  bonds: "#f59e0b",     // Amber
  etf: "#8b5cf6",       // Violet
  mutual_funds: "#ec4899", // Pink
  other: "#64748b",     // Slate
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function AssetAllocationDonut({
  data,
  height = 200,
  showLegend = true,
  className,
}: AssetAllocationDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Calculate total and percentages
  const { chartData, total } = useMemo(() => {
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    const processedData = data
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        percent: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        color: item.color || DEFAULT_COLORS[item.name.toLowerCase()] || DEFAULT_COLORS.other,
      }));
    return { chartData: processedData, total: totalValue };
  }, [data]);

  // Get center label content
  const centerLabel = useMemo(() => {
    if (activeIndex !== null && chartData[activeIndex]) {
      const item = chartData[activeIndex];
      return {
        title: item.name,
        value: formatCurrency(item.value),
        percent: formatPercent(item.percent || 0),
      };
    }
    return {
      title: "Total",
      value: formatCurrency(total),
      percent: "100%",
    };
  }, [activeIndex, chartData, total]);

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <p className="text-sm text-muted-foreground">No allocation data</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                  style={{
                    filter: activeIndex === index ? "brightness(1.1)" : "none",
                    transition: "filter 0.2s ease",
                    cursor: "pointer",
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length || !payload[0]) return null;
                const item = payload[0].payload as AllocationData & { percent: number };
                return (
                  <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                    <p className="text-sm font-semibold">{formatCurrency(item.value)}</p>
                    <p className="text-xs text-muted-foreground">{formatPercent(item.percent)}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{centerLabel.title}</p>
            <p className="text-lg font-bold">{centerLabel.value}</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {chartData.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-1.5 text-xs cursor-pointer transition-opacity",
                activeIndex !== null && activeIndex !== index && "opacity-50"
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{formatPercent(item.percent || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssetAllocationDonut;
