"use client";

/**
 * Consents Layout - Mobile-First
 *
 * Wraps consents page with VaultLockGuard.
 * ConsentSSEProvider and ConsentNotificationProvider are mounted at root (providers.tsx).
 */

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function ConsentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultLockGuard>
      {/* Content - scroll handled by root providers */}
      {children}
    </VaultLockGuard>
  );
}
