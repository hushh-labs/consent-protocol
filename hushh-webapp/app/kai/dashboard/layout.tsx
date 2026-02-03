"use client";

/**
 * Kai Dashboard Layout
 *
 * VaultLockGuard and ConsentSSEProvider are provided by parent app/kai/layout.tsx.
 * Pass-through to preserve flex scroll behavior.
 */

export default function KaiDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
