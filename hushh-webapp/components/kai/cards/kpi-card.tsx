// components/kai/cards/kpi-card.tsx

/**
 * KPI Card - Material 3 Expressive card for displaying key metrics
 * 
 * Features:
 * - Glass-morphism effect
 * - Trend indicator with color coding
 * - Icon support
 * - Multiple variants (default, success, warning, danger)
 * - Ripple effect on interaction
 */

"use client";

import { Card, CardContent } from "@/lib/morphy-ux/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: "bg-card border-border",
  success: "bg-emerald-500/10 border-emerald-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  danger: "bg-red-500/10 border-red-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
};

const sizeStyles = {
  sm: {
    padding: "p-3",
    title: "text-xs",
    value: "text-lg",
    change: "text-xs",
    icon: "w-4 h-4",
  },
  md: {
    padding: "p-4",
    title: "text-xs",
    value: "text-2xl",
    change: "text-sm",
    icon: "w-5 h-5",
  },
  lg: {
    padding: "p-5",
    title: "text-sm",
    value: "text-3xl",
    change: "text-sm",
    icon: "w-6 h-6",
  },
};

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon,
  variant = "default",
  size = "md",
  onClick,
  className,
}: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;
  const isNeutral = change === 0;
  const styles = sizeStyles[size];

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isNeutral
    ? "text-muted-foreground"
    : isPositive
    ? "text-emerald-500"
    : "text-red-500";

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple={!!onClick}
      className={cn(
        "border transition-all duration-200",
        variantStyles[variant],
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className={styles.padding}>
        {/* Header with icon and title */}
        <div className="flex items-center justify-between mb-2">
          {icon && (
            <div className={cn("text-muted-foreground", styles.icon)}>
              {icon}
            </div>
          )}
          <span className={cn("text-muted-foreground", styles.title, !icon && "w-full")}>
            {title}
          </span>
        </div>

        {/* Value */}
        <p className={cn("font-bold tracking-tight", styles.value)}>{value}</p>

        {/* Change indicator */}
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 mt-1", styles.change, trendColor)}>
            <TrendIcon className="w-4 h-4" />
            <span>
              {isPositive && !isNeutral ? "+" : ""}
              {change.toFixed(2)}%
            </span>
            {changeLabel && (
              <span className="text-muted-foreground">({changeLabel})</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KPICard;
