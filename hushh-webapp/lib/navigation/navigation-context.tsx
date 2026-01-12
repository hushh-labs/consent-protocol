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
 * - Level 1 → prompts to exit app (iOS and Android)
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { ExitDialog } from "@/components/exit-dialog";

// Level 1 root paths (exit prompt on back button)
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

export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Use ref to avoid stale closure issues with the back button listener
  const handleBackRef = useRef<() => void>(() => {});

  // Calculate navigation level and parent path
  const { level, isRootLevel, parentPath } = useMemo(() => {
    // Normalize pathname (remove trailing slash except for root)
    const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

    // Check if it's a level 1 path
    if (LEVEL_1_PATHS.includes(normalizedPath)) {
      return { level: 1, isRootLevel: true, parentPath: null };
    }

    // Calculate depth from path segments
    const segments = normalizedPath.split("/").filter(Boolean);
    const depth = segments.length;

    // Find parent path (go up one level)
    const parent =
      depth > 1 ? "/" + segments.slice(0, -1).join("/") : "/dashboard";

    return {
      level: depth,
      isRootLevel: false,
      parentPath: parent,
    };
  }, [pathname]);

  // Handle back navigation - show exit dialog on BOTH iOS and Android
  const handleBack = useCallback(() => {
    if (isRootLevel) {
      // Level 1: Show exit dialog with vault lock and app exit
      setShowExitDialog(true);
      return;
    }

    // Level 2+: Navigate to parent
    if (parentPath) {
      router.push(parentPath);
    } else {
      router.back();
    }
  }, [isRootLevel, parentPath, router]);

  // Update ref whenever handleBack changes
  useEffect(() => {
    handleBackRef.current = handleBack;
  }, [handleBack]);

  // Register back button listener ONCE with stable ref
  useEffect(() => {
    let backButtonListener: PluginListenerHandle | null = null;

    const setupListener = async () => {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        backButtonListener = await App.addListener(
          "backButton",
          ({ canGoBack }) => {
            handleBackRef.current();
          }
        );
      } catch (error) {
        console.error(
          "[Navigation] Failed to register back button listener:",
          error
        );
      }
    };

    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []); // Empty deps - listener stays stable, ref provides latest handler

  // iOS swipe-back gesture detection
  // Since @capacitor/app backButton only fires on Android, we implement
  // edge swipe gesture for iOS to provide the same back navigation experience
  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;

    let touchStartX = 0;
    let touchStartY = 0;
    const EDGE_THRESHOLD = 30; // px from left edge to start swipe
    const SWIPE_THRESHOLD = 100; // min px horizontal distance to trigger back

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (touch.clientX < EDGE_THRESHOLD) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX === 0) return;

      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);

      // Horizontal swipe from edge, minimal vertical movement
      if (deltaX > SWIPE_THRESHOLD && deltaY < 100) {
        handleBackRef.current();
      }

      // Reset
      touchStartX = 0;
      touchStartY = 0;
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []); // Empty deps - listener stays stable, ref provides latest handler

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
