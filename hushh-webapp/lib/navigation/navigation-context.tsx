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
const LEVEL_1_PATHS = ["/", "/dashboard", "/consents", "/profile", "/agent-nav"];

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

  // Log on mount
  useEffect(() => {
    console.log("[Navigation] NavigationProvider mounted");
    console.log("[Navigation] Platform:", Capacitor.getPlatform());
    console.log("[Navigation] isNativePlatform:", Capacitor.isNativePlatform());
  }, []);

  // Calculate navigation level and parent path
  const { level, isRootLevel, parentPath } = useMemo(() => {
    // Check if it's a level 1 path
    if (LEVEL_1_PATHS.includes(pathname)) {
      console.log(`[Navigation] Path ${pathname} is LEVEL 1 (root)`);
      return { level: 1, isRootLevel: true, parentPath: null };
    }

    // Calculate depth from path segments
    const segments = pathname.split("/").filter(Boolean);
    const depth = segments.length;

    // Find parent path (go up one level)
    const parent =
      depth > 1 ? "/" + segments.slice(0, -1).join("/") : "/dashboard";

    console.log(`[Navigation] Path ${pathname} is LEVEL ${depth}, parent: ${parent}`);
    return {
      level: depth,
      isRootLevel: false,
      parentPath: parent,
    };
  }, [pathname]);

  // Handle back navigation - show exit dialog on BOTH iOS and Android
  const handleBack = useCallback(() => {
    console.log("[Navigation] ========== handleBack() called ==========");
    console.log("[Navigation] Current pathname:", pathname);
    console.log("[Navigation] isRootLevel:", isRootLevel);
    console.log("[Navigation] parentPath:", parentPath);
    console.log("[Navigation] isNativePlatform:", Capacitor.isNativePlatform());

    if (isRootLevel) {
      // Level 1: Show exit dialog on native platforms (iOS and Android)
      if (Capacitor.isNativePlatform()) {
        console.log("[Navigation] >>> SHOWING EXIT DIALOG <<<");
        setShowExitDialog(true);
      } else {
        console.log("[Navigation] Web platform at root - doing nothing");
      }
      // On web, do nothing at root level
      return;
    }

    // Level 2+: Navigate to parent
    if (parentPath) {
      console.log(`[Navigation] Navigating to parent: ${parentPath}`);
      router.push(parentPath);
    } else {
      console.log("[Navigation] Using router.back()");
      router.back();
    }
  }, [isRootLevel, parentPath, pathname, router]);

  // Update ref whenever handleBack changes
  useEffect(() => {
    handleBackRef.current = handleBack;
  }, [handleBack]);

  // Register back button listener ONCE with stable ref
  useEffect(() => {
    let backButtonListener: PluginListenerHandle | null = null;

    const setupListener = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log("[Navigation] Not native platform, skipping back button listener");
        return;
      }

      try {
        console.log("[Navigation] Registering Android hardware back button listener...");
        backButtonListener = await App.addListener("backButton", ({ canGoBack }) => {
          console.log("[Navigation] *** HARDWARE BACK BUTTON PRESSED ***");
          console.log("[Navigation] canGoBack from Capacitor:", canGoBack);
          console.log("[Navigation] Calling handleBackRef.current()...");
          handleBackRef.current();
        });
        console.log("[Navigation] Back button listener registered successfully");
      } catch (error) {
        console.error("[Navigation] Failed to register back button listener:", error);
      }
    };

    setupListener();

    return () => {
      if (backButtonListener) {
        console.log("[Navigation] Removing back button listener");
        backButtonListener.remove();
      }
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
        onOpenChange={(open) => {
          console.log("[Navigation] ExitDialog onOpenChange:", open);
          setShowExitDialog(open);
        }}
        onConfirm={() => {
          console.log("[Navigation] Exit app confirmed - calling App.exitApp()");
          App.exitApp();
        }}
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
