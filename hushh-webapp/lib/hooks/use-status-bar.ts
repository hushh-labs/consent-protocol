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

        // Android-specific: Set background color to match app theme exactly
        if (Capacitor.getPlatform() === "android") {
          // Colors matching CSS --background variable:
          // Light: oklch(1 0 0) = #ffffff
          // Dark: oklch(0.145 0 0) = ~#1f1f1f
          const bgColor =
            resolvedTheme === "dark"
              ? "#1f1f1f" // Dark mode - oklch(0.145 0 0)
              : "#FFFFFF"; // Light mode - oklch(1 0 0)

          console.log(`[StatusBar] Android bg: ${bgColor}`);
          await StatusBar.setBackgroundColor({ color: bgColor });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } else {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch (e) {
        console.warn("[StatusBar] Error:", e);
      }
    };

    setStatusBarStyle();
  }, [resolvedTheme]);
}
