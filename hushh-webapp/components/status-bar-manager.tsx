"use client";

import { useEffect, useState } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "next-themes";

/**
 * StatusBarManager - Native-only component that synchronizes the iOS/Android
 * status bar style (light/dark icons) with the Next.js theme.
 *
 * This ensures status bar icons switch correctly on native when the app theme changes.
 */
export function StatusBarManager() {
  const { resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for theme to be mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !mounted) return;

    const updateStatusBar = async () => {
      try {
        console.log("[StatusBarManager] Updating status bar...");
        console.log("[StatusBarManager] resolvedTheme:", resolvedTheme);
        console.log("[StatusBarManager] theme:", theme);

        // Overlay the webview so our custom blurred background can sit behind the status bar
        await StatusBar.setOverlaysWebView({ overlay: true });
        console.log("[StatusBarManager] Overlay enabled");

        // Determine the effective theme (default to "dark" if undefined)
        const effectiveTheme = resolvedTheme || theme || "dark";
        console.log("[StatusBarManager] effectiveTheme:", effectiveTheme);

        // ACTUAL iOS BEHAVIOR (opposite of docs!):
        // In practice, we need to match the theme:
        // Dark theme -> Style.Dark (so icons match and iOS inverts them)
        // Light theme -> Style.Light (so icons match and iOS inverts them)
        if (effectiveTheme === "dark") {
          await StatusBar.setStyle({ style: Style.Dark });
          console.log("[StatusBarManager] ✅ Set to Style.Dark for dark theme");
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          console.log("[StatusBarManager] ✅ Set to Style.Light for light theme");
        }
      } catch (err) {
        console.error("[StatusBarManager] ❌ Failed to set status bar style:", err);
      }
    };

    updateStatusBar();
  }, [resolvedTheme, theme, mounted]);

  return null;
}
