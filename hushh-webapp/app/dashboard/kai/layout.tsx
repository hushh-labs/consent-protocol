"use client";

/**
 * Kai Layout
 *
 * Note: VaultLockGuard, ConsentSSEProvider are already provided by parent /dashboard/layout.tsx
 * This layout only provides Kai-specific styling wrapper.
 */

export default function KaiLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
