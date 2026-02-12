// components/kai/charts/sector-allocation-chart.tsx

/**
 * Sector Allocation Chart
 * 
 * Features:
 * - Horizontal bar chart showing portfolio allocation by sector
 * - Interactive bars with hover effects
 * - Responsive design with shadcn ChartContainer
 * - Theme-aware colors from design system
 * - Shows both value and percentage
 */

"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Holding {
  symbol: string;
  name: string;
  market_value: number;
  sector?: string;
  asset_type?: string;
}

interface SectorAllocationChartProps {
  holdings: Holding[];
  className?: string;
  responsive?: boolean;
}

// Theme-aware colors using CSS variables (oklch in globals - use var() directly)
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--accent)",
  "var(--destructive)",
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function _formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function SectorAllocationChart({
  holdings,
  className,
  responsive = true,
}: SectorAllocationChartProps) {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (!responsive) return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [responsive]);
  // Aggregate holdings by sector
  const sectorData = useMemo(() => {
    const sectorMap = new Map<string, { value: number; count: number }>();
    
    holdings.forEach((holding) => {
      const sector = holding.sector || holding.asset_type || "Unknown";
      const normalizedSector = sector.charAt(0).toUpperCase() + sector.slice(1).toLowerCase();
      
      const existing = sectorMap.get(normalizedSector) || { value: 0, count: 0 };
      sectorMap.set(normalizedSector, {
        value: existing.value + (holding.market_value || 0),
        count: existing.count + 1,
      });
    });

    const totalValue = Array.from(sectorMap.values()).reduce((sum, s) => sum + s.value, 0);
    
    // Convert to array and sort by value, assign colors by index
    const data = Array.from(sectorMap.entries())
      .map(([name, { value, count }]) => ({
        name,
        value,
        count,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // Top 8 sectors
      .map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));

    return { data, total: totalValue };
  }, [holdings]);

  // Responsive dimensions
  const chartHeight = useMemo(() => {
    if (!responsive) return 200;
    // Mobile: 140px, Tablet: 160px, Desktop: 200px
    if (windowWidth < 640) return 140;
    if (windowWidth < 1024) return 160;
    return 200;
  }, [responsive, windowWidth]);

  const leftMargin = useMemo(() => {
    if (!responsive) return 80;
    // Mobile: 50px, Tablet: 60px, Desktop: 80px
    if (windowWidth < 640) return 50;
    if (windowWidth < 1024) return 60;
    return 80;
  }, [responsive, windowWidth]);

  // Chart config for shadcn ChartContainer
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    sectorData.data.forEach((sector) => {
      config[sector.name] = {
        label: sector.name,
        color: sector.color,
      };
    });
    return config;
  }, [sectorData.data]);

  if (sectorData.data.length === 0) {
    return null;
  }

  return (
    <Card variant="muted" effect="glass" className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-primary" />
          Sector Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ChartContainer config={chartConfig} className="w-full" style={{ height: `${chartHeight}px` }}>
          <BarChart
            data={sectorData.data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: leftMargin, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={(value) => formatCurrency(value)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={75}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const payload = item.payload as {
                      value: number;
                      count: number;
                    };
                    return (
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground text-base font-bold">{formatCurrency(payload.value)}</span>
                        <span className="text-muted-foreground text-xs">
                          {payload.count} holding{payload.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              animationDuration={800}
            >
              {sectorData.data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Summary - simplified legend */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-3">
            {sectorData.data.slice(0, 4).map((sector, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-foreground">{sector.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SectorAllocationChart;
