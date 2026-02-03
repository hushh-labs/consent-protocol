"use client";

/**
 * TopAppBar - Smart Mobile Navigation Header
 *
 * Shows back button on all pages except the landing page ("/").
 * On root-level pages (/dashboard, /consents, /profile), triggers exit dialog.
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
 * StatusBarBlur - Native-only strip under the system status bar.
 * Uses the same transparent blur as TopAppBar so both bands match.
 * Render before TopAppBar (e.g. in providers).
 */
export function StatusBarBlur() {
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);
  if (!isNative) return null;
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-40",
        "h-[env(safe-area-inset-top)] min-h-0",
        BAR_GLASS_CLASS,
      )}
      aria-hidden
    />
  );
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
        // Fixed: on native sit below StatusBarBlur so both bands use same style
        "fixed left-0 right-0 z-50",
        isNative ? "top-[env(safe-area-inset-top)] h-[64px]" : "top-0 h-[64px]",
        // Match StatusBarBlur so Capacitor status bar area and breadcrumb bar match
        BAR_GLASS_CLASS,
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
        isNative ? "h-[calc(64px+env(safe-area-inset-top))]" : "h-[64px]",
      )}
    />
  );
}
