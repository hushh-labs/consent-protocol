"use client";

/**
 * Navigation Context & Smart Back Navigation
 *
 * Provides layered navigation for mobile:
 * - Level 1: Root pages (/, /dashboard, /consents, /profile)
 * - Level 2+: Sub-pages (dashboard/professional, dashboard/kai, etc.)
 *
 * Back button behavior:
 * - Level 2+ → navigates to parent level
 * - Level 1 → prompts to exit app (Android only)
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { toast } from "sonner";

// Level 1 root paths (no back button or exit prompt)
const LEVEL_1_PATHS = [
  "/",
  "/dashboard",
  "/consents",
  "/profile",
  "/agent-nav",
];

interface NavigationContextType {
  /** Current path */
  pathname: string;
  /** Navigation depth (1 = root, 2+ = sub-pages) */
  level: number;
  /** Whether current page is a root-level page */
  isRootLevel: boolean;
  /** Handle back navigation with proper layered logic */
  handleBack: () => void;
  /** The parent path for current route */
  parentPath: string | null;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

// ... imports
import { ExitDialog } from "@/components/exit-dialog";

// ... existing code ...

export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = React.useState(false);

  // ... existing calculation code ...
  const { level, isRootLevel, parentPath } = useMemo(() => {
    // ... same logic ...
    // Check if it's a level 1 path
    if (LEVEL_1_PATHS.includes(pathname)) {
      return { level: 1, isRootLevel: true, parentPath: null };
    }

    // Calculate depth from path segments
    const segments = pathname.split("/").filter(Boolean);
    const depth = segments.length;

    // Find parent path (go up one level)
    const parent =
      depth > 1 ? "/" + segments.slice(0, -1).join("/") : "/dashboard"; // Default fallback for orphan routes

    return {
      level: depth,
      isRootLevel: false,
      parentPath: parent,
    };
  }, [pathname]);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    if (isRootLevel) {
      // Level 1: Ask to exit app on Android
      if (
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
      ) {
        // Show the Exit Dialog UI instead of a toast
        setShowExitDialog(true);
      }
      // On web or iOS, do nothing at root level
      return;
    }

    // Level 2+: Navigate to parent
    if (parentPath) {
      router.push(parentPath);
    } else {
      router.back();
    }
  }, [isRootLevel, parentPath, router]);

  // REGISTER BACK BUTTON LISTENER
  React.useEffect(() => {
    // ... same listener ...
    let backButtonListener: any;

    const setupListener = async () => {
      if (Capacitor.isNativePlatform()) {
        backButtonListener = await App.addListener("backButton", async () => {
          handleBack();
        });
      }
    };

    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [handleBack]);

  const value = useMemo(
    () => ({
      pathname,
      level,
      isRootLevel,
      handleBack,
      parentPath,
    }),
    [pathname, level, isRootLevel, handleBack, parentPath]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onConfirm={() => App.exitApp()}
      />
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}
