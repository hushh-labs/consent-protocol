import "dotenv/config";
import type { CapacitorConfig } from "@capacitor/cli";

// For development: set to true to use localhost:3000 hot reload
// For production: set to false to use static build in /out
const DEV_MODE = false;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (DEV_MODE ? "http://localhost:3000" : undefined);

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://consent-protocol-1006304528804.us-central1.run.app";

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
    scheme: "App",
  },

  // Server configuration
  server: {
    // DEV: Use live server for hot reload
    // PROD: Uses static export from webDir
    url: APP_URL,
    cleartext: true, // Allow HTTP for localhost
    androidScheme: "https",
    iosScheme: "App",
  },

  plugins: {
    FirebaseAuthentication: {
      // Use native Google Sign-In SDK on iOS/Android
      skipNativeAuth: false,
      providers: ["google.com"],
    },
    HushhVault: {
      backendUrl: BACKEND_URL,
    },
    HushhConsent: {
      backendUrl: BACKEND_URL,
    },
    Kai: {
      backendUrl: BACKEND_URL,
    },
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#ffffffff",
    },
  },
};

export default config;
