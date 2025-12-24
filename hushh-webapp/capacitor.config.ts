import type { CapacitorConfig } from "@capacitor/cli";

// For development: set to true to use localhost:3000 hot reload
// For production: set to false to use static build in /out
const DEV_MODE = false;

const config: CapacitorConfig = {
  appId: "com.hushh.pda",
  appName: "Hushh PDA",
  webDir: "out",

  // iOS-specific configuration
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: true,
    scrollEnabled: true,
    backgroundColor: "#0a0a0a",
    scheme: "hushh",
  },

  // Server configuration
  server: {
    // DEV: Use live server for hot reload
    // PROD: Uses static export from webDir
    url: DEV_MODE ? "http://localhost:3000" : undefined,
    cleartext: true, // Allow HTTP for localhost
    androidScheme: "https",
    iosScheme: "hushh",
  },

  plugins: {},
};

export default config;

