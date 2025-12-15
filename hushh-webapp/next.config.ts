import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // SEO and URL consistency
  trailingSlash: false,
  images: {
    // Optimize images for better performance
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Allow SVG but only from trusted sources
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    unoptimized: true, // Keep this to ensure SVGs load correctly
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Additional security for production builds
  ...(process.env.NODE_ENV === "production" && {
    // Enable React strict mode in production for better security
    reactStrictMode: false, // Disabled to prevent hydration issues
    // Disable source maps in production for security
    productionBrowserSourceMaps: false,
  }),
  // Headers are now handled in middleware.ts to avoid conflicts
};

export default nextConfig;
