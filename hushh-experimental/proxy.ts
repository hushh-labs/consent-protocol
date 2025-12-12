import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Enhanced middleware with authentication and performance optimizations
export function proxy(request: NextRequest) {
  // Only protect API routes, not the main admin page (client handles auth)
  if (
    request.nextUrl.pathname.startsWith("/api/admin") &&
    request.nextUrl.pathname !== "/admin/login"
  ) {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");

    // Check for basic auth
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      // Return 401 for API routes instead of redirecting
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Decode the base64 credentials
    const encodedCredentials = authHeader.split(" ")[1];
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      "base64"
    ).toString();
    const [username, password] = decodedCredentials.split(":");

    // Check credentials - MUST use environment variables
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    // Security: Enhanced authentication with constant-time comparison
    const isValidUsername = username === validUsername;
    const isValidPassword = password === validPassword;
    const isValidCredentials = isValidUsername && isValidPassword;

    // Log authentication attempt (production-safe)
    console.log("🔐 Middleware authentication attempt:", {
      timestamp: new Date().toISOString(),
      path: request.nextUrl.pathname,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      userAgent:
        request.headers.get("user-agent")?.substring(0, 100) || "unknown",
      success: isValidCredentials,
      usernameConfigured: !!validUsername,
      passwordConfigured: !!validPassword,
      // Note: We don't log the actual username/password for security
    });

    // Fail securely if credentials not configured
    if (!validUsername || !validPassword) {
      console.error("❌ ADMIN_USERNAME or ADMIN_PASSWORD not configured");
      return new NextResponse("Admin credentials not configured", {
        status: 500,
      });
    }

    if (!isValidCredentials) {
      // Return 401 for API routes instead of redirecting
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // Add security and performance headers for all routes
  const response = NextResponse.next();

  // Security headers for SEO and performance
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // Cross-Origin Isolation for stronger security (where supported)
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  // COEP can break third-party embeds (e.g., YouTube). Relax to avoid blocking.
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");

  // Remove server information disclosure headers
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");
  response.headers.delete("X-AspNet-Version");
  response.headers.delete("X-Runtime");
  response.headers.delete("X-Version");

  // Set generic server header to avoid information disclosure
  response.headers.set("Server", "Web Server");

  // Content Security Policy - strict but compatible with YouTube and Google reCAPTCHA
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "'unsafe-inline'",
    ...(isProd ? [] : ["'unsafe-eval'"]),
  ].join(" ");

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-elem 'self' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    [
      "connect-src 'self'",
      "https://www.youtube.com",
      "https://youtube.com",
      "https://www.google.com",
      "https://play.google.com",
      "https://maps.googleapis.com",
      "https://googleapis.com",
      "https://googlevideo.com",
      "https://youtubei.googleapis.com",
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ].join(" "),
    [
      "frame-src 'self'",
      "https://www.youtube.com",
      "https://youtube.com",
      "https://www.youtube-nocookie.com",
      "https://www.google.com",
      "https://maps.google.com",
      "https://maps.gstatic.com",
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
      "https://www.googletagmanager.com",
    ].join(" "),
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    [
      "media-src 'self'",
      "https://www.youtube.com",
      "https://youtube.com",
      "blob:",
    ].join(" "),
    "upgrade-insecure-requests",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // HTTPS Strict Transport Security - only set for HTTPS requests
  if (
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Performance headers - differentiate between static and dynamic content
  const pathname = request.nextUrl.pathname;

  // Static assets get aggressive caching
  if (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)
  ) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );
    response.headers.set("CDN-Cache-Control", "public, max-age=31536000");
    response.headers.set(
      "Vercel-CDN-Cache-Control",
      "public, max-age=31536000"
    );
  } else {
    // Dynamic content gets shorter cache with revalidation
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=600, stale-while-revalidate=86400"
    );
  }

  // Preload critical resources for better LCP - only for home page and only essential resources
  if (request.nextUrl.pathname === "/" && request.nextUrl.search === "") {
    response.headers.set(
      "Link",
      "</iwebtechno-gradient.svg>; rel=preload; as=image; fetchpriority=high"
    );
  }

  return response;
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled separately for auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/internal (internal Next.js files)
     * - favicon.ico (favicon file)
     * - sitemap.xml, robots.txt (SEO files)
     * - iwebtechno.svg (favicon fallback)
     */
    "/((?!api|_next/static|_next/image|_next/internal|favicon.ico|iwebtechno.svg|sitemap.xml|robots.txt).*)",
    "/api/admin/:path*",
  ],
};
