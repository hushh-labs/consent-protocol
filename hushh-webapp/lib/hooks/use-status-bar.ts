import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * useStatusBar - Adaptive status bar theme synchronization
 *
 * Syncs the native iOS/Android status bar icon colors with the app theme.
 * Uses a fallback chain to detect theme on initial load before next-themes resolves:
 * 1. resolvedTheme (from next-themes after hydration)
 * 2. theme (user preference before resolution)
 * 3. System preference via matchMedia
 * 4. Default to "dark" (app default)
 *
 * Style.Dark = white icons (for dark backgrounds)
 * Style.Light = black icons (for light backgrounds)
 */
export function useStatusBar() {
  const { resolvedTheme, theme } = useTheme();
  const hasSetInitialStyle = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setStatusBarStyle = async (isDark: boolean) => {
      try {
        console.log(`[StatusBar] Applying style: ${isDark ? "Dark (white icons)" : "Light (black icons)"}`);

        // Style.Dark = white icons (for dark backgrounds)
        // Style.Light = black icons (for light backgrounds)
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });

        // Transparent status bar with content underneath (Apple-style).
        // When overlay is true, setBackgroundColor has no effect per Capacitor docs.
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (e) {
        console.warn("[StatusBar] Error:", e);
      }
    };

    // Determine effective theme with fallback chain:
    // 1. resolvedTheme (from next-themes after hydration)
    // 2. theme (user preference before resolution)
    // 3. System preference via matchMedia
    // 4. Default to "dark" (app default)
    let effectiveTheme: string;

    if (resolvedTheme) {
      effectiveTheme = resolvedTheme;
    } else if (theme && theme !== "system") {
      effectiveTheme = theme;
    } else {
      // Use system preference as fallback
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    const isDark = effectiveTheme === "dark";

    // Set initial style immediately on mount
    if (!hasSetInitialStyle.current) {
      hasSetInitialStyle.current = true;
      console.log(`[StatusBar] Initial theme detection: ${effectiveTheme}`);
      setStatusBarStyle(isDark);
    } else {
      // Update on theme changes
      setStatusBarStyle(isDark);
    }
  }, [resolvedTheme, theme]);

  // Also listen for system theme changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply if theme is set to "system" or next-themes hasn't resolved yet
      if (theme === "system" || !resolvedTheme) {
        console.log(`[StatusBar] System theme changed: ${e.matches ? "dark" : "light"}`);
        StatusBar.setStyle({
          style: e.matches ? Style.Dark : Style.Light,
        }).catch(console.warn);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, resolvedTheme]);

  // Respond directly to explicit theme changes (not system)
  // This ensures immediate updates when user toggles theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // When theme explicitly changes (not system), update immediately
    if (theme && theme !== "system") {
      const isDark = theme === "dark";
      console.log(`[StatusBar] Explicit theme change: ${theme}`);
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
        .catch(console.warn);
    }
  }, [theme]);
}
