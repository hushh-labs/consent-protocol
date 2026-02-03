"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface HushhLogoIconProps {
  className?: string;
  size?: number;
}

/**
 * Hushh Logo Icon component for use throughout the app.
 * Replaces generic icons (like Sparkles) with the Hushh brand logo.
 */
export function HushhLogoIcon({ className, size = 20 }: HushhLogoIconProps) {
  return (
    <Image
      src="/hushh-logo-new.svg"
      alt="Hushh"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority
    />
  );
}

/**
 * Circular avatar version of the Hushh logo with gradient background.
 * Used in chat interfaces and headers.
 */
export function HushhLogoAvatar({ 
  className, 
  size = "md" 
}: { 
  className?: string; 
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };
  
  const iconSizes = {
    sm: 14,
    md: 20,
    lg: 28,
  };

  return (
    <div 
      className={cn(
        "rounded-full bg-gradient-to-br from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] flex items-center justify-center shadow-md",
        sizeClasses[size],
        className
      )}
    >
      <HushhLogoIcon size={iconSizes[size]} className="brightness-0 invert" />
    </div>
  );
}
