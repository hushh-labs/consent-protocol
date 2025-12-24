import type { NextConfig } from "next";

/**
 * Next.js Configuration for Web (Standalone Server Mode)
 * 
 * This config is for running the web app with API routes.
 * For iOS/Android mobile builds, use next.config.capacitor.ts
 */
const webConfig: NextConfig = {
  // Standalone output for Node.js server deployment
  output: "standalone",

  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },

  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: false,

  // Enable source maps for debugging in production
  productionBrowserSourceMaps: false,

  // API timeout settings
  serverExternalPackages: [],
};

export default webConfig;
