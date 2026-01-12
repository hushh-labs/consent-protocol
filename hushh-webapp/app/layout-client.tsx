"use client";

import { ReactNode } from "react";
import { useStatusBar } from "@/lib/hooks/use-status-bar";

interface RootLayoutClientProps {
  children: ReactNode;
  fontClasses: string;
}

/**
 * Client-side wrapper for body element
 * Enables client-side features in root layout
 * 
 * Note: NavigationProvider moved to layout.tsx inside ThemeProvider
 * to ensure AlertDialog portal has access to theme context.
 */
export function RootLayoutClient({
  children,
  fontClasses,
}: RootLayoutClientProps) {
  useStatusBar();

  return (
    <body
      suppressHydrationWarning
      className={`${fontClasses} font-sans antialiased h-full flex flex-col`}
      style={{
        fontFamily: "var(--font-figtree), var(--font-quicksand), sans-serif",
      }}
    >
      {/* Fixed App Background - Oversized to prevent mobile gaps */}
      <div className="fixed top-[-10vh] left-0 w-full h-[120vh] -z-20 morphy-app-bg pointer-events-none" />
      {/* Subtle radial glow overlay */}
      <div className="fixed inset-0 pointer-events-none morphy-app-bg-radial z-1" />

      {children}
    </body>
  );
}
