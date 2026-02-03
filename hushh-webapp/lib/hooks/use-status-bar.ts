import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useStatusBar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!resolvedTheme) return; // Wait for theme to be resolved

    const setStatusBarStyle = async () => {
      try {
        console.log(`[StatusBar] Applying theme: ${resolvedTheme}`);

        // Style.Dark = light colored icons (use on dark backgrounds)
        // Style.Light = dark colored icons (use on light backgrounds)
        await StatusBar.setStyle({
          style: resolvedTheme === "dark" ? Style.Dark : Style.Light,
        });

        // Transparent status bar with content underneath (Apple-style).
        // When overlay is true, setBackgroundColor has no effect per Capacitor docs.
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (e) {
        console.warn("[StatusBar] Error:", e);
      }
    };

    setStatusBarStyle();
  }, [resolvedTheme]);
}
