/**
 * ThinkingIndicator Component
 *
 * Animated thinking/loading indicator with bouncing dots.
 * Used to show AI is processing before streaming begins.
 *
 * @example
 * <ThinkingIndicator message="Analyzing document..." />
 * <ThinkingIndicator variant="minimal" />
 */

"use client";

import { cn } from "./cn";

export interface ThinkingIndicatorProps {
  /** Message to display alongside dots */
  message?: string;
  /** Visual variant */
  variant?: "default" | "minimal" | "card";
  /** Dot color */
  color?: "primary" | "muted" | "accent";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

const dotColorClasses = {
  primary: "bg-[var(--morphy-primary-start)]",
  muted: "bg-muted-foreground",
  accent: "bg-[#fbbf24]",
} as const;

const dotSizeClasses = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
} as const;

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export function ThinkingIndicator({
  message = "Thinking...",
  variant = "default",
  color = "primary",
  size = "md",
  className,
}: ThinkingIndicatorProps) {
  const dots = (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "rounded-full animate-thinking-bounce",
            dotColorClasses[color],
            dotSizeClasses[size]
          )}
          style={{
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  );

  if (variant === "minimal") {
    return <div className={cn("flex items-center gap-2", className)}>{dots}</div>;
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-4",
          "bg-muted/30 rounded-xl border border-border/50",
          "animate-in fade-in slide-in-from-bottom-2",
          className
        )}
      >
        {dots}
        <span className={cn("text-muted-foreground", textSizeClasses[size])}>
          {message}
        </span>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-3 p-4", className)}>
      {dots}
      <span className={cn("text-muted-foreground", textSizeClasses[size])}>
        {message}
      </span>
    </div>
  );
}

/**
 * StreamingStageIndicator Component
 *
 * Shows progress through multiple stages of a streaming process.
 *
 * @example
 * <StreamingStageIndicator
 *   stages={["Upload", "Analyze", "Extract", "Complete"]}
 *   currentStage={1}
 * />
 */

export interface StreamingStageIndicatorProps {
  /** Array of stage names */
  stages: string[];
  /** Current stage index (0-based) */
  currentStage: number;
  /** Show stage labels */
  showLabels?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function StreamingStageIndicator({
  stages,
  currentStage,
  showLabels = false,
  className,
}: StreamingStageIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Progress bars */}
      <div className="flex items-center gap-1.5">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className={cn(
              "flex-1 h-1 rounded-full transition-all duration-300",
              i < currentStage
                ? "bg-[var(--morphy-primary-start)]"
                : i === currentStage
                  ? "bg-[var(--morphy-primary-start)] animate-pulse"
                  : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between mt-2">
          {stages.map((stage, i) => (
            <span
              key={stage}
              className={cn(
                "text-xs transition-colors",
                i <= currentStage ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
