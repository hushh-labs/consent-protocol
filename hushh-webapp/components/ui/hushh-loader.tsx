"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type HushhLoaderVariant = "fullscreen" | "page" | "inline" | "compact";

export interface HushhLoaderProps {
  label?: string;
  variant?: HushhLoaderVariant;
  className?: string;
}

/**
 * HushhLoader
 * Single canonical loader for the entire app (branding symmetry).
 *
 * IMPORTANT:
 * - No debug strings (per product decision).
 * - UI-only. No backend/plugin involvement.
 * - All variants now render their own spinner (no delegation to root loader).
 * - Use inline/compact for component-level loading states.
 * - Use page/fullscreen for full-page loading states.
 */
export function HushhLoader({
  label = "Loading…",
  variant = "page",
  className,
}: HushhLoaderProps) {
  if (variant === "compact") {
    return (
      <Loader2
        className={cn(
          "h-4 w-4 animate-spin text-primary inline-block",
          className
        )}
      />
    );
  }

  const isFullscreen = variant === "fullscreen";
  const isPage = variant === "page";
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        isFullscreen
          ? "h-screen w-full"
          : isPage
          ? "min-h-[60vh] w-full"
          : isInline
          ? "w-full py-8"
          : "",
        className
      )}
    >
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
