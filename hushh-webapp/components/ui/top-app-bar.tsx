"use client";

/**
 * TopAppBar - Smart Mobile Navigation Header
 *
 * Shows back button only on Level 2+ pages (sub-pages).
 * Uses the navigation context for layered back navigation.
 *
 * Place this at the layout level for seamless integration.
 */

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/lib/navigation/navigation-context";
import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface TopAppBarProps {
  className?: string;
}

export function TopAppBar({ className }: TopAppBarProps) {
  const { isRootLevel, handleBack } = useNavigation();
  const [isNative, setIsNative] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check platform on mount to avoid hydration mismatch
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Don't show back button on root-level pages
  if (isRootLevel) {
    return null;
  }

  return (
    <div
      className={cn(
        // Fixed at top, full width
        "fixed top-0 left-0 right-0 z-50",
        // Safe area padding + app bar height
        // On native: enforce minimum 32px top padding if safe-area env is not sufficient
        isNative
          ? "pt-[max(env(safe-area-inset-top),32px)] h-[calc(max(env(safe-area-inset-top),32px)+48px)]"
          : "pt-[env(safe-area-inset-top)] h-[calc(env(safe-area-inset-top)+48px)]",
        // Theme-aware background using CSS variable
        "bg-background",
        // Flex container for back button
        "flex items-end pb-2 px-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-muted/50 active:bg-muted/80 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <Breadcrumb>
          <BreadcrumbList>
            {pathname
              .split("/")
              .filter(Boolean)
              .map((segment, index, arr) => {
                const height = arr.length;
                const isLast = index === height - 1;
                const href = `/${arr.slice(0, index + 1).join("/")}`;
                const label =
                  segment.charAt(0).toUpperCase() + segment.slice(1);

                return (
                  <div key={href} className="flex items-center gap-2">
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={href}>{label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </div>
                );
              })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

/**
 * TopAppBarSpacer - Smart spacer that handles top content padding
 * - Root Pages: Adds padding for Status Bar
 * - Sub Pages: Adds padding for TopAppBar + Status Bar
 */
export function TopAppBarSpacer() {
  const { isRootLevel } = useNavigation();

  // Root Level: Just clear the status bar (safe area)
  // We use max(env, 32px) to ensure there is always SOME space on mobile
  if (isRootLevel) {
    return (
      <div className="w-full shrink-0 transition-[height] h-[max(env(safe-area-inset-top),32px)]" />
    );
  }

  // Sub-pages: Clear the fixed TopAppBar (48px) + Status Bar
  return (
    <div className="w-full shrink-0 transition-[height] h-[calc(max(env(safe-area-inset-top),32px)+48px)]" />
  );
}
