"use client";

/**
 * Kai Layout
 *
 * Note: VaultLockGuard, ConsentSSEProvider are already provided by parent /dashboard/layout.tsx
 * This layout passes through children without additional wrappers to preserve flex scroll behavior.
 */

export default function KaiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
