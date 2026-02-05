"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * Wraps all /kai routes with VaultLockGuard.
 * ConsentSSEProvider and ConsentNotificationProvider are mounted at root (providers.tsx).
 */

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function KaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultLockGuard>{children}</VaultLockGuard>;
}
