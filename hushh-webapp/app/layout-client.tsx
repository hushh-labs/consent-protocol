"use client";

import { ReactNode } from "react";

interface RootLayoutClientProps {
  children: ReactNode;
  fontClasses: string;
}

/**
 * Client-side wrapper for body element
 * Enables client-side features in root layout
 */
export function RootLayoutClient({
  children,
  fontClasses,
}: RootLayoutClientProps) {
  return (
    <body
      suppressHydrationWarning
      className={`${fontClasses} font-sans antialiased h-full flex flex-col morphy-app-bg`}
      style={{
        fontFamily: "var(--font-quicksand), sans-serif",
      }}
    >
      {/* Subtle radial glow overlay */}
      <div className="fixed inset-0 pointer-events-none morphy-app-bg-radial z-0" />
      {children}
    </body>
  );
}
