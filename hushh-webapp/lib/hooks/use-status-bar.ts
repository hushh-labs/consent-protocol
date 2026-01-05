import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useStatusBar() {
  const { theme } = useTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setStatusBarStyle = async () => {
      try {
        await StatusBar.setStyle({
          style: theme === "dark" ? Style.Dark : Style.Light,
        });
        // Ensure overlay is enabled for immersive feel
        await StatusBar.setOverlaysWebView({ overlay: true });

        // Force transparent background for true immersive mode on Android
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#00000000" });
        }
      } catch (e) {
        console.warn("StatusBar plugin error:", e);
      }
    };

    setStatusBarStyle();
  }, [theme]);
}
