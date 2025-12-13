"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import { getVariantGradient } from "@/lib/morphy-ux/utils";
import { type ColorVariant } from "@/lib/morphy-ux/types";
import { typography } from "@/lib/morphy-ux/morphy";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: ColorVariant;
}

/**
 * GradientText is the ONLY allowed wrapper for gradient text in headers, per design system exception.
 * It uses the centralized morphy-ui gradient system and supports all ColorVariant gradients.
 * Default: university blue→yellow gradient for brand consistency.
 */
export const GradientText = ({
  children,
  className,
  variant = "gradient",
}: GradientTextProps) => {
  // Use university-focused gradients from Morphy UI
  const getUniversityGradient = () => {
    if (variant === "gradient") {
      // Use single color gradients like active navbar - blue in light mode, yellow in dark mode
      return "bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)]";
    }
    // For other variants, use the morphy-ui system
    const gradient = getVariantGradient(variant);
    return `bg-gradient-to-r ${gradient}`;
  };

  return (
    <span
      className={cn(
        "inline-block bg-clip-text text-transparent bg-gradient-to-r leading-[1.1] py-1",
        getUniversityGradient(),
        typography.classes.heading,
        className
      )}
    >
      {children}
    </span>
  );
};
