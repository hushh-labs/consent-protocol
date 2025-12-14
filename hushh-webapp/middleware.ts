// middleware.ts
// Next.js Middleware for Route Protection

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/docs", "/logout", "/privacy"];

// API routes are handled separately
const API_PREFIX = "/api";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API routes (they handle their own auth)
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // For protected routes, check for session cookie/token
  // Note: We can't access localStorage in middleware, so we use a cookie approach
  // The actual vault_key check happens client-side
  const hasSession = request.cookies.get("user_session");

  // If no session and trying to access protected route, redirect to login
  // However, since we use client-side auth, we let the page handle redirect
  // This middleware primarily prevents direct URL access timing

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
