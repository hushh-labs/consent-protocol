"use client";

/**
 * TopAppBar - Smart Mobile Navigation Header
 *
 * Shows back button on all pages except the landing page ("/").
 * On root-level pages (/kai, /consents, /profile), triggers exit dialog.
 * On sub-pages (Level 2+), navigates to parent route.
 *
 * On native: StatusBarBlur (safe-area strip) and TopAppBar (breadcrumb bar) share
 * the same transparent blur style so the Capacitor status bar area and breadcrumb
 * bar match (one continuous frosted look).
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

/** Shared style so Capacitor status bar area and breadcrumb bar match (masked blur on all platforms) */
const BAR_GLASS_CLASS = "top-bar-glass";

/**
 * TopBarBackground - Single background layer for status bar and top app bar.
 * Ensures a continuous frosted look with a single smooth fade mask.
 */
export function TopBarBackground() {
  const [isNative, setIsNative] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  if (pathname === "/") return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-40",
        BAR_GLASS_CLASS,
        isNative ? "h-[calc(env(safe-area-inset-top)+72px)]" : "h-[64px]"
      )}
      aria-hidden
    />
  );
}

/**
 * StatusBarBlur - No longer renders its own glass, now handled by TopBarBackground.
 * But we keep it as a spacer/logic holder if needed, or just return null.
 */
export function StatusBarBlur() {
  return null;
}

interface TopAppBarProps {
  className?: string;
}

export function TopAppBar({ className }: TopAppBarProps) {
  const { handleBack } = useNavigation();
  const [isNative, setIsNative] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check platform on mount to avoid hydration mismatch
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Don't show TopAppBar only on the landing page
  if (pathname === "/") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50",
        isNative ? "top-[env(safe-area-inset-top)] h-[72px]" : "top-0 h-[64px]",
        // Flex container for back button
        "flex items-center pb-2 px-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-muted/50 active:bg-muted/80 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>

        <Breadcrumb>
          <BreadcrumbList className="text-lg">
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
 * - Landing Page: No spacer needed (body padding handles safe area)
 * - Sub Pages: Adds padding for TopAppBar only (body handles safe area)
 * - Native with overlay: spacer = 64px + safe-area so content clears blurred bar
 */
export function TopAppBarSpacer() {
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Landing page: No spacer needed, body padding handles safe area
  if (pathname === "/") {
    return null;
  }

  // Sub-pages: clear the fixed TopAppBar; on native bar extends into safe area
  return (
    <div
      className={cn(
        "w-full shrink-0 transition-[height]",
        isNative ? "h-[calc(72px+env(safe-area-inset-top))]" : "h-[64px]",
      )}
    />
  );
}
