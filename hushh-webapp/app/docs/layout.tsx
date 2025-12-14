"use client";

/**
 * Docs Layout - Simple layout without sidebar
 * Docs pages are standalone with their own navigation
 */

import { Navbar } from "@/components/navbar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-24">
      {/* Main content - full width, mobile responsive */}
      {children}

      {/* Bottom navbar */}
      <Navbar />
    </div>
  );
}
