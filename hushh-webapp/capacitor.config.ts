import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hushh.pda",
  appName: "Hushh PDA",
  webDir: "out",

  // iOS-specific configuration
  ios: {
    // Use WKWebView content mode for better performance
    contentInset: "automatic",
    // Allow inline media playback
    allowsLinkPreview: true,
    // Enable scrolling
    scrollEnabled: true,
    // Background color matches app theme
    backgroundColor: "#0a0a0a",
    // Scheme for local file serving
    scheme: "hushh",
  },

  // Server configuration for development
  server: {
    // In production, this will be the static export
    // For dev, we can use livereload if needed
    androidScheme: "https",
    iosScheme: "hushh",
  },

  // Plugin configurations (stubs for our custom plugins)
  plugins: {
    // Native plugins will be registered here
    // HushhVault and HushhConsent plugins will be added
  },
};

export default config;
